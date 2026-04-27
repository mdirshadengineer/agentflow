import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
	AnthropicProvider,
	OpenAIProvider,
	defaultToolRegistry,
	type ChatMessage,
	type LLMProvider,
} from "@mdirshadengineer/agentflow-core";
import { agentSessions, agents, getDb } from "../../../../db/index.js";
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

// Keep backward-compat alias used by existing tests
function parseConfig(raw: string): unknown {
	return parseJson(raw) ?? {};
}

function serializeAgent(row: typeof agents.$inferSelect) {
	return {
		...row,
		config: parseConfig(row.config),
		tools: parseJson(row.tools),
	};
}

function serializeSession(row: typeof agentSessions.$inferSelect) {
	return {
		...row,
		messages: parseJson(row.messages) ?? [],
	};
}

/**
 * Build the appropriate LLMProvider from agent DB row.
 * Throws if the required API key is not available.
 */
function buildLLMProvider(row: typeof agents.$inferSelect): LLMProvider {
	const config = (parseConfig(row.config) ?? {}) as Record<string, unknown>;
	const provider = row.llmProvider ?? "openai";

	if (provider === "anthropic") {
		return new AnthropicProvider();
	}

	if (provider === "ollama") {
		return new OpenAIProvider({
			baseUrl:
				(config.baseUrl as string | undefined) ??
				"http://localhost:11434/v1",
			apiKey: "ollama",
		});
	}

	// "openai" or any OpenAI-compatible endpoint
	return new OpenAIProvider({
		baseUrl: config.baseUrl as string | undefined,
	});
}

const MAX_AGENT_LOOP_ITERATIONS = 10;

export default async function agentsRoutes(fastify: FastifyInstance) {
	// GET /api/v1/agents
	fastify.get(
		"/",
		{ preHandler: requireAuth },
		async (request: FastifyRequest, reply: FastifyReply) => {
			const { userId } = request.user as JWTPayload;
			const db = getDb();
			const rows = db
				.select()
				.from(agents)
				.where(eq(agents.ownerId, userId))
				.all();
			return reply.send(rows.map(serializeAgent));
		},
	);

	// POST /api/v1/agents
	fastify.post<{
		Body: {
			name: string;
			description?: string;
			type: string;
			config?: unknown;
			llmProvider?: string;
			llmModel?: string;
			systemPrompt?: string;
			tools?: string[];
		};
	}>("/", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { name, description, type, config, llmProvider, llmModel, systemPrompt, tools } = request.body;

		if (!name || !type) {
			return reply.code(400).send({ error: "name and type are required" });
		}

		const db = getDb();
		const id = randomUUID();
		const now = Date.now();

		db.insert(agents)
			.values({
				id,
				name,
				description: description ?? null,
				type,
				config: JSON.stringify(config ?? {}),
				llmProvider: llmProvider ?? null,
				llmModel: llmModel ?? null,
				systemPrompt: systemPrompt ?? null,
				tools: tools !== undefined ? JSON.stringify(tools) : null,
				ownerId: userId,
				createdAt: new Date(now),
				updatedAt: new Date(now),
			})
			.run();

		const row = db.select().from(agents).where(eq(agents.id, id)).get();

		if (!row) {
			return reply.code(500).send({ error: "Failed to create agent" });
		}
		return reply.code(201).send(serializeAgent(row));
	});

	// GET /api/v1/agents/:id
	fastify.get<{ Params: { id: string } }>(
		"/:id",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();
			const row = db
				.select()
				.from(agents)
				.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
				.get();

			if (!row) {
				return reply.code(404).send({ error: "Agent not found" });
			}
			return reply.send(serializeAgent(row));
		},
	);

	// PATCH /api/v1/agents/:id
	fastify.patch<{
		Params: { id: string };
		Body: {
			name?: string;
			description?: string;
			type?: string;
			config?: unknown;
			llmProvider?: string;
			llmModel?: string;
			systemPrompt?: string;
			tools?: string[];
		};
	}>("/:id", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { id } = request.params;
		const { name, description, type, config, llmProvider, llmModel, systemPrompt, tools } = request.body;
		const db = getDb();

		const existing = db
			.select()
			.from(agents)
			.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
			.get();

		if (!existing) {
			return reply.code(404).send({ error: "Agent not found" });
		}

		const updates: Partial<typeof agents.$inferInsert> = {
			updatedAt: new Date(),
		};
		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (type !== undefined) updates.type = type;
		if (config !== undefined) updates.config = JSON.stringify(config);
		if (llmProvider !== undefined) updates.llmProvider = llmProvider;
		if (llmModel !== undefined) updates.llmModel = llmModel;
		if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
		if (tools !== undefined) updates.tools = JSON.stringify(tools);

		db.update(agents).set(updates).where(eq(agents.id, id)).run();

		const updated = db.select().from(agents).where(eq(agents.id, id)).get();

		if (!updated) {
			return reply.code(500).send({ error: "Failed to update agent" });
		}
		return reply.send(serializeAgent(updated));
	});

	// DELETE /api/v1/agents/:id
	fastify.delete<{ Params: { id: string } }>(
		"/:id",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const existing = db
				.select()
				.from(agents)
				.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
				.get();

			if (!existing) {
				return reply.code(404).send({ error: "Agent not found" });
			}

			db.delete(agents).where(eq(agents.id, id)).run();
			return reply.code(204).send();
		},
	);

	// POST /api/v1/agents/:id/chat — SSE LLM agent loop
	fastify.post<{
		Params: { id: string };
		Body: { message: string; sessionId?: string };
	}>("/:id/chat", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { id } = request.params;
		const { message, sessionId: existingSessionId } = request.body;

		if (!message || typeof message !== "string" || !message.trim()) {
			return reply.code(400).send({ error: "message is required" });
		}

		const db = getDb();
		const agent = db
			.select()
			.from(agents)
			.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
			.get();

		if (!agent) {
			return reply.code(404).send({ error: "Agent not found" });
		}

		// Build LLM provider — return 503 if keys are missing
		let llmProvider: LLMProvider;
		try {
			llmProvider = buildLLMProvider(agent);
		} catch (err) {
			return reply.code(503).send({
				error: err instanceof Error ? err.message : "LLM provider not configured",
			});
		}

		// Resolve registered tools for this agent
		const agentToolNames: string[] = (() => {
			try {
				return JSON.parse(agent.tools ?? "[]") as string[];
			} catch {
				return [];
			}
		})();
		const resolvedTools = agentToolNames
			.map((name) => defaultToolRegistry.get(name))
			.filter((t) => t !== undefined);

		// Get or create session
		let session = existingSessionId
			? db
					.select()
					.from(agentSessions)
					.where(
						and(
							eq(agentSessions.id, existingSessionId),
							eq(agentSessions.agentId, id),
						),
					)
					.get()
			: undefined;

		const sessionId = session?.id ?? randomUUID();
		const now = Date.now();

		if (!session) {
			db.insert(agentSessions)
				.values({
					id: sessionId,
					agentId: id,
					workflowRunId: null,
					messages: "[]",
					status: "active",
					createdAt: new Date(now),
					updatedAt: new Date(now),
				})
				.run();
			session = db
				.select()
				.from(agentSessions)
				.where(eq(agentSessions.id, sessionId))
				.get();
		}

		// Build message history
		const history: ChatMessage[] = (() => {
			try {
				return JSON.parse(session?.messages ?? "[]") as ChatMessage[];
			} catch {
				return [];
			}
		})();

		// Prepend system prompt if set and not already present
		const messages: ChatMessage[] = [];
		if (agent.systemPrompt && !history.some((m) => m.role === "system")) {
			messages.push({ role: "system", content: agent.systemPrompt });
		}
		messages.push(...history, { role: "user", content: message.trim() });

		// Hijack reply for SSE
		reply.hijack();
		const raw = reply.raw;
		raw.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		});

		const sendEvent = (event: string, data: unknown) => {
			if (!raw.writableEnded) {
				raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
			}
		};

		const llmOptions = {
			model: agent.llmModel ?? undefined,
		};

		try {
			// Run the agent loop
			for (let i = 0; i < MAX_AGENT_LOOP_ITERATIONS; i++) {
				const response = await llmProvider.chatWithTools(
					messages,
					resolvedTools,
					llmOptions,
				);

				const assistantMsg: ChatMessage = {
					role: "assistant",
					content: response.content ?? "",
					...(response.toolCalls.length > 0
						? { toolCalls: response.toolCalls }
						: {}),
				};
				messages.push(assistantMsg);

				if (response.toolCalls.length === 0) {
					// Final assistant response — stream it
					sendEvent("message", { role: "assistant", content: response.content ?? "" });
					break;
				}

				// Execute tool calls and loop
				for (const tc of response.toolCalls) {
					sendEvent("tool_call", { name: tc.name, arguments: tc.arguments });

					const tool = defaultToolRegistry.get(tc.name);
					let result: string;
					if (tool) {
						try {
							const output = await tool.execute(tc.arguments);
							result = JSON.stringify(output);
						} catch (err) {
							result = `Error: ${err instanceof Error ? err.message : String(err)}`;
						}
					} else {
						result = `Error: Tool "${tc.name}" not found`;
					}

					sendEvent("tool_result", { name: tc.name, result });

					messages.push({
						role: "tool",
						content: result,
						toolCallId: tc.id,
					});
				}
			}

			// Persist updated session (exclude system prompt from stored history)
			const storedMessages = messages.filter((m) => m.role !== "system");
			db.update(agentSessions)
				.set({
					messages: JSON.stringify(storedMessages),
					status: "active",
					updatedAt: new Date(),
				})
				.where(eq(agentSessions.id, sessionId))
				.run();

			sendEvent("done", { sessionId });
		} catch (err) {
			sendEvent("error", {
				message: err instanceof Error ? err.message : "Agent loop failed",
			});
		} finally {
			if (!raw.writableEnded) {
				raw.end();
			}
		}
	});

	// GET /api/v1/agents/:id/sessions — list sessions for an agent
	fastify.get<{ Params: { id: string } }>(
		"/:id/sessions",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const agent = db
				.select()
				.from(agents)
				.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
				.get();

			if (!agent) {
				return reply.code(404).send({ error: "Agent not found" });
			}

			const sessions = db
				.select()
				.from(agentSessions)
				.where(eq(agentSessions.agentId, id))
				.all();

			return reply.send(sessions.map(serializeSession));
		},
	);

	// GET /api/v1/agents/:id/sessions/:sessionId — get a specific session
	fastify.get<{ Params: { id: string; sessionId: string } }>(
		"/:id/sessions/:sessionId",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id, sessionId } = request.params;
			const db = getDb();

			const agent = db
				.select()
				.from(agents)
				.where(and(eq(agents.id, id), eq(agents.ownerId, userId)))
				.get();

			if (!agent) {
				return reply.code(404).send({ error: "Agent not found" });
			}

			const session = db
				.select()
				.from(agentSessions)
				.where(
					and(
						eq(agentSessions.id, sessionId),
						eq(agentSessions.agentId, id),
					),
				)
				.get();

			if (!session) {
				return reply.code(404).send({ error: "Session not found" });
			}

			return reply.send(serializeSession(session));
		},
	);
}
