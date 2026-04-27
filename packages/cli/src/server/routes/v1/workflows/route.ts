import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
	getDb,
	workflowRunSteps,
	workflowRuns,
	workflows,
} from "../../../../db/index.js";
import { requireAuth } from "../../../middleware/auth.js";

type JWTPayload = { userId: string; email: string };

function parseJson(raw: string | null | undefined): unknown {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function serializeWorkflow(row: typeof workflows.$inferSelect) {
	return {
		...row,
		definition: parseJson(row.definition),
	};
}

function serializeRun(row: typeof workflowRuns.$inferSelect) {
	return {
		...row,
		output: parseJson(row.output),
	};
}

export default async function workflowsRoutes(fastify: FastifyInstance) {
	// GET /api/v1/workflows
	fastify.get(
		"/",
		{ preHandler: requireAuth },
		async (request: FastifyRequest, reply: FastifyReply) => {
			const { userId } = request.user as JWTPayload;
			const db = getDb();
			const rows = db
				.select()
				.from(workflows)
				.where(eq(workflows.ownerId, userId))
				.all();
			return reply.send(rows.map(serializeWorkflow));
		},
	);

	// POST /api/v1/workflows
	fastify.post<{
		Body: { name: string; definition?: unknown };
	}>("/", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { name, definition } = request.body;

		if (!name) {
			return reply.code(400).send({ error: "name is required" });
		}

		const db = getDb();
		const id = randomUUID();
		const now = Date.now();

		db.insert(workflows)
			.values({
				id,
				name,
				definition: JSON.stringify(definition ?? {}),
				ownerId: userId,
				createdAt: new Date(now),
				updatedAt: new Date(now),
			})
			.run();

		const row = db.select().from(workflows).where(eq(workflows.id, id)).get();

		if (!row) {
			return reply.code(500).send({ error: "Failed to create workflow" });
		}
		return reply.code(201).send(serializeWorkflow(row));
	});

	// GET /api/v1/workflows/:id
	fastify.get<{ Params: { id: string } }>(
		"/:id",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();
			const row = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!row) {
				return reply.code(404).send({ error: "Workflow not found" });
			}
			return reply.send(serializeWorkflow(row));
		},
	);

	// PATCH /api/v1/workflows/:id
	fastify.patch<{
		Params: { id: string };
		Body: { name?: string; definition?: unknown };
	}>("/:id", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { id } = request.params;
		const { name, definition } = request.body;
		const db = getDb();

		const existing = db
			.select()
			.from(workflows)
			.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
			.get();

		if (!existing) {
			return reply.code(404).send({ error: "Workflow not found" });
		}

		const updates: Partial<typeof workflows.$inferInsert> = {
			updatedAt: new Date(),
		};
		if (name !== undefined) updates.name = name;
		if (definition !== undefined)
			updates.definition = JSON.stringify(definition);

		db.update(workflows).set(updates).where(eq(workflows.id, id)).run();

		const updated = db
			.select()
			.from(workflows)
			.where(eq(workflows.id, id))
			.get();

		if (!updated) {
			return reply.code(500).send({ error: "Failed to update workflow" });
		}
		return reply.send(serializeWorkflow(updated));
	});

	// DELETE /api/v1/workflows/:id
	fastify.delete<{ Params: { id: string } }>(
		"/:id",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const existing = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!existing) {
				return reply.code(404).send({ error: "Workflow not found" });
			}

			db.delete(workflows).where(eq(workflows.id, id)).run();
			return reply.code(204).send();
		},
	);

	// POST /api/v1/workflows/:id/run — enqueue a workflow run
	fastify.post<{ Params: { id: string } }>(
		"/:id/run",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const workflow = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!workflow) {
				return reply.code(404).send({ error: "Workflow not found" });
			}

			const runId = randomUUID();
			db.insert(workflowRuns)
				.values({
					id: runId,
					workflowId: id,
					status: "queued",
				})
				.run();

			const run = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.id, runId))
				.get();

			if (!run) {
				return reply.code(500).send({ error: "Failed to enqueue run" });
			}
			return reply.code(201).send(serializeRun(run));
		},
	);

	// GET /api/v1/workflows/:id/runs — list runs for a workflow
	fastify.get<{ Params: { id: string } }>(
		"/:id/runs",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const workflow = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!workflow) {
				return reply.code(404).send({ error: "Workflow not found" });
			}

			const runs = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.workflowId, id))
				.all();

			return reply.send(runs.map(serializeRun));
		},
	);

	// GET /api/v1/workflows/:id/runs/:runId — get a specific run
	fastify.get<{ Params: { id: string; runId: string } }>(
		"/:id/runs/:runId",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id, runId } = request.params;
			const db = getDb();

			const workflow = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!workflow) {
				return reply.code(404).send({ error: "Workflow not found" });
			}

			const run = db
				.select()
				.from(workflowRuns)
				.where(and(eq(workflowRuns.id, runId), eq(workflowRuns.workflowId, id)))
				.get();

			if (!run) {
				return reply.code(404).send({ error: "Run not found" });
			}

			const steps = db
				.select()
				.from(workflowRunSteps)
				.where(eq(workflowRunSteps.runId, runId))
				.all();

			return reply.send({ ...serializeRun(run), steps });
		},
	);

	// POST /api/v1/workflows/:id/ai-generate — generate a WorkflowDefinition from a prompt
	// Currently only the "openai" provider is supported; the `provider` field is
	// accepted for forward-compatibility and ignored when it is absent or "openai".
	fastify.post<{
		Params: { id: string };
		Body: { prompt: string; provider?: string; model?: string };
	}>(
		"/:id/ai-generate",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const { prompt, provider, model } = request.body;

			if (provider && provider !== "openai") {
				return reply.code(400).send({
					error: `Unsupported provider "${provider}". Only "openai" is currently supported.`,
				});
			}

			if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
				return reply.code(400).send({ error: "prompt is required" });
			}

			const db = getDb();
			const workflow = db
				.select()
				.from(workflows)
				.where(and(eq(workflows.id, id), eq(workflows.ownerId, userId)))
				.get();

			if (!workflow) {
				return reply.code(404).send({ error: "Workflow not found" });
			}

			const apiKey = process.env.OPENAI_API_KEY;
			if (!apiKey) {
				return reply.code(503).send({
					error:
						"AI generation is not configured. Set the OPENAI_API_KEY environment variable to enable this feature.",
				});
			}

			const systemPrompt = `You are an AI assistant that converts natural-language workflow descriptions into structured JSON workflow definitions for an agent automation platform.

A workflow definition has this exact shape:
{
  "nodes": WorkflowNode[],
  "edges": WorkflowEdge[]
}

Each WorkflowNode is one of:
- { "id": string, "type": "trigger", "position": { "x": number, "y": number }, "data": { "label": string, "triggerType": "manual" | "scheduled" | "webhook", "cron"?: string, "webhookPath"?: string } }
- { "id": string, "type": "agent",   "position": { "x": number, "y": number }, "data": { "label": string, "agentId": string, "agentName"?: string, "prompt"?: string } }
- { "id": string, "type": "condition","position": { "x": number, "y": number }, "data": { "label": string, "condition": string } }
- { "id": string, "type": "output",  "position": { "x": number, "y": number }, "data": { "label": string, "outputKey"?: string } }

Each WorkflowEdge is: { "id": string, "source": string, "target": string }

Rules:
- Use sequential x positions (e.g. 100, 350, 600…) and y=200 for a linear flow; branch nodes may vary y.
- Every workflow must start with exactly one trigger node.
- "agentId" for agent nodes must be an empty string "" (the user will pick a real agent in the UI).
- The "condition" field is a JavaScript expression evaluated against { output }.
- Respond ONLY with valid JSON — no markdown, no explanation.`;

			let definition: unknown;
			try {
				const response = await fetch(
					"https://api.openai.com/v1/chat/completions",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: model ?? "gpt-4o-mini",
							messages: [
								{ role: "system", content: systemPrompt },
								{ role: "user", content: prompt.trim() },
							],
							response_format: { type: "json_object" },
							temperature: 0.3,
						}),
					},
				);

				if (!response.ok) {
					const errBody = (await response.json().catch(() => null)) as {
						error?: { message?: string } | string;
						message?: string;
					} | null;
					let msg = `OpenAI API error: ${response.status}`;
					if (errBody) {
						if (typeof errBody.error === "string") {
							msg = errBody.error;
						} else if (typeof errBody.error?.message === "string") {
							msg = errBody.error.message;
						} else if (typeof errBody.message === "string") {
							msg = errBody.message;
						}
					}
					return reply.code(502).send({ error: msg });
				}

				const completion = (await response.json()) as {
					choices: Array<{ message: { content: string } }>;
				};
				const content = completion.choices[0]?.message?.content ?? "{}";
				definition = JSON.parse(content);
			} catch (err) {
				fastify.log.error(err, "ai-generate: failed to call OpenAI");
				return reply
					.code(502)
					.send({ error: "Failed to contact AI provider. Please try again." });
			}

			return reply.send(definition);
		},
	);
}
