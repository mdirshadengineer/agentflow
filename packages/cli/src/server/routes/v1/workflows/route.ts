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
}
