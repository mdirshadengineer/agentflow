/**
 * Integration tests for workflow-related API routes.
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
	const email = `wf-${emailSuffix}@example.com`;
	const password = "password123";
	const regRes = await app.inject({
		method: "POST",
		url: "/api/v1/auth/register",
		payload: { email, password },
	});
	expect(regRes.statusCode).toBe(201);

	const loginRes = await app.inject({
		method: "POST",
		url: "/api/v1/auth/login",
		payload: { email, password },
	});
	expect(loginRes.statusCode).toBe(200);

	const setCookie = loginRes.headers["set-cookie"] as string | string[];
	const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const token = cookieHeader?.split(";")[0]?.replace("token=", "") ?? "";
	return { cookie: token };
}

// ── Workflow CRUD ─────────────────────────────────────────────────────────────

describe("Workflows CRUD", () => {
	let cookie: string;

	beforeAll(async () => {
		({ cookie } = await registerAndLogin("workflows-crud"));
	});

	it("GET /api/v1/workflows — returns empty array initially", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/workflows",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json())).toBe(true);
	});

	it("POST /api/v1/workflows — creates a workflow and returns 201", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "My Workflow" },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json() as { id: string; name: string };
		expect(body.name).toBe("My Workflow");
		expect(body).toHaveProperty("id");
	});

	it("POST /api/v1/workflows — returns 400 when name is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: {},
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /api/v1/workflows — stores definition when provided", async () => {
		const definition = { steps: [{ name: "s1", type: "noop" }] };
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "With Definition", definition },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json() as { definition: unknown };
		expect(body.definition).toEqual(definition);
	});

	it("GET /api/v1/workflows/:id — returns the workflow when found", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Fetchable Workflow" },
			cookies: { token: cookie },
		});
		const { id } = create.json() as { id: string };

		const res = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${id}`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect((res.json() as { id: string }).id).toBe(id);
	});

	it("GET /api/v1/workflows/:id — returns 404 for unknown id", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/workflows/no-such-id",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("PATCH /api/v1/workflows/:id — updates name", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Old Name" },
			cookies: { token: cookie },
		});
		const { id } = create.json() as { id: string };

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/workflows/${id}`,
			payload: { name: "New Name" },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect((res.json() as { name: string }).name).toBe("New Name");
	});

	it("PATCH /api/v1/workflows/:id — updates definition", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Update Def" },
			cookies: { token: cookie },
		});
		const { id } = create.json() as { id: string };
		const newDef = { steps: [{ name: "x", type: "log" }] };

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/workflows/${id}`,
			payload: { definition: newDef },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect((res.json() as { definition: unknown }).definition).toEqual(newDef);
	});

	it("PATCH /api/v1/workflows/:id — returns 404 for unknown id", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/workflows/no-such-id",
			payload: { name: "X" },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("DELETE /api/v1/workflows/:id — deletes the workflow", async () => {
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "To Delete" },
			cookies: { token: cookie },
		});
		const { id } = create.json() as { id: string };

		const del = await app.inject({
			method: "DELETE",
			url: `/api/v1/workflows/${id}`,
			cookies: { token: cookie },
		});
		expect(del.statusCode).toBe(204);

		const get = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${id}`,
			cookies: { token: cookie },
		});
		expect(get.statusCode).toBe(404);
	});

	it("DELETE /api/v1/workflows/:id — returns 404 for unknown id", async () => {
		const res = await app.inject({
			method: "DELETE",
			url: "/api/v1/workflows/no-such-id",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("GET /api/v1/workflows — returns 401 when no token is provided", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/workflows" });
		expect(res.statusCode).toBe(401);
	});
});

// ── Workflow runs ─────────────────────────────────────────────────────────────

describe("Workflow runs", () => {
	let cookie: string;
	let workflowId: string;

	beforeAll(async () => {
		({ cookie } = await registerAndLogin("workflows-runs"));
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/workflows",
			payload: { name: "Runnable Workflow" },
			cookies: { token: cookie },
		});
		workflowId = (create.json() as { id: string }).id;
	});

	it("POST /api/v1/workflows/:id/run — enqueues a run and returns 201", async () => {
		const res = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json() as { id: string; status: string; workflowId: string };
		expect(body.status).toBe("queued");
		expect(body.workflowId).toBe(workflowId);
	});

	it("POST /api/v1/workflows/:id/run — returns 404 for unknown workflow", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/workflows/no-such-id/run",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("GET /api/v1/workflows/:id/runs — lists runs for the workflow", async () => {
		const res = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const runs = res.json() as unknown[];
		expect(Array.isArray(runs)).toBe(true);
		expect(runs.length).toBeGreaterThan(0);
	});

	it("GET /api/v1/workflows/:id/runs — returns 404 for unknown workflow", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/workflows/no-such-id/runs",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("GET /api/v1/workflows/:id/runs/:runId — returns run with steps", async () => {
		const enqueue = await app.inject({
			method: "POST",
			url: `/api/v1/workflows/${workflowId}/run`,
			cookies: { token: cookie },
		});
		const { id: runId } = enqueue.json() as { id: string };

		const res = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/${runId}`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { id: string; steps: unknown[] };
		expect(body.id).toBe(runId);
		expect(Array.isArray(body.steps)).toBe(true);
	});

	it("GET /api/v1/workflows/:id/runs/:runId — returns 404 for unknown run", async () => {
		const res = await app.inject({
			method: "GET",
			url: `/api/v1/workflows/${workflowId}/runs/no-such-run`,
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});
});
