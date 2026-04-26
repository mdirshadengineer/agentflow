import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { agents, getDb } from "../../../../db/index.js";
import { requireAuth } from "../../../middleware/auth.js";

type JWTPayload = { userId: string; email: string };

function parseConfig(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function serializeAgent(row: typeof agents.$inferSelect) {
	return {
		...row,
		config: parseConfig(row.config),
	};
}

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
		};
	}>("/", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { name, description, type, config } = request.body;

		if (!name || !type) {
			return reply.code(400).send({ error: "name and type are required" });
		}

		const db = getDb();
		const id = randomUUID();
		const now = Date.now();
		const configStr = JSON.stringify(config ?? {});

		db.insert(agents)
			.values({
				id,
				name,
				description: description ?? null,
				type,
				config: configStr,
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
		};
	}>("/:id", { preHandler: requireAuth }, async (request, reply) => {
		const { userId } = request.user as JWTPayload;
		const { id } = request.params;
		const { name, description, type, config } = request.body;
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
}
