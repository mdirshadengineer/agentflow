import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * No-operation executor.
 * Returns immediately with an empty data payload and a success status.
 */
export const noopExecutor: NodeExecutor = async (_input, context) => ({
	data: {},
	status: "success",
	logs: `noop executed (runId: ${context.runId})`,
});
