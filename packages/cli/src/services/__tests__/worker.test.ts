import { describe, expect, it, vi } from "vitest";
import { SqliteWorkflowQueue } from "../sqlite-workflow-queue.js";
import type { WorkflowStep } from "../worker.js";
import { createWorker } from "../worker.js";

// These tests verify the public contract of createWorker() — a start/stop
// service — without running the full DB integration (covered by api.test.ts).
// The DB layer and WorkflowExecutor internals are exercised in their own test
// suites (packages/core and the integration test suite).

describe("WorkflowStep type (re-export from @mdirshadengineer/agentflow-core)", () => {
	it("accepts a minimal step object", () => {
		const step: WorkflowStep = { name: "step-1", type: "noop" };
		expect(step.name).toBe("step-1");
		expect(step.type).toBe("noop");
	});

	it("accepts a step with optional config and dependsOn", () => {
		const step: WorkflowStep = {
			name: "step-2",
			type: "http-request",
			config: { url: "https://example.com" },
			dependsOn: ["step-1"],
		};
		expect(step.dependsOn).toContain("step-1");
		expect(step.config?.url).toBe("https://example.com");
	});
});

describe("createWorker()", () => {
	it("returns an object with start, stop, and poll methods", () => {
		const worker = createWorker();
		expect(typeof worker.start).toBe("function");
		expect(typeof worker.stop).toBe("function");
		expect(typeof worker.poll).toBe("function");
	});

	it("stop() resolves immediately when not started", async () => {
		const worker = createWorker();
		await expect(worker.stop()).resolves.toBeUndefined();
	});

	it("stop() after start() clears the timer and resolves", async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

		// Mock the queue's poll so no real DB calls happen when start() runs its
		// immediate first poll before scheduling the interval timer.
		const pollStub = vi
			.spyOn(SqliteWorkflowQueue.prototype, "poll")
			.mockResolvedValue([]);

		// Mock setTimeout so the scheduled interval never fires a real DB call.
		const setTimeoutSpy = vi
			.spyOn(globalThis, "setTimeout")
			.mockImplementation(
				(_fn, _ms) => 42 as unknown as ReturnType<typeof setTimeout>,
			);

		const worker = createWorker();
		await worker.start();
		await worker.stop();

		// Timer should have been cleared after stop
		expect(clearTimeoutSpy).toHaveBeenCalledWith(42);

		pollStub.mockRestore();
		setTimeoutSpy.mockRestore();
		clearTimeoutSpy.mockRestore();
	});
});


// These tests verify the public contract of createWorker() — a start/stop
// service — without running the full DB integration (covered by api.test.ts).
// The DB layer and WorkflowExecutor internals are exercised in their own test
// suites (packages/core and the integration test suite).

describe("WorkflowStep type (re-export from @mdirshadengineer/agentflow-core)", () => {
	it("accepts a minimal step object", () => {
		const step: WorkflowStep = { name: "step-1", type: "noop" };
		expect(step.name).toBe("step-1");
		expect(step.type).toBe("noop");
	});

	it("accepts a step with optional config and dependsOn", () => {
		const step: WorkflowStep = {
			name: "step-2",
			type: "http-request",
			config: { url: "https://example.com" },
			dependsOn: ["step-1"],
		};
		expect(step.dependsOn).toContain("step-1");
		expect(step.config?.url).toBe("https://example.com");
	});
});

describe("createWorker()", () => {
	it("returns an object with start, stop, and poll methods", () => {
		const worker = createWorker();
		expect(typeof worker.start).toBe("function");
		expect(typeof worker.stop).toBe("function");
		expect(typeof worker.poll).toBe("function");
	});

	it("stop() resolves immediately when not started", async () => {
		const worker = createWorker();
		await expect(worker.stop()).resolves.toBeUndefined();
	});

	it("stop() after start() clears the timer and resolves", async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

		// Mock setTimeout so the scheduled interval never fires a real DB call.
		// start() will call poll() immediately (which hits the SqliteWorkflowQueue),
		// so we also need to stub the queue's poll method via the module.
		const { SqliteWorkflowQueue } = await import("../sqlite-workflow-queue.js");
		const pollStub = vi
			.spyOn(SqliteWorkflowQueue.prototype, "poll")
			.mockResolvedValue([]);

		const setTimeoutSpy = vi
			.spyOn(globalThis, "setTimeout")
			.mockImplementation(
				(_fn, _ms) => 42 as unknown as ReturnType<typeof setTimeout>,
			);

		const worker = createWorker();
		await worker.start();
		await worker.stop();

		// Timer should have been cleared after stop
		expect(clearTimeoutSpy).toHaveBeenCalledWith(42);

		pollStub.mockRestore();
		setTimeoutSpy.mockRestore();
		clearTimeoutSpy.mockRestore();
	});
});
