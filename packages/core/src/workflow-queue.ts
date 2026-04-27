import type { QueuedRun, RunStatus } from "./types.js";

/**
 * Interface for workflow run queuing and lifecycle management.
 * Decouples the execution engine from the storage backend, enabling
 * drop-in swaps between SQLite, Redis, BullMQ, etc.
 */
export interface WorkflowQueue {
	/**
	 * Enqueue a new workflow run and return the generated run ID.
	 */
	enqueue(workflowId: string, triggerData?: unknown): Promise<string>;

	/**
	 * Return all runs currently in the "queued" state.
	 */
	poll(): Promise<QueuedRun[]>;

	/**
	 * Transition a run from "queued" to "running".
	 */
	markRunning(runId: string): Promise<void>;

	/**
	 * Mark a run as finished with the given terminal status and optional output.
	 */
	markDone(
		runId: string,
		status: Exclude<RunStatus, "queued" | "running">,
		output?: unknown,
	): Promise<void>;
}
