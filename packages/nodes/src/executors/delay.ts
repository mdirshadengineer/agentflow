import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * Delay executor.
 *
 * Config fields (from {@link WorkflowStep.config}):
 * - `ms` {number} — required — milliseconds to wait (non-negative)
 */
export const delayExecutor: NodeExecutor = async (input, context) => {
	const { ms } = input.data;

	if (typeof ms !== "number" || ms < 0) {
		return {
			data: {},
			status: "failed",
			logs: `delay: "ms" config field must be a non-negative number (runId: ${context.runId})`,
		};
	}

	await new Promise<void>((resolve) => setTimeout(resolve, ms));

	return {
		data: { waited: ms },
		status: "success",
		logs: `delay: waited ${ms}ms (runId: ${context.runId})`,
	};
};
