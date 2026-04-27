import type { WorkflowDefinition } from "@mdirshadengineer/agentflow-core";
import {
	defaultNodeRegistry,
	WorkflowExecutor,
} from "@mdirshadengineer/agentflow-core";
import { eq } from "drizzle-orm";
import { getDb, workflows } from "../db/index.js";
import { POLL_INTERVAL_MS } from "../global.config.js";
import { SqliteRunLogger } from "./sqlite-run-logger.js";
import { SqliteWorkflowQueue } from "./sqlite-workflow-queue.js";

export type {
	WorkflowDefinition,
	WorkflowStep,
} from "@mdirshadengineer/agentflow-core";

// ── Worker service ────────────────────────────────────────────────────────────

/**
 * Creates a worker service that polls for queued workflow runs and executes
 * them using WorkflowExecutor from @mdirshadengineer/agentflow-core.
 *
 * Returns a { start, stop } service object compatible with
 * AgentflowRuntime.register().
 */
function createWorker() {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	// Prevent the same run from being picked up twice while in-flight
	const inFlight = new Set<string>();

	const queue = new SqliteWorkflowQueue();
	const logger = new SqliteRunLogger();
	const executor = new WorkflowExecutor(defaultNodeRegistry, logger);

	async function processRun(runId: string, workflowId: string): Promise<void> {
		await queue.markRunning(runId);

		const db = getDb();
		const workflow = db
			.select()
			.from(workflows)
			.where(eq(workflows.id, workflowId))
			.get();

		if (!workflow) {
			await queue.markDone(runId, "failed", {
				error: `Workflow ${workflowId} not found`,
			});
			return;
		}

		let definition: WorkflowDefinition = {};
		try {
			definition = JSON.parse(workflow.definition) as WorkflowDefinition;
		} catch {
			await queue.markDone(runId, "failed", {
				error: `Workflow ${workflowId} has an invalid definition (not valid JSON)`,
			});
			return;
		}

		try {
			const finalStatus = await executor.run(runId, workflowId, definition);
			await queue.markDone(runId, finalStatus, {
				steps: (definition.steps ?? []).map((s) => s.name),
			});
		} catch (err) {
			await queue.markDone(runId, "failed", {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function poll() {
		const queued = await queue.poll();

		await Promise.all(
			queued
				.filter((run) => !inFlight.has(run.id))
				.map(async (run) => {
					inFlight.add(run.id);
					try {
						await processRun(run.id, run.workflowId);
					} finally {
						inFlight.delete(run.id);
					}
				}),
		);
	}

	function scheduleNext() {
		if (!running) return;
		timer = setTimeout(async () => {
			try {
				await poll();
			} catch (err) {
				// Errors inside poll() are handled per-run; log unexpected top-level
				// errors so the worker loop keeps running without losing visibility.
				console.error("[worker] Unexpected poll error:", err);
			}
			scheduleNext();
		}, POLL_INTERVAL_MS);
	}

	return {
		start: async () => {
			running = true;
			scheduleNext();
		},
		stop: async () => {
			running = false;
			if (timer !== undefined) {
				clearTimeout(timer);
				timer = undefined;
			}
		},
	};
}

export { createWorker };
