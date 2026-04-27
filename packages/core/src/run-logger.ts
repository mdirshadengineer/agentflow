import type { LogEvent, StepLog } from "./types.js";

/**
 * Interface for tracking step-level execution logs during workflow runs.
 * Implementations write to SQLite, memory, files, or any other backend.
 */
export interface RunLogger {
	/** Record that a step has been initialised (status: pending). */
	initStep(runId: string, stepName: string): Promise<void>;

	/** Record that a step has started executing (status: running). */
	startStep(runId: string, stepName: string): Promise<void>;

	/** Record that a step completed successfully (status: success). */
	completeStep(runId: string, stepName: string, logs: string): Promise<void>;

	/** Record that a step failed (status: failed). */
	failStep(runId: string, stepName: string, logs: string): Promise<void>;

	/** Record that a step was skipped because a dependency failed (status: skipped). */
	skipStep(runId: string, stepName: string, reason: string): Promise<void>;

	/** Retrieve all recorded step logs for a given run. */
	getLogsForRun(runId: string): Promise<StepLog[]>;

	/** Yield log events for a run as an async stream (used for SSE). */
	streamLogsForRun(runId: string): AsyncGenerator<LogEvent>;
}

/**
 * In-memory RunLogger — suitable for tests and ephemeral environments.
 */
export class InMemoryRunLogger implements RunLogger {
	private readonly steps = new Map<
		string,
		Map<
			string,
			{
				status: "pending" | "running" | "success" | "failed" | "skipped";
				logs: string | null;
				startedAt: Date | null;
				finishedAt: Date | null;
			}
		>
	>();

	private getRunSteps(runId: string) {
		let runSteps = this.steps.get(runId);
		if (!runSteps) {
			runSteps = new Map();
			this.steps.set(runId, runSteps);
		}
		return runSteps;
	}

	async initStep(runId: string, stepName: string): Promise<void> {
		const runSteps = this.getRunSteps(runId);
		runSteps.set(stepName, {
			status: "pending",
			logs: null,
			startedAt: null,
			finishedAt: null,
		});
	}

	async startStep(runId: string, stepName: string): Promise<void> {
		const runSteps = this.getRunSteps(runId);
		const existing = runSteps.get(stepName);
		runSteps.set(stepName, {
			logs: existing?.logs ?? null,
			finishedAt: existing?.finishedAt ?? null,
			status: "running",
			startedAt: new Date(),
		});
	}

	async completeStep(
		runId: string,
		stepName: string,
		logs: string,
	): Promise<void> {
		const runSteps = this.getRunSteps(runId);
		const existing = runSteps.get(stepName);
		runSteps.set(stepName, {
			startedAt: existing?.startedAt ?? null,
			status: "success",
			logs,
			finishedAt: new Date(),
		});
	}

	async failStep(runId: string, stepName: string, logs: string): Promise<void> {
		const runSteps = this.getRunSteps(runId);
		const existing = runSteps.get(stepName);
		runSteps.set(stepName, {
			startedAt: existing?.startedAt ?? null,
			status: "failed",
			logs,
			finishedAt: new Date(),
		});
	}

	async skipStep(
		runId: string,
		stepName: string,
		reason: string,
	): Promise<void> {
		const runSteps = this.getRunSteps(runId);
		runSteps.set(stepName, {
			status: "skipped",
			logs: reason,
			startedAt: new Date(),
			finishedAt: new Date(),
		});
	}

	async getLogsForRun(runId: string): Promise<StepLog[]> {
		const runSteps = this.steps.get(runId);
		if (!runSteps) return [];
		return Array.from(runSteps.entries()).map(([stepName, step]) => ({
			stepName,
			status: step.status,
			logs: step.logs,
			startedAt: step.startedAt,
			finishedAt: step.finishedAt,
		}));
	}

	async *streamLogsForRun(runId: string): AsyncGenerator<LogEvent> {
		const logs = await this.getLogsForRun(runId);
		for (const log of logs) {
			const event: LogEvent = {
				type: "step_complete",
				runId,
				stepName: log.stepName,
				timestamp: log.finishedAt ?? new Date(),
				status: log.status,
			};
			if (log.logs !== null) {
				event.logs = log.logs;
			}
			yield event;
		}
	}
}
