/**
 * Integration tests for GET /api/v1/runs and GET /api/v1/runs/:id
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../db/connection.js", async () => {
	const { default: Database } = await import("better-sqlite3");
	const { drizzle } = await import("drizzle-orm/better-sqlite3");
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite);
	return { getDb: () => db, getRawSqlite: () => sqlite };
});

import { runMigrations } from "../../db/migrate.js";
import { buildTestServer } from "../helpers/test-server.js";

type FastifyInstance = Awaited<ReturnType<typeof buildTestServer>>;

let app: FastifyInstance;

beforeAll(async () => {
	runMigrations();
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

async function registerAndLogin(emailSuffix: string) {
	const email = `runs-${emailSuffix}@example.com`;
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

describe("GET /api/v1/runs", () => {
	it("returns 401 when not authenticated", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/runs" });
		expect(res.statusCode).toBe(401);
	});

	it("returns an empty array when the user has no workflows", async () => {
		const { cookie } = await registerAndLogin("no-workflows");
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/runs",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("lists runs after enqueuing one", async () => {
		const { cookie } = await registerAndLogin("with-run");

		// Create a workflow
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Runs Test Workflow" },
			cookies: { token: cookie },
		});
		const workflowId = (wfRes.json() as { id: string }).id;

		// Enqueue a run
		await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/runs",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const runs = res.json() as unknown[];
		expect(runs.length).toBeGreaterThanOrEqual(1);
	});
});

describe("GET /api/v1/runs/:id", () => {
	it("returns 401 when not authenticated", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/runs/some-id" });
		expect(res.statusCode).toBe(401);
	});

	it("returns 404 for an unknown run id", async () => {
		const { cookie } = await registerAndLogin("runs-404");
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/runs/no-such-run",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 403 when the run belongs to another user's workflow", async () => {
		// User A creates a workflow and a run
		const { cookie: cookieA } = await registerAndLogin("runs-owner");
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Owner Workflow" },
			cookies: { token: cookieA },
		});
		const workflowId = (wfRes.json() as { id: string }).id;
		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookieA },
		});
		const runId = (runRes.json() as { id: string }).id;

		// User B tries to access User A's run
		const { cookie: cookieB } = await registerAndLogin("runs-other");
		const res = await app.inject({
			method: "GET",
			url: `/api/v1/runs/${runId}`,
			cookies: { token: cookieB },
		});
		expect(res.statusCode).toBe(403);
	});

	it("returns the run with steps for the owner", async () => {
		const { cookie } = await registerAndLogin("runs-owner-ok");
		const wfRes = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Run With Steps Workflow" },
			cookies: { token: cookie },
		});
		const workflowId = (wfRes.json() as { id: string }).id;
		const runRes = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		const runId = (runRes.json() as { id: string }).id;

		const res = await app.inject({
			method: "GET",
			url: `/api/v1/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { id: string; steps: unknown[] };
		expect(body.id).toBe(runId);
		expect(Array.isArray(body.steps)).toBe(true);
	});
});
