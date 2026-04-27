import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "../tool-registry.js";
import { ToolRegistry } from "../tool-registry.js";

function makeTool(name: string): ToolDefinition {
	return {
		name,
		description: `Tool ${name}`,
		inputSchema: { type: "object", properties: {} },
		execute: async () => `result from ${name}`,
	};
}

describe("ToolRegistry", () => {
	describe("register()", () => {
		it("registers a tool without throwing", () => {
			const registry = new ToolRegistry();
			expect(() => registry.register(makeTool("search"))).not.toThrow();
		});

		it("throws when the same tool name is registered twice", () => {
			const registry = new ToolRegistry();
			registry.register(makeTool("search"));
			expect(() => registry.register(makeTool("search"))).toThrow(
				'Tool "search" is already registered',
			);
		});
	});

	describe("has()", () => {
		it("returns true after registration", () => {
			const registry = new ToolRegistry();
			registry.register(makeTool("fetch"));
			expect(registry.has("fetch")).toBe(true);
		});

		it("returns false for an unregistered name", () => {
			const registry = new ToolRegistry();
			expect(registry.has("nope")).toBe(false);
		});
	});

	describe("get()", () => {
		it("returns the registered tool definition", () => {
			const registry = new ToolRegistry();
			const tool = makeTool("compute");
			registry.register(tool);
			expect(registry.get("compute")).toBe(tool);
		});

		it("returns undefined for an unknown name", () => {
			const registry = new ToolRegistry();
			expect(registry.get("ghost")).toBeUndefined();
		});
	});

	describe("list()", () => {
		it("returns all registered tools", () => {
			const registry = new ToolRegistry();
			registry.register(makeTool("a"));
			registry.register(makeTool("b"));
			const names = registry
				.list()
				.map((t) => t.name)
				.sort();
			expect(names).toEqual(["a", "b"]);
		});

		it("returns an empty array when nothing is registered", () => {
			expect(new ToolRegistry().list()).toEqual([]);
		});
	});

	describe("execute()", () => {
		it("runs the tool execute function and returns its result", async () => {
			const registry = new ToolRegistry();
			registry.register({
				name: "add",
				description: "adds two numbers",
				inputSchema: { type: "object" },
				execute: async (args) => (args.a as number) + (args.b as number),
			});

			const tool = registry.get("add");
			const result = await tool?.execute({ a: 3, b: 4 });
			expect(result).toBe(7);
		});
	});
});
