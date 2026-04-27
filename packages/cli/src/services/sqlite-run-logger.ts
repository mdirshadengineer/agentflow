import { randomUUID } from "node:crypto";
import type {
	LogEvent,
	RunLogger,
	StepLog,
	StepStatus,
} from "@mdirshadengineer/agentflow-core";
import { and, eq } from "drizzle-orm";
import { getDb, workflowRunSteps } from "../db/index.js";

/**
 * SQLite-backed RunLogger that uses the existing workflow_run_steps table.
 */
export class SqliteRunLogger implements RunLogger {
	async initStep(runId: string, stepName: string): Promise<void> {
		const db = getDb();
		db.insert(workflowRunSteps)
			.values({
				id: randomUUID(),
				runId,
				stepName,
				status: "pending",
			})
			.run();
	}

	async startStep(runId: string, stepName: string): Promise<void> {
		const db = getDb();
		db.update(workflowRunSteps)
			.set({ status: "running", startedAt: new Date() })
			.where(
				and(
					eq(workflowRunSteps.runId, runId),
					eq(workflowRunSteps.stepName, stepName),
				),
			)
			.run();
	}

	async completeStep(
		runId: string,
		stepName: string,
		logs: string,
	): Promise<void> {
		const db = getDb();
		db.update(workflowRunSteps)
			.set({ status: "success", logs, finishedAt: new Date() })
			.where(
				and(
					eq(workflowRunSteps.runId, runId),
					eq(workflowRunSteps.stepName, stepName),
				),
			)
			.run();
	}

	async failStep(runId: string, stepName: string, logs: string): Promise<void> {
		const db = getDb();
		db.update(workflowRunSteps)
			.set({ status: "failed", logs, finishedAt: new Date() })
			.where(
				and(
					eq(workflowRunSteps.runId, runId),
					eq(workflowRunSteps.stepName, stepName),
				),
			)
			.run();
	}

	async skipStep(
		runId: string,
		stepName: string,
		reason: string,
	): Promise<void> {
		const db = getDb();
		db.update(workflowRunSteps)
			.set({
				status: "skipped",
				logs: reason,
				startedAt: new Date(),
				finishedAt: new Date(),
			})
			.where(
				and(
					eq(workflowRunSteps.runId, runId),
					eq(workflowRunSteps.stepName, stepName),
				),
			)
			.run();
	}

	async getLogsForRun(runId: string): Promise<StepLog[]> {
		const db = getDb();
		return db
			.select()
			.from(workflowRunSteps)
			.where(eq(workflowRunSteps.runId, runId))
			.all()
			.map((r) => ({
				stepName: r.stepName,
				status: r.status as StepStatus,
				logs: r.logs,
				startedAt: r.startedAt,
				finishedAt: r.finishedAt,
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
