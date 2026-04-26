import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import autoLoad from "@fastify/autoload";
import fastifyCookie from "@fastify/cookie";
import httpProxy from "@fastify/http-proxy";
import fastifyJwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import { type FastifyReply, type FastifyRequest, fastify } from "fastify";
import { runMigrations } from "../db/migrate.js";
import {
	AGENTFLOW_API_SERVER_PORT,
	AGENTFLOW_JWT_SECRET,
} from "../global.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

function createAPIServer() {
	const app = fastify({ logger: true });

	// Run DB migrations
	runMigrations();

	// Plugins
	app.register(fastifyCookie);
	app.register(fastifyJwt, {
		secret: AGENTFLOW_JWT_SECRET,
		cookie: { cookieName: "token", signed: false },
	});

	/**
	 * 1. API Routes
	 */
	app.register(autoLoad, {
		dir: join(__dirname, "routes"),
		options: { prefix: "/api" },
	});

	/**
	 * 2. Health check
	 */
	app.get("/health", async () => ({ status: "ok" }));

	/**
	 * 3. Frontend handling
	 */
	if (isDev) {
		app.register(httpProxy, {
			upstream: "http://localhost:5173",
			prefix: "/",
			rewritePrefix: "/",
		});
	} else {
		app.register(fastifyStatic, {
			root: join(__dirname, "..", "ui"),
			prefix: "/",
			wildcard: false,
		});

		app.setNotFoundHandler(async (req: FastifyRequest, reply: FastifyReply) => {
			if (req.url.startsWith("/api")) {
				return reply.code(404).send({ error: "Not found" });
			}
			return reply.sendFile("index.html");
		});
	}

	return {
		start: async () => {
			try {
				await app.listen({
					port: AGENTFLOW_API_SERVER_PORT,
					host: "0.0.0.0",
				});
				app.log.info(
					`API server running on http://localhost:${AGENTFLOW_API_SERVER_PORT}`,
				);
			} catch (err: unknown) {
				if ((err as { code?: string })?.code === "EADDRINUSE") {
					app.log.error(`Port ${AGENTFLOW_API_SERVER_PORT} is already in use.`);
				} else {
					app.log.error(err);
				}
				throw err;
			}
		},
		stop: async () => {
			await app.close();
			app.log.info("API server stopped.");
		},
	};
}

export { createAPIServer };
