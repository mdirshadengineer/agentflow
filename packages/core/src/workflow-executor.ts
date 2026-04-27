import type { NodeRegistry } from "./node-registry.js";
import type { RunLogger } from "./run-logger.js";
import type {
	ExecutionContext,
	NodeInput,
	NodeOutput,
	WorkflowDefinition,
	WorkflowStep,
} from "./types.js";

/**
 * Executes a workflow definition using a DAG-based step runner.
 *
 * Steps are executed in Kahn's-algorithm waves: all steps whose
 * dependencies are satisfied run concurrently. Steps whose dependencies
 * have failed are automatically skipped.
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
		return this.executeDAG(runId, workflowId, steps);
	}

	// ── Private DAG runner ──────────────────────────────────────────────────────

	private async executeDAG(
		runId: string,
		workflowId: string,
		steps: WorkflowStep[],
	): Promise<"success" | "failed"> {
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
				const depFailed = deps.some((d) => failed.has(d));
				const depSatisfied = deps.every((d) => completed.has(d));

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
				// Either we're done or there is a circular dependency — break to avoid infinite loop
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

					const input: NodeInput = {
						data: step.config ?? {},
						previousOutputs,
						runId,
						workflowId,
					};

					try {
						const output = await this.registry.execute(
							step.type,
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
					} catch (err) {
						failed.add(step.name);
						const message = err instanceof Error ? err.message : String(err);
						await this.logger.failStep(runId, step.name, message);
					}
				}),
			);
		}

		return failed.size === 0 ? "success" : "failed";
	}
}
