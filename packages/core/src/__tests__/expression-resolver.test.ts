import { describe, expect, it } from "vitest";
import {
	findUnresolvedRefs,
	resolveExpressions,
} from "../expression-resolver.js";
import type { NodeOutput } from "../types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOutput(data: Record<string, unknown>): NodeOutput {
	return { data, status: "success", logs: "" };
}

const outputs = {
	"step-a": makeOutput({ value: 42, name: "Alice", nested: { x: 1 } }),
	"step-b": makeOutput({ items: ["foo", "bar"], count: 2 }),
};

// ── resolveExpressions ────────────────────────────────────────────────────────

describe("resolveExpressions", () => {
	describe("pure expressions — preserves native type", () => {
		it("resolves a number", () => {
			const result = resolveExpressions(
				{ val: "{{ steps.step-a.output.value }}" },
				outputs,
			);
			expect(result.val).toBe(42);
		});

		it("resolves a string", () => {
			const result = resolveExpressions(
				{ name: "{{ steps.step-a.output.name }}" },
				outputs,
			);
			expect(result.name).toBe("Alice");
		});

		it("resolves the entire output object when no path is given", () => {
			const result = resolveExpressions(
				{ all: "{{ steps.step-a.output }}" },
				outputs,
			);
			expect(result.all).toEqual({
				value: 42,
				name: "Alice",
				nested: { x: 1 },
			});
		});

		it("resolves a nested path", () => {
			const result = resolveExpressions(
				{ x: "{{ steps.step-a.output.nested.x }}" },
				outputs,
			);
			expect(result.x).toBe(1);
		});

		it("resolves an array index path", () => {
			const result = resolveExpressions(
				{ first: "{{ steps.step-b.output.items[0] }}" },
				outputs,
			);
			expect(result.first).toBe("foo");
		});

		it("returns undefined for an unknown step", () => {
			const result = resolveExpressions(
				{ x: "{{ steps.unknown.output.value }}" },
				outputs,
			);
			expect(result.x).toBeUndefined();
		});

		it("returns undefined for a missing path segment", () => {
			const result = resolveExpressions(
				{ x: "{{ steps.step-a.output.missing }}" },
				outputs,
			);
			expect(result.x).toBeUndefined();
		});
	});

	describe("interpolated expressions — returns a string", () => {
		it("interpolates a single expression within a string", () => {
			const result = resolveExpressions(
				{ msg: "Hello {{ steps.step-a.output.name }}!" },
				outputs,
			);
			expect(result.msg).toBe("Hello Alice!");
		});

		it("interpolates multiple expressions in one string", () => {
			const result = resolveExpressions(
				{
					msg: "Count={{ steps.step-b.output.count }} Value={{ steps.step-a.output.value }}",
				},
				outputs,
			);
			expect(result.msg).toBe("Count=2 Value=42");
		});

		it("coerces unknown step refs to empty string in interpolation", () => {
			const result = resolveExpressions(
				{ msg: "x={{ steps.missing.output.y }}" },
				outputs,
			);
			expect(result.msg).toBe("x=");
		});

		it("supports helper calls inside templates", () => {
			const result = resolveExpressions(
				{
					msg: "User={{ coalesce(steps.missing.output.name, steps.step-a.output.name) }}",
				},
				outputs,
			);
			expect(result.msg).toBe("User=Alice");
		});
	});

	describe("non-string values are left untouched", () => {
		it("leaves numbers as-is", () => {
			const result = resolveExpressions({ n: 99 }, outputs);
			expect(result.n).toBe(99);
		});

		it("leaves booleans as-is", () => {
			const result = resolveExpressions({ flag: true }, outputs);
			expect(result.flag).toBe(true);
		});

		it("leaves null as-is", () => {
			const result = resolveExpressions({ x: null }, outputs);
			expect(result.x).toBeNull();
		});
	});

	describe("nested config objects and arrays", () => {
		it("resolves expressions inside nested objects", () => {
			const result = resolveExpressions(
				{ parent: { child: "{{ steps.step-a.output.value }}" } },
				outputs,
			);
			expect((result.parent as Record<string, unknown>).child).toBe(42);
		});

		it("resolves expressions inside arrays", () => {
			const result = resolveExpressions(
				{ arr: ["{{ steps.step-a.output.value }}", "static"] },
				outputs,
			);
			expect(result.arr).toEqual([42, "static"]);
		});
	});

	describe("does not mutate the original config", () => {
		it("returns a new object and leaves the original unchanged", () => {
			const config = { url: "{{ steps.step-a.output.name }}" };
			resolveExpressions(config, outputs);
			expect(config.url).toBe("{{ steps.step-a.output.name }}");
		});
	});

	describe("handles extra whitespace inside braces", () => {
		it("resolves with leading/trailing spaces", () => {
			const result = resolveExpressions(
				{ v: "{{  steps.step-a.output.value  }}" },
				outputs,
			);
			expect(result.v).toBe(42);
		});
	});
});

// ── findUnresolvedRefs ────────────────────────────────────────────────────────

describe("findUnresolvedRefs", () => {
	it("returns empty array when all refs resolve", () => {
		const result = findUnresolvedRefs(
			{ url: "{{ steps.step-a.output.value }}" },
			outputs,
		);
		expect(result).toEqual([]);
	});

	it("returns unresolved ref for an unknown step", () => {
		const result = findUnresolvedRefs(
			{ url: "{{ steps.unknown-step.output.field }}" },
			outputs,
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe("steps.unknown-step.output.field");
	});

	it("does not duplicate the same unresolved ref", () => {
		const result = findUnresolvedRefs(
			{
				a: "{{ steps.ghost.output.x }}",
				b: "{{ steps.ghost.output.x }}",
			},
			outputs,
		);
		expect(result).toHaveLength(1);
	});

	it("returns multiple distinct unresolved refs", () => {
		const result = findUnresolvedRefs(
			{
				a: "{{ steps.ghost1.output }}",
				b: "{{ steps.ghost2.output.field }}",
			},
			outputs,
		);
		expect(result).toHaveLength(2);
	});
});
