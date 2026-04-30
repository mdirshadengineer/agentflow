import type { NodeExecutor } from "@mdirshadengineer/agentflow-core";

/**
 * JSON Extract executor.
 *
 * Extracts a nested value from a previous step's output data using a
 * dot-notation path (e.g. "body.user.name").
 *
 * Config fields:
 * - `path`         {string}  — required — dot-notation path into step data
 * - `fromStep`     {string}  — optional — step name to read; defaults to the
 *                              most recently completed step
 * - `defaultValue` {string}  — optional — returned when the path is not found
 */
export const jsonExtractExecutor: NodeExecutor = async (input, context) => {
	const { path, fromStep, defaultValue } = input.data;

	if (typeof path !== "string" || path.trim() === "") {
		return {
			data: {},
			status: "failed",
			logs: `json-extract: "path" config field is required (runId: ${context.runId})`,
		};
	}

	// Resolve source data
	let source: unknown;
	if (typeof fromStep === "string" && fromStep in input.previousOutputs) {
		source = input.previousOutputs[fromStep]?.data;
	} else {
		const keys = Object.keys(input.previousOutputs);
		const lastKey = keys[keys.length - 1];
		if (lastKey !== undefined) {
			source = input.previousOutputs[lastKey]?.data;
		}
	}

	// Walk the dot-notation path
	const segments = path.split(".");
	let current: unknown = source;
	for (const segment of segments) {
		if (current === null || current === undefined) {
			current = undefined;
			break;
		}
		if (typeof current === "object" && !Array.isArray(current)) {
			current = (current as Record<string, unknown>)[segment];
		} else {
			current = undefined;
			break;
		}
	}

	const found = current !== undefined;
	const value = found
		? current
		: (defaultValue !== undefined ? defaultValue : null);

	return {
		data: { value },
		status: "success",
		logs: `json-extract: path "${path}" → ${found ? "found" : "not found"} (runId: ${context.runId})`,
	};
};
