import { resolveExpressions } from "./expression-resolver.js";
import type { NodeRegistry } from "./node-registry.js";
import type { RunLogger } from "./run-logger.js";
import type {
	ExecutionContext,
	NodeInput,
	NodeOutput,
	WorkflowDefinition,
	WorkflowStep,
} from "./types.js";

/** Delay helper used by the retry logic. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single step, honouring the step's retry policy and optional
 * execution timeout.  Returns a {@link NodeOutput} — never throws.
 */
async function executeWithRetry(
	registry: NodeRegistry,
	step: WorkflowStep,
	input: NodeInput,
	context: ExecutionContext,
): Promise<NodeOutput> {
	const { maxAttempts = 1, delayMs = 0, backoff = "linear" } =
		step.retry ?? {};

	let lastOutput: NodeOutput | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			let output: NodeOutput;

			if (step.timeout && step.timeout > 0) {
				const timeoutPromise: Promise<NodeOutput> = new Promise(
					(_resolve, reject) =>
						setTimeout(
							() => reject(new Error(`Step timed out after ${step.timeout}ms`)),
							step.timeout,
						),
				);
				output = await Promise.race([
					registry.execute(step.type, input, context),
					timeoutPromise,
				]);
			} else {
				output = await registry.execute(step.type, input, context);
			}

			if (output.status === "success") return output;

			// Executor returned a failed status — eligible for retry
			lastOutput = output;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			lastOutput = {
				data: {},
				status: "failed",
				logs: message,
			};
		}

		if (attempt < maxAttempts) {
			const wait =
				backoff === "exponential"
					? delayMs * 2 ** (attempt - 1)
					: delayMs;
			if (wait > 0) await sleep(wait);
		}
	}

	return lastOutput ?? { data: {}, status: "failed", logs: "Unknown error" };
}

/**
 * Executes a workflow definition using a DAG-based step runner.
 *
 * Steps are executed in Kahn's-algorithm waves: all steps whose
 * dependencies are satisfied run concurrently. Steps whose dependencies
 * have failed are automatically skipped (unless the dependency has
 * `continueOnFail: true`).
 *
 * All state mutations (step status, logs) are delegated to the injected
 * RunLogger so that this class remains storage-agnostic.
 */
export class WorkflowExecutor {
	constructor(
		private readonly registry: NodeRegistry,
		private readonly logger: RunLogger,
	) {}

	/**
	 * Execute a full workflow run.
	 *
	 * @param runId       - The run record ID (already persisted by the caller).
	 * @param workflowId  - The ID of the workflow being executed.
	 * @param definition  - The parsed workflow definition.
	 * @returns The final run status: "success" if all steps passed, "failed" otherwise.
	 */
	async run(
		runId: string,
		workflowId: string,
		definition: WorkflowDefinition,
	): Promise<"success" | "failed"> {
		const steps = definition.steps ?? [];
		const { status } = await this.executeDAG(runId, workflowId, steps);
		return status;
	}

	/**
	 * Execute a workflow and return both the final status and all step outputs.
	 *
	 * @param runId       - The run record ID (already persisted by the caller).
	 * @param workflowId  - The ID of the workflow being executed.
	 * @param definition  - The parsed workflow definition.
	 */
	async runWithOutputs(
		runId: string,
		workflowId: string,
		definition: WorkflowDefinition,
	): Promise<{ status: "success" | "failed"; outputs: Map<string, NodeOutput> }> {
		const steps = definition.steps ?? [];
		return this.executeDAG(runId, workflowId, steps);
	}

	// ── Private DAG runner ──────────────────────────────────────────────────────

	private async executeDAG(
		runId: string,
		workflowId: string,
		steps: WorkflowStep[],
	): Promise<{ status: "success" | "failed"; outputs: Map<string, NodeOutput> }> {
		const context: ExecutionContext = { runId, workflowId };

		// Completed and failed step names, plus their accumulated outputs
		const completed = new Set<string>();
		const failed = new Set<string>();
		const outputs = new Map<string, NodeOutput>();

		const stepMap = new Map<string, WorkflowStep>(
			steps.map((s) => [s.name, s]),
		);

		// Initialise all step records so they are visible immediately
		for (const step of steps) {
			await this.logger.initStep(runId, step.name);
		}

		// Kahn's-style wave execution
		const remaining = new Set<string>(stepMap.keys());

		while (remaining.size > 0) {
			// Collect steps that are ready to execute this wave
			const ready: WorkflowStep[] = [];

			for (const name of remaining) {
				const step = stepMap.get(name) as WorkflowStep;
				const deps = step.dependsOn ?? [];

				// A dependency blocks this step only when it failed AND
				// did not set continueOnFail.
				const depFailed = deps.some((d) => {
					if (!failed.has(d)) return false;
					const depStep = stepMap.get(d);
					return !depStep?.continueOnFail;
				});
				const depSatisfied = deps.every(
					(d) => completed.has(d) || failed.has(d),
				);

				if (depFailed) {
					failed.add(name);
					remaining.delete(name);
					await this.logger.skipStep(
						runId,
						name,
						"Skipped because a dependency failed.",
					);
				} else if (depSatisfied) {
					ready.push(step);
				}
			}

			if (ready.length === 0) {
				// Guard against circular dependencies — identify stuck steps
				if (remaining.size > 0) {
					const stuckNames = Array.from(remaining).join(", ");
					for (const name of remaining) {
						failed.add(name);
						await this.logger.skipStep(
							runId,
							name,
							`Skipped: circular or unresolvable dependency detected among: ${stuckNames}`,
						);
					}
					remaining.clear();
				}
				break;
			}

			// Execute ready steps in parallel
			await Promise.all(
				ready.map(async (step) => {
					remaining.delete(step.name);
					await this.logger.startStep(runId, step.name);

					// Build the previous-outputs snapshot for this step
					const previousOutputs: Record<string, NodeOutput> = {};
					for (const [name, output] of outputs) {
						previousOutputs[name] = output;
					}

					// Resolve {{ steps.<id>.output }} expressions in config before
					// passing the config to the executor.
					const resolvedConfig = resolveExpressions(
						step.config ?? {},
						previousOutputs,
					);

					const input: NodeInput = {
						data: resolvedConfig,
						previousOutputs,
						runId,
						workflowId,
					};

					const output = await executeWithRetry(
						this.registry,
						step,
						input,
						context,
					);

					outputs.set(step.name, output);

					if (output.status === "failed") {
						failed.add(step.name);
						await this.logger.failStep(runId, step.name, output.logs);
					} else {
						completed.add(step.name);
						await this.logger.completeStep(runId, step.name, output.logs);
					}
				}),
			);
		}

		const status = failed.size === 0 ? "success" : "failed";
		return { status, outputs };
	}
}
