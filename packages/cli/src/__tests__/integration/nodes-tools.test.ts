/**
 * Integration tests for the GET /api/v1/nodes and GET /api/v1/tools routes.
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

	// Register + login to get a valid cookie
	const email = "nodes-tools-test@example.com";
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

// ── Nodes route ───────────────────────────────────────────────────────────────

describe("GET /api/v1/nodes", () => {
	it("returns an array of node manifests when authenticated", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/nodes",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as unknown[];
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThan(0);
	});

	it("includes the built-in node types", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/nodes",
			cookies: { token: cookie },
		});
		const types = (res.json() as Array<{ type: string }>).map((m) => m.type);
		expect(types).toContain("noop");
		expect(types).toContain("http-request");
		expect(types).toContain("delay");
		expect(types).toContain("log");
	});

	it("every manifest entry has type, label, and description fields", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/nodes",
			cookies: { token: cookie },
		});
		for (const manifest of res.json() as Array<Record<string, unknown>>) {
			expect(typeof manifest.type).toBe("string");
			expect(typeof manifest.label).toBe("string");
			expect(typeof manifest.description).toBe("string");
		}
	});

	it("returns 401 when no token is provided", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/nodes" });
		expect(res.statusCode).toBe(401);
	});
});

// ── Tools route ───────────────────────────────────────────────────────────────

describe("GET /api/v1/tools", () => {
	it("returns an array when authenticated", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/tools",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json())).toBe(true);
	});

	it("each tool entry has name, description, and inputSchema fields", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/tools",
			cookies: { token: cookie },
		});
		for (const tool of res.json() as Array<Record<string, unknown>>) {
			expect(typeof tool.name).toBe("string");
			expect(typeof tool.description).toBe("string");
			expect(tool.inputSchema).toBeDefined();
		}
	});

	it("returns 401 when no token is provided", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/tools" });
		expect(res.statusCode).toBe(401);
	});
});
