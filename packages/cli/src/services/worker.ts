import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
	getDb,
	workflowRunSteps,
	workflowRuns,
	workflows,
} from "../db/index.js";
import { POLL_INTERVAL_MS } from "../global.config.js";

// ── Workflow definition types ────────────────────────────────────────────────

export interface WorkflowStep {
	/** Unique name used to identify the step and as a dependency reference. */
	name: string;
	/** Step type — determines how the step is executed. */
	type: string;
	/** Type-specific configuration (e.g. shell command, HTTP URL, …). */
	config?: Record<string, unknown>;
	/** Names of steps that must complete successfully before this step runs. */
	dependsOn?: string[];
}

export interface WorkflowDefinition {
	steps?: WorkflowStep[];
	triggers?: Array<{ type: "cron"; cron: string }>;
}

// ── Step executor ────────────────────────────────────────────────────────────

/**
 * Execute a single step and return its log output.
 * Extend this function to add real step-type implementations.
 */
async function executeStep(step: WorkflowStep): Promise<string> {
	switch (step.type) {
		case "noop":
			return `Step "${step.name}" (noop) completed.`;

		default:
			// Unknown step types are treated as no-ops to remain forward-compatible.
			return `Step "${step.name}" (type: ${step.type}) executed with config: ${JSON.stringify(step.config ?? {})}`;
	}
}

// ── DAG execution ────────────────────────────────────────────────────────────

/**
 * Execute all steps in the workflow DAG respecting `dependsOn` edges.
 * Steps whose dependencies are all satisfied run concurrently.
 *
 * @returns overall status ("success" | "failed") and per-step results
 */
async function executeDAG(
	runId: string,
	steps: WorkflowStep[],
): Promise<"success" | "failed"> {
	const db = getDb();
	const now = () => new Date();

	// Track completed / failed steps by name
	const completed = new Set<string>();
	const failed = new Set<string>();

	// Map for quick lookup
	const stepMap = new Map<string, WorkflowStep>(
		steps.map((s) => [s.name, s]),
	);

	// Create a DB record for each step so they are visible immediately
	for (const step of steps) {
		db.insert(workflowRunSteps)
			.values({
				id: randomUUID(),
				runId,
				stepName: step.name,
				status: "pending",
			})
			.run();
	}

	// Kahn's-style wave execution: keep running waves until nothing is left
	const remaining = new Set<string>(stepMap.keys());

	while (remaining.size > 0) {
		// Collect steps that are ready (all dependsOn satisfied, not yet failed)
		const ready: WorkflowStep[] = [];
		for (const name of remaining) {
			const step = stepMap.get(name) as WorkflowStep;
			const deps = step.dependsOn ?? [];
			const depFailed = deps.some((d) => failed.has(d));
			const depSatisfied = deps.every((d) => completed.has(d));

			if (depFailed) {
				// Skip steps whose dependencies failed — mark them skipped
				failed.add(name);
				remaining.delete(name);
				db.update(workflowRunSteps)
					.set({
						status: "skipped",
						logs: `Skipped because dependency failed.`,
						startedAt: now(),
						finishedAt: now(),
					})
					.where(
						and(
							eq(workflowRunSteps.runId, runId),
							eq(workflowRunSteps.stepName, name),
						),
					)
					.run();
			} else if (depSatisfied) {
				ready.push(step);
			}
		}

		if (ready.length === 0) {
			// No step is ready — either we're done or there's a circular dependency.
			break;
		}

		// Execute ready steps in parallel
		await Promise.all(
			ready.map(async (step) => {
				remaining.delete(step.name);

				const stepStarted = now();
				db.update(workflowRunSteps)
					.set({ status: "running", startedAt: stepStarted })
					.where(
						and(
							eq(workflowRunSteps.runId, runId),
							eq(workflowRunSteps.stepName, step.name),
						),
					)
					.run();

				try {
					const logs = await executeStep(step);
					completed.add(step.name);
					db.update(workflowRunSteps)
						.set({
							status: "success",
							logs,
							finishedAt: now(),
						})
						.where(
							and(
								eq(workflowRunSteps.runId, runId),
								eq(workflowRunSteps.stepName, step.name),
							),
						)
						.run();
				} catch (err) {
					failed.add(step.name);
					db.update(workflowRunSteps)
						.set({
							status: "failed",
							logs: err instanceof Error ? err.message : String(err),
							finishedAt: now(),
						})
						.where(
							and(
								eq(workflowRunSteps.runId, runId),
								eq(workflowRunSteps.stepName, step.name),
							),
						)
						.run();
				}
			}),
		);
	}

	return failed.size === 0 ? "success" : "failed";
}

// ── Run processor ────────────────────────────────────────────────────────────

async function processRun(runId: string, workflowId: string): Promise<void> {
	const db = getDb();
	const now = () => new Date();

	// Mark the run as running
	db.update(workflowRuns)
		.set({ status: "running", startedAt: now() })
		.where(eq(workflowRuns.id, runId))
		.run();

	try {
		const workflow = db
			.select()
			.from(workflows)
			.where(eq(workflows.id, workflowId))
			.get();

		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		let definition: WorkflowDefinition = {};
		try {
			definition = JSON.parse(workflow.definition) as WorkflowDefinition;
		} catch {
			throw new Error(
				`Workflow ${workflowId} has an invalid definition (not valid JSON)`,
			);
		}

		const steps = definition.steps ?? [];
		const finalStatus = await executeDAG(runId, steps);

		db.update(workflowRuns)
			.set({
				status: finalStatus,
				finishedAt: now(),
				output: JSON.stringify({ steps: steps.map((s) => s.name) }),
			})
			.where(eq(workflowRuns.id, runId))
			.run();
	} catch (err) {
		db.update(workflowRuns)
			.set({
				status: "failed",
				finishedAt: now(),
				output: JSON.stringify({
					error: err instanceof Error ? err.message : String(err),
				}),
			})
			.where(eq(workflowRuns.id, runId))
			.run();
	}
}

// ── Worker service ───────────────────────────────────────────────────────────

/**
 * Creates a worker service that polls `workflow_runs` for queued jobs and
 * executes them.  Returns a `{ start, stop }` service object compatible with
 * `AgentflowRuntime.register()`.
 */
function createWorker() {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	// Track in-flight run IDs so we don't start the same run twice
	const inFlight = new Set<string>();

	async function poll() {
		const db = getDb();
		const queued = db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.status, "queued"))
			.all();

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
