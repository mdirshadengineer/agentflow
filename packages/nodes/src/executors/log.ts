import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * Log executor.
 *
 * Config fields (from {@link WorkflowStep.config}):
 * - `message` {string} — required — message to emit in the step log
 */
export const logExecutor: NodeExecutor = async (input, context) => {
	const { message } = input.data;

	if (typeof message !== "string") {
		return {
			data: {},
			status: "failed",
			logs: `log: "message" config field must be a string (runId: ${context.runId})`,
		};
	}

	return {
		data: { message },
		status: "success",
		logs: message,
	};
};
