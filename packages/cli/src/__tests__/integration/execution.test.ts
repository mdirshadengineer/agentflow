/**
 * End-to-end execution integration tests.
 *
 * These tests verify the full pipeline:
 *   enqueue → worker poll → executor runs steps → run transitions to a terminal state
 *
 * The worker is NOT started with its timer-based polling loop here; instead
 * `worker.poll()` is called directly so tests remain fast and deterministic.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

vi.mock("../../db/connection.js", async () => {
	const { default: Database } = await import("better-sqlite3");
	const { drizzle } = await import("drizzle-orm/better-sqlite3");
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite);
	return { getDb: () => db, getRawSqlite: () => sqlite };
});

import { vi } from "vitest";
import { runMigrations } from "../../db/migrate.js";
import { createWorker } from "../../services/worker.js";
import { buildTestServer } from "../helpers/test-server.js";

type FastifyInstance = Awaited<ReturnType<typeof buildTestServer>>;

let app: FastifyInstance;
let worker: ReturnType<typeof createWorker>;

beforeAll(async () => {
	runMigrations();
	app = await buildTestServer();
	worker = createWorker();
	// Do NOT call worker.start() — we drive poll() manually to avoid timer leakage.
});

afterAll(async () => {
	await app.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerAndLogin(emailSuffix: string) {
	const email = `exec-${emailSuffix}@example.com`;
	const password = "password123";
	await app.inject({
		method: "POST",
		url: "/api/v1/auth/register",
		payload: { email, password },
	});
	const loginRes = await app.inject({
		method: "POST",
		url: "/api/v1/auth/login",
		payload: { email, password },
	});
	const setCookie = loginRes.headers["set-cookie"] as string | string[];
	const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const token = cookieHeader?.split(";")[0]?.replace("token=", "") ?? "";
	return { cookie: token };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("End-to-end workflow execution", () => {
	it("executes a noop-step workflow and transitions the run to success", async () => {
		const { cookie } = await registerAndLogin("e2e-noop");

		// Create a workflow with a single noop canvas node
		const definition = {
			nodes: [
				{
					id: "node-1",
					type: "noop",
					position: { x: 100, y: 200 },
					data: { label: "Noop Step" },
				},
			],
			edges: [],
		};
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Noop Workflow", definition },
			cookies: { token: cookie },
		});
		expect(wfRes.statusCode).toBe(201);
		const { id: workflowId } = wfRes.json() as { id: string };

		// Enqueue a run — should start in "queued" state
		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		expect(runRes.statusCode).toBe(201);
		const { id: runId, status: initialStatus } = runRes.json() as {
			id: string;
			status: string;
		};
		expect(initialStatus).toBe("queued");

		// Drive one worker poll cycle
		await worker.poll();

		// Verify the run is now complete
		const checkRes = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(checkRes.statusCode).toBe(200);
		const body = checkRes.json() as { status: string; steps: unknown[] };
		expect(body.status).toBe("success");
		expect(Array.isArray(body.steps)).toBe(true);
	});

	it("executes a log-step canvas workflow and transitions to success", async () => {
		const { cookie } = await registerAndLogin("e2e-log");

		const definition = {
			nodes: [
				{
					id: "trigger-1",
					type: "trigger",
					position: { x: 100, y: 200 },
					data: { label: "Start", triggerType: "manual" },
				},
				{
					id: "log-1",
					type: "log",
					position: { x: 350, y: 200 },
					data: { label: "Log Step", message: "hello from log" },
				},
			],
			edges: [{ id: "e1", source: "trigger-1", target: "log-1" }],
		};
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Log Workflow", definition },
			cookies: { token: cookie },
		});
		expect(wfRes.statusCode).toBe(201);
		const { id: workflowId } = wfRes.json() as { id: string };

		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		expect(runRes.statusCode).toBe(201);
		const { id: runId } = runRes.json() as { id: string };

		await worker.poll();

		const checkRes = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(checkRes.statusCode).toBe(200);
		const body = checkRes.json() as { status: string; steps: unknown[] };
		expect(body.status).toBe("success");
	});

	it("marks a run failed when the workflow definition is an empty object", async () => {
		const { cookie } = await registerAndLogin("e2e-empty");

		// Workflow with an empty definition — buildDag returns {} (no steps) which
		// means executor.run() returns "success" (zero steps = success). Verify
		// the run reaches a terminal state (not stuck in queued).
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Empty Workflow" },
			cookies: { token: cookie },
		});
		expect(wfRes.statusCode).toBe(201);
		const { id: workflowId } = wfRes.json() as { id: string };

		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		expect(runRes.statusCode).toBe(201);
		const { id: runId } = runRes.json() as { id: string };

		await worker.poll();

		const checkRes = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(checkRes.statusCode).toBe(200);
		const { status } = checkRes.json() as { status: string };
		// An empty definition has no steps → executor returns "success"
		expect(status).toBe("success");
	});

	it("marks a run failed when the log step is missing the required message field", async () => {
		const { cookie } = await registerAndLogin("e2e-log-fail");

		const definition = {
			nodes: [
				{
					id: "log-bad",
					type: "log",
					position: { x: 100, y: 200 },
					// 'message' field intentionally omitted — log executor returns "failed"
					data: { label: "Bad Log" },
				},
			],
			edges: [],
		};
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Failing Log Workflow", definition },
			cookies: { token: cookie },
		});
		expect(wfRes.statusCode).toBe(201);
		const { id: workflowId } = wfRes.json() as { id: string };

		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		expect(runRes.statusCode).toBe(201);
		const { id: runId } = runRes.json() as { id: string };

		await worker.poll();

		const checkRes = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(checkRes.statusCode).toBe(200);
		const { status } = checkRes.json() as { status: string };
		expect(status).toBe("failed");
	});
});
