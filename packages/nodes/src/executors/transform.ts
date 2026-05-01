import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * Transform executor.
 *
 * Evaluates a user-supplied JavaScript expression in a sandboxed Function
 * scope.  The expression has access to:
 * - `output`          — the data from the most-recently completed step (or
 *                       the step named by config.fromStep)
 * - `previousOutputs` — a map of all prior step outputs keyed by step name
 *
 * Config fields:
 * - `expression` {string}  — required — JS expression whose return value
 *                             becomes `result`
 * - `fromStep`   {string}  — optional — step name to use as `output`
 */
export const transformExecutor: NodeExecutor = async (input, context) => {
	const { expression, fromStep } = input.data;

	if (typeof expression !== "string" || expression.trim() === "") {
		return {
			data: {},
			status: "failed",
			logs: `transform: "expression" config field is required (runId: ${context.runId})`,
		};
	}

	// Resolve the `output` binding
	let output: Record<string, unknown> = {};
	if (typeof fromStep === "string" && fromStep in input.previousOutputs) {
		output = input.previousOutputs[fromStep]?.data ?? {};
	} else {
		const keys = Object.keys(input.previousOutputs);
		const lastKey = keys[keys.length - 1];
		if (lastKey !== undefined) {
			output = input.previousOutputs[lastKey]?.data ?? {};
		}
	}

	const previousOutputs = input.previousOutputs;

	let result: unknown;
	try {
		// eslint-disable-next-line no-new-func
		const fn = new Function(
			"output",
			"previousOutputs",
			`return (${expression});`,
		);
		result = fn(output, previousOutputs) as unknown;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			data: {},
			status: "failed",
			logs: `transform: expression threw an error — ${message} (runId: ${context.runId})`,
		};
	}

	return {
		data: { result },
		status: "success",
		logs: `transform: expression evaluated successfully — result type: ${typeof result} (runId: ${context.runId})`,
	};
};
