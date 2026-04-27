import { defaultToolRegistry } from "@mdirshadengineer/agentflow-core";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../middleware/auth.js";

export default async function toolsRoutes(fastify: FastifyInstance) {
	// GET /api/v1/tools — return all registered tools (name, description, inputSchema)
	fastify.get("/", { preHandler: requireAuth }, async (_request, reply) => {
		const tools = defaultToolRegistry.list().map(({ name, description, inputSchema }) => ({
			name,
			description,
			inputSchema,
		}));
		return reply.send(tools);
	});
}
