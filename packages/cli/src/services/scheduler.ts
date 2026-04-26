import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { getDb, workflowRuns, workflows } from "../db/index.js";
import type { WorkflowDefinition } from "./worker.js";

// ── Scheduler service ────────────────────────────────────────────────────────

/**
 * Creates a scheduler service that reads cron-based trigger definitions from
 * all workflows and uses `node-cron` to enqueue new runs at the configured
 * times.  Returns a `{ start, stop }` service object compatible with
 * `AgentflowRuntime.register()`.
 *
 * Scheduled tasks are refreshed every minute so that workflows created or
 * updated after the scheduler starts are picked up automatically.
 */
function createScheduler() {
	// Map of "<workflowId>:<cronExpr>" -> ScheduledTask
	const tasks = new Map<string, cron.ScheduledTask>();
	// Refresh task — re-reads workflow definitions periodically
	let refreshTask: cron.ScheduledTask | undefined;

	function enqueueRun(workflowId: string) {
		const db = getDb();
		db.insert(workflowRuns)
			.values({
				id: randomUUID(),
				workflowId,
				status: "queued",
			})
			.run();
	}

	function parseDefinition(raw: string): WorkflowDefinition {
		try {
			return JSON.parse(raw) as WorkflowDefinition;
		} catch {
			return {};
		}
	}

	function syncSchedules() {
		const db = getDb();
		const allWorkflows = db.select().from(workflows).all();

		const desired = new Map<string, string>(); // key -> cronExpr

		for (const wf of allWorkflows) {
			const definition = parseDefinition(wf.definition);
			for (const trigger of definition.triggers ?? []) {
				if (trigger.type === "cron" && cron.validate(trigger.cron)) {
					const key = `${wf.id}:${trigger.cron}`;
					desired.set(key, trigger.cron);
				}
			}
		}

		// Stop tasks that are no longer needed
		for (const [key, task] of tasks) {
			if (!desired.has(key)) {
				task.stop();
				tasks.delete(key);
			}
		}

		// Start new tasks
		for (const [key, cronExpr] of desired) {
			if (!tasks.has(key)) {
				// key format is "<workflowId>:<cronExpr>"; the workflowId itself
				// never contains a colon because it is a UUID.
				const workflowId = key.substring(0, key.indexOf(":"));
				const task = cron.schedule(cronExpr, () => {
					enqueueRun(workflowId);
				});
				tasks.set(key, task);
			}
		}
	}

	return {
		start: async () => {
			// Initial sync
			syncSchedules();

			// Refresh every minute to pick up new / updated workflow schedules
			refreshTask = cron.schedule("* * * * *", () => {
				syncSchedules();
			});
		},
		stop: async () => {
			// Stop the refresh task
			if (refreshTask) {
				refreshTask.stop();
				refreshTask = undefined;
			}

			// Stop all scheduled workflow tasks
			for (const task of tasks.values()) {
				task.stop();
			}
			tasks.clear();
		},
	};
}

export { createScheduler };
