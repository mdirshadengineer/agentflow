import type { FastifyInstance } from "fastify";
import { getDb, workflows } from "../../../../db/index.js";
import { SqliteWorkflowQueue } from "../../../../services/sqlite-workflow-queue.js";

const queue = new SqliteWorkflowQueue();

export default async function webhooksRoutes(fastify: FastifyInstance) {
	// POST /api/v1/webhooks/:path — receive a webhook trigger (no auth required)
	// The :path parameter matches the webhookPath configured on a workflow's
	// trigger node.  All workflows whose definition contains a webhook trigger
	// with a matching path are enqueued.
	fastify.post<{ Params: { path: string } }>(
		"/:path",
		async (request, reply) => {
			const { path } = request.params;
			const db = getDb();

			// Scan all workflows for a matching webhook trigger.
			// SQLite does not support JSON path queries without extensions, so we
			// filter in application memory.  The dataset is small enough that this
			// is acceptable.
			const allWorkflows = db.select().from(workflows).all();

			const matched: string[] = [];

			for (const workflow of allWorkflows) {
				let definition: unknown;
				try {
					definition = JSON.parse(workflow.definition);
				} catch {
					continue;
				}

				if (hasWebhookTrigger(definition, path)) {
					const runId = await queue.enqueue(workflow.id, request.body);
					matched.push(runId);
				}
			}

			if (matched.length === 0) {
				return reply.code(404).send({ error: "No workflow found for this webhook path" });
			}

			return reply.code(202).send({ enqueued: matched });
		},
	);
}

/**
 * Returns true when the workflow definition contains a webhook trigger whose
 * configured path matches the inbound webhook path segment.
 *
 * Supports both the canvas format (nodes[]) and the steps format (steps[]).
 */
function hasWebhookTrigger(definition: unknown, path: string): boolean {
	if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
		return false;
	}

	const def = definition as Record<string, unknown>;

	// Canvas format: look for a trigger node with triggerType "webhook"
	if (Array.isArray(def.nodes)) {
		return (def.nodes as Array<Record<string, unknown>>).some((node) => {
			const data = node.data as Record<string, unknown> | undefined;
			return (
				node.type === "trigger" &&
				data?.triggerType === "webhook" &&
				data?.webhookPath === path
			);
		});
	}

	return false;
}
