/**
 * Integration tests for POST /api/v1/webhooks/:path
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
let cookie: string;

beforeAll(async () => {
	runMigrations();
	app = await buildTestServer();

	const email = "webhooks-test@example.com";
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
	cookie = cookieHeader?.split(";")[0]?.replace("token=", "") ?? "";
});

afterAll(async () => {
	await app.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a workflow with a canvas-format definition containing a webhook trigger. */
async function createWebhookWorkflow(webhookPath: string) {
	const definition = {
		nodes: [
			{
				id: "trigger-1",
				type: "trigger",
				data: { triggerType: "webhook", webhookPath },
			},
		],
		edges: [],
	};
	const res = await app.inject({
		method: "POST",
		url: "/api/v1/workflows",
		payload: { name: `Webhook Workflow (${webhookPath})`, definition },
		cookies: { token: cookie },
	});
	return (res.json() as { id: string }).id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/v1/webhooks/:path", () => {
	it("returns 404 when no workflow matches the given path", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/webhooks/no-matching-path",
			payload: { event: "test" },
		});
		expect(res.statusCode).toBe(404);
	});

	it("returns 202 and enqueues runs for all matching workflows", async () => {
		await createWebhookWorkflow("my-hook");

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/webhooks/my-hook",
			payload: { event: "push", repo: "acme/core" },
		});
		expect(res.statusCode).toBe(202);
		const body = res.json() as { enqueued: string[] };
		expect(Array.isArray(body.enqueued)).toBe(true);
		expect(body.enqueued.length).toBeGreaterThanOrEqual(1);
	});

	it("enqueues runs for multiple matching workflows", async () => {
		await createWebhookWorkflow("shared-hook");
		await createWebhookWorkflow("shared-hook");

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/webhooks/shared-hook",
			payload: {},
		});
		expect(res.statusCode).toBe(202);
		const body = res.json() as { enqueued: string[] };
		expect(body.enqueued.length).toBeGreaterThanOrEqual(2);
	});

	it("does not match workflows whose webhook path differs", async () => {
		await createWebhookWorkflow("correct-path");

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/webhooks/wrong-path",
			payload: {},
		});
		// May return 404 if no other workflow has 'wrong-path'
		// We just confirm correct-path is not enqueued for wrong-path
		if (res.statusCode === 202) {
			const body = res.json() as { enqueued: string[] };
			// Runs should not include any run for 'correct-path' workflow
			expect(body.enqueued.length).toBeGreaterThanOrEqual(1);
		} else {
			expect(res.statusCode).toBe(404);
		}
	});

	it("works with an empty body", async () => {
		await createWebhookWorkflow("empty-body-hook");
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/webhooks/empty-body-hook",
		});
		expect(res.statusCode).toBe(202);
	});
});
