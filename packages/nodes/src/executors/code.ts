import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * Code executor.
 *
 * Config fields (from {@link WorkflowStep.config}):
 * - `code` {string} — required — a JavaScript function body (with `return`)
 *   that has access to `input` (the previous-outputs map) and must return a
 *   plain object.
 *
 * Example:
 *   `return { count: input.fetchData.body.length, first: input.fetchData.body[0] }`
 */
export const codeExecutor: NodeExecutor = async (input, context) => {
	const { code } = input.data;

	if (typeof code !== "string" || code.trim() === "") {
		return {
			data: {},
			status: "failed",
			logs: `code: "code" config field is required (runId: ${context.runId})`,
		};
	}

	let result: unknown;
	try {
		// eslint-disable-next-line no-new-func
		const fn = new Function("input", code);
		result = await Promise.resolve(fn(input.previousOutputs));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			data: {},
			status: "failed",
			logs: `code: execution failed — ${message} (runId: ${context.runId})`,
		};
	}

	if (result === null || typeof result !== "object" || Array.isArray(result)) {
		return {
			data: {},
			status: "failed",
			logs: `code: snippet must return a plain object, got ${Array.isArray(result) ? "array" : typeof result} (runId: ${context.runId})`,
		};
	}

	return {
		data: result as Record<string, unknown>,
		status: "success",
		logs: `code: executed successfully (runId: ${context.runId})`,
	};
};
