/**
 * Builds a Fastify app for integration tests by manually registering routes
 * without relying on @fastify/autoload (which scans the filesystem).
 *
 * vi.mock() must have already been applied to '../../db/connection.js' before
 * this module is imported so that route handlers receive the in-memory DB.
 */
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { fastify } from "fastify";
import agentsRoutes from "../../server/routes/v1/agents/route.js";
import authRoutes from "../../server/routes/v1/auth/route.js";
import runsRoutes from "../../server/routes/v1/runs/route.js";
import workflowsRoutes from "../../server/routes/v1/workflows/route.js";

export const TEST_JWT_SECRET = "test-jwt-secret-for-integration-tests";

export async function buildTestServer() {
	const app = fastify({ logger: false });

	await app.register(fastifyCookie);
	await app.register(fastifyJwt, {
		secret: TEST_JWT_SECRET,
		cookie: { cookieName: "token", signed: false },
	});

	app.register(authRoutes, { prefix: "/api/v1/auth" });
	app.register(agentsRoutes, { prefix: "/api/v1/agents" });
	app.register(workflowsRoutes, { prefix: "/api/v1/workflows" });
	app.register(runsRoutes, { prefix: "/api/v1/runs" });
	app.get("/health", async () => ({ status: "ok" }));

	await app.ready();
	return app;
}
