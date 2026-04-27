import { describe, expect, it } from "vitest";
import { NodeRegistry } from "../node-registry.js";
import type { NodeInput } from "../types.js";

const CONTEXT = { runId: "run-1", workflowId: "wf-1" };

function makeInput(overrides: Partial<NodeInput> = {}): NodeInput {
	return {
		data: {},
		previousOutputs: {},
		runId: "run-1",
		workflowId: "wf-1",
		...overrides,
	};
}

describe("NodeRegistry", () => {
	describe("register()", () => {
		it("registers an executor without throwing", () => {
			const registry = new NodeRegistry();
			expect(() =>
				registry.register("noop", async () => ({
					data: {},
					status: "success",
					logs: "ok",
				})),
			).not.toThrow();
		});

		it("throws when the same type is registered twice", () => {
			const registry = new NodeRegistry();
			const exec = async () => ({
				data: {},
				status: "success" as const,
				logs: "",
			});
			registry.register("noop", exec);
			expect(() => registry.register("noop", exec)).toThrow(
				'NodeExecutor for type "noop" is already registered',
			);
		});
	});

	describe("has()", () => {
		it("returns true after registration", () => {
			const registry = new NodeRegistry();
			registry.register("http", async () => ({
				data: {},
				status: "success",
				logs: "",
			}));
			expect(registry.has("http")).toBe(true);
		});

		it("returns false for an unregistered type", () => {
			const registry = new NodeRegistry();
			expect(registry.has("unknown")).toBe(false);
		});
	});

	describe("types()", () => {
		it("lists all registered type names", () => {
			const registry = new NodeRegistry();
			registry.register("a", async () => ({
				data: {},
				status: "success",
				logs: "",
			}));
			registry.register("b", async () => ({
				data: {},
				status: "success",
				logs: "",
			}));
			expect(registry.types().sort()).toEqual(["a", "b"]);
		});
	});

	describe("execute()", () => {
		it("calls the registered executor and returns its output", async () => {
			const registry = new NodeRegistry();
			registry.register("greet", async (input) => ({
				data: { greeting: `Hello, ${String(input.data.name ?? "world")}` },
				status: "success",
				logs: "greeted",
			}));

			const result = await registry.execute(
				"greet",
				makeInput({ data: { name: "Alice" } }),
				CONTEXT,
			);

			expect(result.status).toBe("success");
			expect(result.data.greeting).toBe("Hello, Alice");
		});

		it("returns a no-op success for an unregistered type", async () => {
			const registry = new NodeRegistry();
			const result = await registry.execute(
				"unknown-type",
				makeInput(),
				CONTEXT,
			);
			expect(result.status).toBe("success");
			expect(result.logs).toContain("unknown-type");
			expect(result.logs).toContain("no-op");
		});

		it("propagates failures returned by the executor", async () => {
			const registry = new NodeRegistry();
			registry.register("fail-node", async () => ({
				data: {},
				status: "failed",
				logs: "something went wrong",
			}));

			const result = await registry.execute("fail-node", makeInput(), CONTEXT);
			expect(result.status).toBe("failed");
			expect(result.logs).toBe("something went wrong");
		});

		it("propagates thrown errors from the executor", async () => {
			const registry = new NodeRegistry();
			registry.register("throw-node", async () => {
				throw new Error("executor exploded");
			});

			await expect(
				registry.execute("throw-node", makeInput(), CONTEXT),
			).rejects.toThrow("executor exploded");
		});
	});
});
