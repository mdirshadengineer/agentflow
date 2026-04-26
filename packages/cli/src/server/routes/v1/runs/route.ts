import { and, desc, eq, inArray } from "drizzle-orm";
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

function serializeRun(row: typeof workflowRuns.$inferSelect) {
	return {
		...row,
		output: parseJson(row.output),
	};
}

export default async function runsRoutes(fastify: FastifyInstance) {
	// GET /api/v1/runs — list recent runs across all user workflows
	fastify.get(
		"/",
		{ preHandler: requireAuth },
		async (request: FastifyRequest, reply: FastifyReply) => {
			const { userId } = request.user as JWTPayload;
			const db = getDb();

			const userWorkflows = db
				.select({ id: workflows.id })
				.from(workflows)
				.where(eq(workflows.ownerId, userId))
				.all();

			if (userWorkflows.length === 0) return reply.send([]);

			const ids = userWorkflows.map((w) => w.id);

			const runs = db
				.select()
				.from(workflowRuns)
				.where(inArray(workflowRuns.workflowId, ids))
				.orderBy(desc(workflowRuns.startedAt))
				.limit(20)
				.all();

			return reply.send(runs.map(serializeRun));
		},
	);

	// GET /api/v1/runs/:id — get a specific run with steps
	fastify.get<{ Params: { id: string } }>(
		"/:id",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const run = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.id, id))
				.get();
			if (!run) return reply.code(404).send({ error: "Run not found" });

			const workflow = db
				.select()
				.from(workflows)
				.where(
					and(eq(workflows.id, run.workflowId), eq(workflows.ownerId, userId)),
				)
				.get();
			if (!workflow) return reply.code(403).send({ error: "Forbidden" });

			const steps = db
				.select()
				.from(workflowRunSteps)
				.where(eq(workflowRunSteps.runId, id))
				.all();

			return reply.send({ ...serializeRun(run), steps });
		},
	);

	// GET /api/v1/runs/:id/stream — SSE live log stream
	fastify.get<{ Params: { id: string } }>(
		"/:id/stream",
		{ preHandler: requireAuth },
		async (request, reply) => {
			const { userId } = request.user as JWTPayload;
			const { id } = request.params;
			const db = getDb();

			const run = db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.id, id))
				.get();
			if (!run) return reply.code(404).send({ error: "Run not found" });

			const workflow = db
				.select()
				.from(workflows)
				.where(
					and(eq(workflows.id, run.workflowId), eq(workflows.ownerId, userId)),
				)
				.get();
			if (!workflow) return reply.code(403).send({ error: "Forbidden" });

			// Take over the raw HTTP connection for SSE
			reply.hijack();
			const raw = reply.raw;

			raw.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			});

			const send = (event: string, data: unknown) => {
				if (!raw.writableEnded) {
					raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
				}
			};

			// Send initial snapshot
			const initialSteps = db
				.select()
				.from(workflowRunSteps)
				.where(eq(workflowRunSteps.runId, id))
				.all();
			send("snapshot", { run: serializeRun(run), steps: initialSteps });

			// If already in a terminal state, close immediately
			if (run.status === "success" || run.status === "failed") {
				send("done", { status: run.status });
				raw.end();
				return;
			}

			let timer: ReturnType<typeof setInterval> | undefined;

			const cleanup = () => {
				if (timer !== undefined) {
					clearInterval(timer);
					timer = undefined;
				}
			};

			await new Promise<void>((resolve) => {
				request.raw.on("close", () => {
					cleanup();
					resolve();
				});

				timer = setInterval(() => {
					if (raw.writableEnded) {
						cleanup();
						resolve();
						return;
					}

					const currentRun = db
						.select()
						.from(workflowRuns)
						.where(eq(workflowRuns.id, id))
						.get();

					if (!currentRun) {
						cleanup();
						raw.end();
						resolve();
						return;
					}

					const steps = db
						.select()
						.from(workflowRunSteps)
						.where(eq(workflowRunSteps.runId, id))
						.all();

					send("update", { run: serializeRun(currentRun), steps });

					if (
						currentRun.status === "success" ||
						currentRun.status === "failed"
					) {
						send("done", { status: currentRun.status });
						cleanup();
						raw.end();
						resolve();
					}
				}, 500);
			});
		},
	);
}
