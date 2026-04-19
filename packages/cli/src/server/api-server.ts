import { fastify } from "fastify";
import { AGENTFLOW_API_SERVER_PORT } from "../global.config.js";

function createAPIServer() {
	const app = fastify({ logger: true });

	app.get("/api/hello", async (_request, _reply) => {
		return { message: "Hello, World!" };
	});
	return {
		start: async () => {
			try {
				await app.listen({ port: AGENTFLOW_API_SERVER_PORT });
				console.log(
					`API server is running on http://localhost:${AGENTFLOW_API_SERVER_PORT}`,
				);
			} catch (err: unknown) {
				if ((err as { code?: string })?.code === "EADDRINUSE") {
					app.log.error(
						`Port ${AGENTFLOW_API_SERVER_PORT} is already in use. ` +
							`Stop the existing process or configure a different port.`,
					);
				} else {
					app.log.error(err);
				}

				// Important: allow higher-level orchestrator (your process manager)
				// to decide lifecycle instead of hard exiting here if possible.
				throw err;
			}
		},
		stop: async () => {
			await app.close();
			console.log("API server has been stopped.");
		},
	};
}

export { createAPIServer };
