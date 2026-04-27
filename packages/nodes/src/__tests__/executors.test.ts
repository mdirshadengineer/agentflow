import type { NodeInput } from "@mdirshadengineer/agentflow-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delayExecutor } from "../executors/delay.js";
import { httpRequestExecutor } from "../executors/http-request.js";
import { logExecutor } from "../executors/log.js";
import { noopExecutor } from "../executors/noop.js";

const CTX = { runId: "run-test", workflowId: "wf-test" };

function makeInput(data: Record<string, unknown> = {}): NodeInput {
	return {
		data,
		previousOutputs: {},
		runId: CTX.runId,
		workflowId: CTX.workflowId,
	};
}

// ── noop ──────────────────────────────────────────────────────────────────────

describe("noopExecutor", () => {
	it("returns success with empty data", async () => {
		const result = await noopExecutor(makeInput(), CTX);
		expect(result.status).toBe("success");
		expect(result.data).toEqual({});
		expect(result.logs).toContain("noop");
	});
});

// ── log ───────────────────────────────────────────────────────────────────────

describe("logExecutor", () => {
	it("returns the message in logs and output data", async () => {
		const result = await logExecutor(
			makeInput({ message: "hello world" }),
			CTX,
		);
		expect(result.status).toBe("success");
		expect(result.data.message).toBe("hello world");
		expect(result.logs).toBe("hello world");
	});

	it("fails when message is missing", async () => {
		const result = await logExecutor(makeInput({}), CTX);
		expect(result.status).toBe("failed");
		expect(result.logs).toContain('"message"');
	});

	it("fails when message is not a string", async () => {
		const result = await logExecutor(makeInput({ message: 42 }), CTX);
		expect(result.status).toBe("failed");
	});
});

// ── delay ─────────────────────────────────────────────────────────────────────

describe("delayExecutor", () => {
	it("waits roughly the requested number of milliseconds", async () => {
		const before = Date.now();
		const result = await delayExecutor(makeInput({ ms: 20 }), CTX);
		const elapsed = Date.now() - before;
		expect(result.status).toBe("success");
		expect(result.data.waited).toBe(20);
		expect(elapsed).toBeGreaterThanOrEqual(10);
	});

	it("accepts 0 ms", async () => {
		const result = await delayExecutor(makeInput({ ms: 0 }), CTX);
		expect(result.status).toBe("success");
		expect(result.data.waited).toBe(0);
	});

	it("fails when ms is missing", async () => {
		const result = await delayExecutor(makeInput({}), CTX);
		expect(result.status).toBe("failed");
		expect(result.logs).toContain('"ms"');
	});

	it("fails when ms is negative", async () => {
		const result = await delayExecutor(makeInput({ ms: -1 }), CTX);
		expect(result.status).toBe("failed");
	});
});

// ── http-request ──────────────────────────────────────────────────────────────

describe("httpRequestExecutor", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fails when url is missing", async () => {
		const result = await httpRequestExecutor(makeInput({}), CTX);
		expect(result.status).toBe("failed");
		expect(result.logs).toContain('"url"');
	});

	it("fails when url is an empty string", async () => {
		const result = await httpRequestExecutor(makeInput({ url: "  " }), CTX);
		expect(result.status).toBe("failed");
	});

	it("returns failed status when fetch throws a network error", async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
		const result = await httpRequestExecutor(
			makeInput({ url: "http://example.com/test" }),
			CTX,
		);
		expect(result.status).toBe("failed");
		expect(result.logs).toContain("fetch failed");
	});

	it("returns success for a 2xx response", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("ok body", { status: 200 }),
		);
		const result = await httpRequestExecutor(
			makeInput({ url: "https://example.com/api" }),
			CTX,
		);
		expect(result.status).toBe("success");
		expect(result.data.status).toBe(200);
		expect(result.data.body).toBe("ok body");
	});

	it("returns failed status for a 4xx response", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("not found", { status: 404 }),
		);
		const result = await httpRequestExecutor(
			makeInput({ url: "https://example.com/missing" }),
			CTX,
		);
		expect(result.status).toBe("failed");
		expect(result.data.status).toBe(404);
	});
});
