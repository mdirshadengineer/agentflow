import type { NodeOutput } from "./types.js";

/**
 * Matches `{{ steps.<stepId>.output }}` or `{{ steps.<stepId>.output.<dot.path> }}`.
 * The regex is used in two modes:
 *  - global (g flag) for string interpolation
 *  - without (g flag) for pure-expression detection
 */
const EXPR_REGEX =
	/\{\{\s*steps\.([^.}\s]+)\.output(?:\.([^}\s]+))?\s*\}\}/g;

const PURE_EXPR_REGEX =
	/^\{\{\s*steps\.([^.}\s]+)\.output(?:\.([^}\s]+))?\s*\}\}$/;

/**
 * Walk a dot-notation path (e.g. "user.address.city") into `obj`.
 * Returns `undefined` when any segment is missing.
 */
function walkPath(obj: unknown, path: string): unknown {
	const segments = path.split(".");
	let current: unknown = obj;
	for (const segment of segments) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object" || Array.isArray(current))
			return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

/**
 * Resolve a single step reference.
 *
 * @param stepId  - The step name (matches {@link WorkflowStep.name}).
 * @param path    - Optional dot-notation path into `output.data`.
 * @param outputs - Map of completed step outputs.
 */
function resolveRef(
	stepId: string,
	path: string | undefined,
	outputs: Record<string, NodeOutput>,
): unknown {
	const output = outputs[stepId];
	if (!output) return undefined;
	if (!path) return output.data;
	return walkPath(output.data, path);
}

/**
 * Resolve a single string value that may contain one or more `{{ }}` expressions.
 *
 * - **Pure expression** (`"{{ steps.foo.output.bar }}"` with no surrounding text):
 *   returns the resolved value with its native type (object, number, boolean, …).
 * - **Interpolated** (`"Status: {{ steps.foo.output.status }}"`):
 *   replaces each expression with its stringified value; returns a string.
 */
function resolveString(
	val: string,
	outputs: Record<string, NodeOutput>,
): unknown {
	const pure = val.trim();
	const pureMatch = pure.match(PURE_EXPR_REGEX);
	if (pureMatch) {
		// Pure expression — preserve the native type
		const resolved = resolveRef(pureMatch[1], pureMatch[2], outputs);
		return resolved;
	}

	// Interpolated — coerce all references to strings and stitch them together
	return val.replace(
		EXPR_REGEX,
		(_match: string, stepId: string, path: string | undefined) =>
			String(resolveRef(stepId, path, outputs) ?? ""),
	);
}

/**
 * Recursively walk a config object and resolve every string value that
 * contains `{{ steps.<id>.output[.<path>] }}` expressions.
 *
 * Arrays and nested objects are traversed; non-string primitives are
 * returned as-is.  The original `config` is never mutated.
 */
export function resolveExpressions(
	config: Record<string, unknown>,
	previousOutputs: Record<string, NodeOutput>,
): Record<string, unknown> {
	return resolveValue(config, previousOutputs) as Record<string, unknown>;
}

function resolveValue(
	val: unknown,
	outputs: Record<string, NodeOutput>,
): unknown {
	if (typeof val === "string") {
		return resolveString(val, outputs);
	}
	if (Array.isArray(val)) {
		return val.map((item) => resolveValue(item, outputs));
	}
	if (val !== null && typeof val === "object") {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
			result[k] = resolveValue(v, outputs);
		}
		return result;
	}
	return val;
}

/**
 * Scan a config object and collect all expression references that point to
 * unknown steps (i.e. steps not present in `previousOutputs`).
 * Useful for surfacing missing-dependency warnings to the user.
 */
export function findUnresolvedRefs(
	config: Record<string, unknown>,
	previousOutputs: Record<string, NodeOutput>,
): string[] {
	const unresolved: string[] = [];
	const seen = new Set<string>();

	function scan(val: unknown): void {
		if (typeof val === "string") {
			for (const m of val.matchAll(
				/\{\{\s*steps\.([^.}\s]+)\.output(?:\.([^}\s]+))?\s*\}\}/g,
			)) {
				const ref = m[2] ? `steps.${m[1]}.output.${m[2]}` : `steps.${m[1]}.output`;
				if (!seen.has(ref) && !(m[1] in previousOutputs)) {
					seen.add(ref);
					unresolved.push(ref);
				}
			}
		} else if (Array.isArray(val)) {
			for (const item of val) scan(item);
		} else if (val !== null && typeof val === "object") {
			for (const v of Object.values(val as Record<string, unknown>)) scan(v);
		}
	}

	scan(config);
	return unresolved;
}
