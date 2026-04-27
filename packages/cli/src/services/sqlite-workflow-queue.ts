import { randomUUID } from "node:crypto";
import type {
	QueuedRun,
	RunStatus,
	WorkflowQueue,
} from "@mdirshadengineer/agentflow-core";
import { eq } from "drizzle-orm";
import { getDb, workflowRuns } from "../db/index.js";

/**
 * SQLite-backed WorkflowQueue that uses the existing workflow_runs table.
 * Drop-in replacement for the previous inline polling logic in worker.ts.
 */
export class SqliteWorkflowQueue implements WorkflowQueue {
	async enqueue(workflowId: string, triggerData?: unknown): Promise<string> {
		const db = getDb();
		const id = randomUUID();
		db.insert(workflowRuns)
			.values({
				id,
				workflowId,
				status: "queued",
			})
			.run();
		if (triggerData !== undefined) {
			// Store trigger data in the output field until a dedicated column exists
			db.update(workflowRuns)
				.set({ output: JSON.stringify({ triggerData }) })
				.where(eq(workflowRuns.id, id))
				.run();
		}
		return id;
	}

	async poll(): Promise<QueuedRun[]> {
		const db = getDb();
		return db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.status, "queued"))
			.all()
			.map((r) => ({ id: r.id, workflowId: r.workflowId }));
	}

	async markRunning(runId: string): Promise<void> {
		const db = getDb();
		db.update(workflowRuns)
			.set({ status: "running", startedAt: new Date() })
			.where(eq(workflowRuns.id, runId))
			.run();
	}

	async markDone(
		runId: string,
		status: Exclude<RunStatus, "queued" | "running">,
		output?: unknown,
	): Promise<void> {
		const db = getDb();
		db.update(workflowRuns)
			.set({
				status,
				finishedAt: new Date(),
				output: output !== undefined ? JSON.stringify(output) : null,
			})
			.where(eq(workflowRuns.id, runId))
			.run();
	}
}
