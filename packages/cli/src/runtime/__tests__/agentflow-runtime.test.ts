import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AgentflowRuntime } from "../agentflow-runtime.js";

function makeService(
	startImpl?: () => Promise<void>,
	stopImpl?: () => Promise<void>,
) {
	return {
		start: vi.fn(startImpl ?? (() => Promise.resolve())),
		stop: vi.fn(stopImpl ?? (() => Promise.resolve())),
	};
}

describe("AgentflowRuntime", () => {
	describe("start()", () => {
		it("starts all registered services in order", async () => {
			const runtime = new AgentflowRuntime();
			const order: number[] = [];
			const svc1 = makeService(async () => {
				order.push(1);
			});
			const svc2 = makeService(async () => {
				order.push(2);
			});

			runtime.register(svc1);
			runtime.register(svc2);

			await runtime.start();
			expect(order).toEqual([1, 2]);
		});

		it("does not call start on an empty service list", async () => {
			const runtime = new AgentflowRuntime();
			await expect(runtime.start()).resolves.toBeUndefined();
		});

		it("stops already-started services when a later service fails to start", async () => {
			const runtime = new AgentflowRuntime();
			const svc1 = makeService();
			const svc2 = makeService(async () => {
				throw new Error("boom");
			});

			runtime.register(svc1);
			runtime.register(svc2);

			await expect(runtime.start()).rejects.toThrow(
				"Failed to start service at index 1: boom",
			);
			expect(svc1.stop).toHaveBeenCalledOnce();
		});

		it("includes cleanup error message when both start and stop fail", async () => {
			const runtime = new AgentflowRuntime();
			const svc1 = makeService(undefined, async () => {
				throw new Error("stop-fail");
			});
			const svc2 = makeService(async () => {
				throw new Error("start-fail");
			});

			runtime.register(svc1);
			runtime.register(svc2);

			await expect(runtime.start()).rejects.toThrow(
				/Cleanup failed: stop-fail/,
			);
		});
	});

	describe("stop()", () => {
		it("stops services in reverse registration order", async () => {
			const runtime = new AgentflowRuntime();
			const order: number[] = [];
			const svc1 = makeService(undefined, async () => {
				order.push(1);
			});
			const svc2 = makeService(undefined, async () => {
				order.push(2);
			});

			runtime.register(svc1);
			runtime.register(svc2);

			await runtime.start();
			order.length = 0;
			await runtime.stop();
			expect(order).toEqual([2, 1]);
		});

		it("throws AggregateError when multiple services fail to stop", async () => {
			const runtime = new AgentflowRuntime();
			runtime.register(
				makeService(undefined, async () => {
					throw new Error("err-1");
				}),
			);
			runtime.register(
				makeService(undefined, async () => {
					throw new Error("err-2");
				}),
			);

			await runtime.start();

			await expect(runtime.stop()).rejects.toBeInstanceOf(AggregateError);
		});

		it("resolves when service list is empty", async () => {
			const runtime = new AgentflowRuntime();
			await expect(runtime.stop()).resolves.toBeUndefined();
		});
	});
});
