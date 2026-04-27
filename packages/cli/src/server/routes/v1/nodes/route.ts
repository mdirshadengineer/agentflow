import { allManifests } from "@mdirshadengineer/agentflow-nodes";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../middleware/auth.js";

export default async function nodesRoutes(fastify: FastifyInstance) {
	// GET /api/v1/nodes — return all built-in node manifests
	fastify.get("/", { preHandler: requireAuth }, async (_request, reply) => {
		return reply.send(allManifests);
	});
}
