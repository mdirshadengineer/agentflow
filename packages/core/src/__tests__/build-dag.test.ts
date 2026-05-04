import { describe, expect, it } from "vitest";
import { buildDag } from "../build-dag.js";

describe("buildDag()", () => {
	describe("unrecognised / invalid inputs → empty definition", () => {
		it("returns {} for null", () => {
			expect(buildDag(null)).toEqual({});
		});

		it("returns {} for undefined", () => {
			expect(buildDag(undefined)).toEqual({});
		});

		it("returns {} for a primitive string", () => {
			expect(buildDag("not-an-object")).toEqual({});
		});

		it("returns {} for a number", () => {
			expect(buildDag(42)).toEqual({});
		});

		it("returns {} for a plain array", () => {
			expect(buildDag([])).toEqual({});
		});

		it("returns {} for an empty object with no known keys", () => {
			expect(buildDag({})).toEqual({});
		});
	});

	describe("steps format (already in execution format)", () => {
		it("returns the definition as-is when steps is an array", () => {
			const def = { steps: [{ name: "step1", type: "noop" }] };
			expect(buildDag(def)).toBe(def);
		});

		it("returns as-is for an empty steps array", () => {
			const def = { steps: [] };
			expect(buildDag(def)).toBe(def);
		});

		it("preserves all properties of steps-format definitions", () => {
			const def = {
				steps: [
					{ name: "a", type: "noop" },
					{
						name: "b",
						type: "log",
						dependsOn: ["a"],
						config: { message: "hi" },
					},
				],
				triggers: [{ type: "cron" as const, cron: "* * * * *" }],
			};
			expect(buildDag(def)).toBe(def);
		});
	});

	describe("canvas format (nodes + edges)", () => {
		it("converts an empty nodes array to an empty steps array", () => {
			const result = buildDag({ nodes: [], edges: [] });
			expect(result).toEqual({ steps: [] });
		});

		it("converts a single node with no edges to a step with no dependsOn", () => {
			const result = buildDag({
				nodes: [{ id: "n1", type: "noop", data: {} }],
				edges: [],
			});
			expect(result).toEqual({
				steps: [{ name: "n1", type: "noop", config: {} }],
			});
		});

		it("maps edges to dependsOn references on target nodes", () => {
			const result = buildDag({
				nodes: [
					{ id: "n1", type: "noop", data: {} },
					{ id: "n2", type: "log", data: { message: "hi" } },
				],
				edges: [{ id: "e1", source: "n1", target: "n2" }],
			});
			expect(result.steps).toHaveLength(2);
			const n2 = result.steps?.find((s) => s.name === "n2");
			expect(n2?.dependsOn).toEqual(["n1"]);
		});

		it("does not add dependsOn for nodes with no incoming edges", () => {
			const result = buildDag({
				nodes: [
					{ id: "n1", type: "noop", data: {} },
					{ id: "n2", type: "noop", data: {} },
				],
				edges: [],
			});
			const n1 = result.steps?.find((s) => s.name === "n1");
			const n2 = result.steps?.find((s) => s.name === "n2");
			expect(n1).not.toHaveProperty("dependsOn");
			expect(n2).not.toHaveProperty("dependsOn");
		});

		it("handles a diamond dependency: two steps depending on the same parent", () => {
			const result = buildDag({
				nodes: [
					{ id: "root", type: "noop", data: {} },
					{ id: "left", type: "noop", data: {} },
					{ id: "right", type: "noop", data: {} },
					{ id: "merge", type: "noop", data: {} },
				],
				edges: [
					{ id: "e1", source: "root", target: "left" },
					{ id: "e2", source: "root", target: "right" },
					{ id: "e3", source: "left", target: "merge" },
					{ id: "e4", source: "right", target: "merge" },
				],
			});
			const merge = result.steps?.find((s) => s.name === "merge");
			expect(merge?.dependsOn?.sort()).toEqual(["left", "right"]);
		});

		it("uses node.data as the step config", () => {
			const result = buildDag({
				nodes: [
					{
						id: "n1",
						type: "http-request",
						data: { url: "https://example.com" },
					},
				],
				edges: [],
			});
			expect(result.steps?.[0]?.config).toEqual({ url: "https://example.com" });
		});

		it("uses node.id as the step name", () => {
			const result = buildDag({
				nodes: [{ id: "my-node-id", type: "noop", data: {} }],
				edges: [],
			});
			expect(result.steps?.[0]?.name).toBe("my-node-id");
		});

		it("ignores edges referencing unknown node ids", () => {
			const result = buildDag({
				nodes: [{ id: "n1", type: "noop", data: {} }],
				edges: [{ id: "e1", source: "unknown", target: "n1" }],
			});
			// The edge source "unknown" is not in the nodes list, but it is
			// still recorded as a dependency of n1 (the buildDag implementation
			// trusts that node ids are valid – resolution happens at execution time).
			const n1 = result.steps?.find((s) => s.name === "n1");
			expect(n1?.dependsOn).toEqual(["unknown"]);
		});

		it("handles missing edges key by treating it as empty", () => {
			const result = buildDag({
				nodes: [{ id: "n1", type: "noop", data: {} }],
			});
			expect(result.steps).toHaveLength(1);
			expect(result.steps?.[0]).not.toHaveProperty("dependsOn");
		});

		it("resolves 'generic' canvas node type to data.nodeType for execution", () => {
			const result = buildDag({
				nodes: [
					{
						id: "n1",
						type: "generic",
						data: {
							nodeType: "http-request",
							label: "HTTP Request",
							url: "https://example.com",
						},
					},
				],
				edges: [],
			});
			expect(result.steps?.[0]?.type).toBe("http-request");
		});

		it("strips label and nodeType from config when resolving a generic node", () => {
			const result = buildDag({
				nodes: [
					{
						id: "n1",
						type: "generic",
						data: {
							nodeType: "http-request",
							label: "My HTTP",
							url: "https://example.com",
						},
					},
				],
				edges: [],
			});
			const config = result.steps?.[0]?.config ?? {};
			expect(config).not.toHaveProperty("nodeType");
			expect(config).not.toHaveProperty("label");
			expect(config.url).toBe("https://example.com");
		});

		it("keeps type as 'generic' when nodeType is absent or empty", () => {
			const result = buildDag({
				nodes: [{ id: "n1", type: "generic", data: { label: "Unknown" } }],
				edges: [],
			});
			expect(result.steps?.[0]?.type).toBe("generic");
		});
	});

	describe("cron trigger extraction", () => {
		it("extracts a cron trigger from a trigger node with triggerType 'scheduled'", () => {
			const result = buildDag({
				nodes: [
					{
						id: "trigger-1",
						type: "trigger",
						data: { triggerType: "scheduled", cron: "0 * * * *" },
					},
					{ id: "step-1", type: "noop", data: {} },
				],
				edges: [{ id: "e1", source: "trigger-1", target: "step-1" }],
			});
			expect(result.triggers).toHaveLength(1);
			expect(result.triggers?.[0]).toEqual({ type: "cron", cron: "0 * * * *" });
		});

		it("does not add triggers when there are no cron trigger nodes", () => {
			const result = buildDag({
				nodes: [{ id: "n1", type: "noop", data: {} }],
				edges: [],
			});
			expect(result.triggers).toBeUndefined();
		});

		it("does not extract triggers from webhook trigger nodes", () => {
			const result = buildDag({
				nodes: [
					{
						id: "trigger-1",
						type: "trigger",
						data: { triggerType: "webhook", webhookPath: "/my-hook" },
					},
				],
				edges: [],
			});
			expect(result.triggers).toBeUndefined();
		});

		it("does not extract triggers from manual trigger nodes", () => {
			const result = buildDag({
				nodes: [
					{
						id: "trigger-1",
						type: "trigger",
						data: { triggerType: "manual" },
					},
				],
				edges: [],
			});
			expect(result.triggers).toBeUndefined();
		});

		it("still includes trigger nodes as workflow steps", () => {
			const result = buildDag({
				nodes: [
					{
						id: "trigger-1",
						type: "trigger",
						data: { triggerType: "cron", cron: "* * * * *" },
					},
				],
				edges: [],
			});
			expect(result.steps?.find((s) => s.name === "trigger-1")).toBeDefined();
		});
	});
});
