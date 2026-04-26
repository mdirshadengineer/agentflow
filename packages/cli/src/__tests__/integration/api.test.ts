/**
 * Integration tests for the Fastify API routes.
 *
 * An in-memory SQLite database is injected via vi.mock() so that tests are
 * isolated from the developer's real ~/.agentflow/db.sqlite.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
// Must be declared before any module that transitively imports getDb() is
// imported, because vi.mock() is hoisted to the top of the file by vitest.
vi.mock("../../db/connection.js", async () => {
	const { default: Database } = await import("better-sqlite3");
	const { drizzle } = await import("drizzle-orm/better-sqlite3");
	const db = drizzle(new Database(":memory:"));
	return { getDb: () => db };
});

// ── Test server and DB setup ──────────────────────────────────────────────────
import { runMigrations } from "../../db/migrate.js";
import { buildTestServer } from "../helpers/test-server.js";

type FastifyInstance = Awaited<ReturnType<typeof buildTestServer>>;

let app: FastifyInstance;

beforeAll(async () => {
	// Set up tables in the in-memory DB
	runMigrations();
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function registerAndLogin(
	emailSuffix: string,
): Promise<{ cookie: string; userId: string }> {
	const email = `test-${emailSuffix}@example.com`;
	const password = "password123";

	const regRes = await app.inject({
		method: "POST",
		url: "/api/v1/auth/register",
		payload: { email, password },
	});
	expect(regRes.statusCode).toBe(201);
	const { id: userId } = regRes.json() as { id: string };

	const loginRes = await app.inject({
		method: "POST",
		url: "/api/v1/auth/login",
		payload: { email, password },
	});
	expect(loginRes.statusCode).toBe(200);

	// Extract the token cookie from the Set-Cookie header
	const setCookie = loginRes.headers["set-cookie"] as string | string[];
	const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const token = cookieHeader?.split(";")[0]?.replace("token=", "") ?? "";
	return { cookie: token, userId };
}

// ── Health endpoint ───────────────────────────────────────────────────────────
describe("GET /health", () => {
	it("returns status ok", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ status: "ok" });
	});
});

// ── Auth routes ───────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/register", () => {
	it("creates a new user and returns 201", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload: { email: "register@example.com", password: "password123" },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json() as { id: string; email: string };
		expect(body.email).toBe("register@example.com");
		expect(body).toHaveProperty("id");
	});

	it("returns 409 when email is already registered", async () => {
		const payload = { email: "dup@example.com", password: "password123" };
		await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload,
		});
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload,
		});
		expect(res.statusCode).toBe(409);
	});

	it("returns 400 for an invalid email", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload: { email: "not-an-email", password: "password123" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("returns 400 for a password shorter than 8 characters", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload: { email: "short@example.com", password: "short" },
		});
		expect(res.statusCode).toBe(400);
	});
});

describe("POST /api/v1/auth/login", () => {
	it("returns 200 and sets a token cookie for valid credentials", async () => {
		const email = "login@example.com";
		const password = "password123";
		await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload: { email, password },
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email, password },
		});
		expect(res.statusCode).toBe(200);
		expect(res.headers["set-cookie"]).toBeDefined();
	});

	it("returns 401 for wrong password", async () => {
		const email = "wrong@example.com";
		await app.inject({
			method: "POST",
			url: "/api/v1/auth/register",
			payload: { email, password: "correctpass" },
		});
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email, password: "wrongpass" },
		});
		expect(res.statusCode).toBe(401);
	});
});

// ── Agent CRUD ────────────────────────────────────────────────────────────────
describe("Agents CRUD", () => {
	let cookie: string;

	beforeAll(async () => {
		({ cookie } = await registerAndLogin("agents-test"));
	});

	it("POST /api/v1/agents — creates an agent", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/agents",
			payload: { name: "Test Agent", type: "llm" },
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(201);
		const body = res.json() as { id: string; name: string; type: string };
		expect(body.name).toBe("Test Agent");
		expect(body.type).toBe("llm");
		expect(body).toHaveProperty("id");
	});

	it("GET /api/v1/agents — lists agents owned by the user", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/agents",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as unknown[];
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThan(0);
	});

	it("GET /api/v1/agents/:id — returns 404 for unknown id", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/agents/nonexistent-id",
			cookies: { token: cookie },
		});
		expect(res.statusCode).toBe(404);
	});

	it("DELETE /api/v1/agents/:id — deletes the agent", async () => {
		// First create one
		const create = await app.inject({
			method: "POST",
			url: "/api/v1/agents",
			payload: { name: "To Delete", type: "rpa" },
			cookies: { token: cookie },
		});
		const { id } = create.json() as { id: string };

		const del = await app.inject({
			method: "DELETE",
			url: `/api/v1/agents/${id}`,
			cookies: { token: cookie },
		});
		expect(del.statusCode).toBe(204);

		// Verify it's gone
		const get = await app.inject({
			method: "GET",
			url: `/api/v1/agents/${id}`,
			cookies: { token: cookie },
		});
		expect(get.statusCode).toBe(404);
	});

	it("returns 401 when no token is provided", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/agents" });
		expect(res.statusCode).toBe(401);
	});
});
