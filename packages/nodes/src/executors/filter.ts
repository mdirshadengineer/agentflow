import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * Filter executor.
 *
 * Evaluates a JavaScript condition.  The step *fails* when the condition is
 * falsy, blocking any downstream steps that depend on it.  Use it as a guard
 * or validation gate inside a workflow.
 *
 * Config fields:
 * - `expression` {string}  — required — JS expression evaluated in scope of
 *                             `{ output, previousOutputs }`
 * - `fromStep`   {string}  — optional — step whose output is bound to `output`
 * - `message`    {string}  — optional — failure message when condition is falsy
 */
export const filterExecutor: NodeExecutor = async (input, context) => {
	const { expression, fromStep, message } = input.data;

	if (typeof expression !== "string" || expression.trim() === "") {
		return {
			data: {},
			status: "failed",
			logs: `filter: "expression" config field is required (runId: ${context.runId})`,
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

	let passed: boolean;
	try {
		// eslint-disable-next-line no-new-func
		const fn = new Function("output", "previousOutputs", `return !!(${expression});`);
		passed = Boolean(fn(output, previousOutputs));
	} catch (err) {
		const errMessage = err instanceof Error ? err.message : String(err);
		return {
			data: {},
			status: "failed",
			logs: `filter: expression threw an error — ${errMessage} (runId: ${context.runId})`,
		};
	}

	if (!passed) {
		const failMsg =
			typeof message === "string" && message.trim()
				? message
				: `filter: condition not met — expression was falsy`;
		return {
			data: {},
			status: "failed",
			logs: `${failMsg} (runId: ${context.runId})`,
		};
	}

	return {
		data: { passed: true },
		status: "success",
		logs: `filter: condition passed (runId: ${context.runId})`,
	};
};
