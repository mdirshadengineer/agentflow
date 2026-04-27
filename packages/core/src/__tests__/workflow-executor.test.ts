import { describe, expect, it, vi } from "vitest";
import { NodeRegistry } from "../node-registry.js";
import { InMemoryRunLogger } from "../run-logger.js";
import type { WorkflowDefinition } from "../types.js";
import { WorkflowExecutor } from "../workflow-executor.js";

function makeExecutor() {
	const registry = new NodeRegistry();
	const logger = new InMemoryRunLogger();
	const executor = new WorkflowExecutor(registry, logger);
	return { registry, logger, executor };
}

describe("WorkflowExecutor", () => {
	describe("run() — empty definition", () => {
		it("returns success when there are no steps", async () => {
			const { executor } = makeExecutor();
			const result = await executor.run("run-1", "wf-1", {});
			expect(result).toBe("success");
		});

		it("returns success for a definition with an empty steps array", async () => {
			const { executor } = makeExecutor();
			const result = await executor.run("run-1", "wf-1", { steps: [] });
			expect(result).toBe("success");
		});
	});

	describe("run() — single step", () => {
		it("executes a registered step and returns success", async () => {
			const { registry, executor } = makeExecutor();
			registry.register("noop", async () => ({
				data: {},
				status: "success",
				logs: "done",
			}));

			const def: WorkflowDefinition = {
				steps: [{ name: "step1", type: "noop" }],
			};
			const result = await executor.run("run-1", "wf-1", def);
			expect(result).toBe("success");
		});

		it("marks step as failed when executor returns failed status", async () => {
			const { registry, logger, executor } = makeExecutor();
			registry.register("bad", async () => ({
				data: {},
				status: "failed",
				logs: "something broke",
			}));

			const def: WorkflowDefinition = {
				steps: [{ name: "bad-step", type: "bad" }],
			};
			const result = await executor.run("run-1", "wf-1", def);
			expect(result).toBe("failed");

			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "bad-step");
			expect(step?.status).toBe("failed");
			expect(step?.logs).toBe("something broke");
		});

		it("marks step as failed when executor throws", async () => {
			const { registry, logger, executor } = makeExecutor();
			registry.register("throw", async () => {
				throw new Error("executor exploded");
			});

			const def: WorkflowDefinition = {
				steps: [{ name: "throw-step", type: "throw" }],
			};
			const result = await executor.run("run-1", "wf-1", def);
			expect(result).toBe("failed");

			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "throw-step");
			expect(step?.status).toBe("failed");
			expect(step?.logs).toBe("executor exploded");
		});
	});

	describe("run() — DAG with dependencies", () => {
		it("executes steps in dependency order", async () => {
			const { registry, executor } = makeExecutor();
			const order: string[] = [];

			registry.register("record", async (input) => {
				order.push(String(input.data.label ?? "?"));
				return { data: {}, status: "success", logs: "" };
			});

			const def: WorkflowDefinition = {
				steps: [
					{ name: "a", type: "record", config: { label: "a" } },
					{
						name: "b",
						type: "record",
						config: { label: "b" },
						dependsOn: ["a"],
					},
					{
						name: "c",
						type: "record",
						config: { label: "c" },
						dependsOn: ["b"],
					},
				],
			};

			await executor.run("run-1", "wf-1", def);
			expect(order).toEqual(["a", "b", "c"]);
		});

		it("skips a step when its dependency failed", async () => {
			const { registry, logger, executor } = makeExecutor();

			registry.register("fail", async () => ({
				data: {},
				status: "failed",
				logs: "failed",
			}));
			registry.register("noop", async () => ({
				data: {},
				status: "success",
				logs: "ok",
			}));

			const def: WorkflowDefinition = {
				steps: [
					{ name: "step-a", type: "fail" },
					{ name: "step-b", type: "noop", dependsOn: ["step-a"] },
				],
			};

			const result = await executor.run("run-1", "wf-1", def);
			expect(result).toBe("failed");

			const logs = await logger.getLogsForRun("run-1");
			const stepB = logs.find((l) => l.stepName === "step-b");
			expect(stepB?.status).toBe("skipped");
		});

		it("passes previous step outputs to downstream steps", async () => {
			const { registry, executor } = makeExecutor();
			const capturedPrev: Record<string, unknown>[] = [];

			registry.register("produce", async () => ({
				data: { value: 42 },
				status: "success",
				logs: "produced",
			}));

			registry.register("consume", async (input) => {
				capturedPrev.push(input.previousOutputs);
				return { data: {}, status: "success", logs: "consumed" };
			});

			const def: WorkflowDefinition = {
				steps: [
					{ name: "producer", type: "produce" },
					{ name: "consumer", type: "consume", dependsOn: ["producer"] },
				],
			};

			await executor.run("run-1", "wf-1", def);
			expect(capturedPrev[0]).toHaveProperty("producer");
			expect(capturedPrev[0]?.producer).toMatchObject({
				data: { value: 42 },
				status: "success",
			});
		});

		it("runs independent steps concurrently", async () => {
			const { registry, executor } = makeExecutor();
			const startTimes: number[] = [];

			registry.register("slow", async () => {
				startTimes.push(Date.now());
				await new Promise((r) => setTimeout(r, 20));
				return { data: {}, status: "success", logs: "done" };
			});

			const def: WorkflowDefinition = {
				steps: [
					{ name: "s1", type: "slow" },
					{ name: "s2", type: "slow" },
				],
			};

			const before = Date.now();
			await executor.run("run-1", "wf-1", def);
			const elapsed = Date.now() - before;

			// Both slow steps should have started roughly simultaneously
			expect(startTimes).toHaveLength(2);
			// If sequential they would take ~40ms; concurrent should be ~20ms
			expect(elapsed).toBeLessThan(35);
		});
	});

	describe("run() — logger interactions", () => {
		it("initialises all steps before executing any", async () => {
			const { registry, logger, executor } = makeExecutor();
			const initSpy = vi.spyOn(logger, "initStep");

			registry.register("noop", async () => ({
				data: {},
				status: "success",
				logs: "",
			}));

			const def: WorkflowDefinition = {
				steps: [
					{ name: "x", type: "noop" },
					{ name: "y", type: "noop" },
				],
			};

			await executor.run("run-1", "wf-1", def);
			expect(initSpy).toHaveBeenCalledTimes(2);
			expect(initSpy).toHaveBeenCalledWith("run-1", "x");
			expect(initSpy).toHaveBeenCalledWith("run-1", "y");
		});

		it("records step lifecycle: init → start → complete for a successful step", async () => {
			const { registry, logger, executor } = makeExecutor();

			registry.register("noop", async () => ({
				data: {},
				status: "success",
				logs: "all good",
			}));

			await executor.run("run-1", "wf-1", {
				steps: [{ name: "my-step", type: "noop" }],
			});

			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "my-step");
			expect(step?.status).toBe("success");
			expect(step?.logs).toBe("all good");
			expect(step?.startedAt).toBeInstanceOf(Date);
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});
});
