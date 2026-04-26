import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastify from "fastify";
import { describe, expect, it } from "vitest";
import { requireAuth } from "../auth.js";

async function buildTestApp() {
	const app = fastify({ logger: false });
	await app.register(fastifyCookie);
	await app.register(fastifyJwt, {
		secret: "test-secret-for-auth-middleware",
		cookie: { cookieName: "token", signed: false },
	});
	app.get("/protected", { preHandler: requireAuth }, async () => ({
		ok: true,
	}));
	await app.ready();
	return app;
}

describe("requireAuth middleware", () => {
	it("returns 401 when no token cookie is provided", async () => {
		const app = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/protected" });
		expect(res.statusCode).toBe(401);
		expect(res.json()).toEqual({ error: "Unauthorized" });
	});

	it("returns 401 when the token cookie is invalid", async () => {
		const app = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/protected",
			cookies: { token: "not.a.valid.jwt" },
		});
		expect(res.statusCode).toBe(401);
	});

	it("returns 200 and the route response when a valid JWT cookie is provided", async () => {
		const app = await buildTestApp();
		const token = app.jwt.sign({
			userId: "user-1",
			email: "test@example.com",
		});
		const res = await app.inject({
			method: "GET",
			url: "/protected",
			cookies: { token },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("does not accept a Bearer header (cookie-only mode)", async () => {
		const app = await buildTestApp();
		const token = app.jwt.sign({ userId: "user-1", email: "a@b.com" });
		const res = await app.inject({
			method: "GET",
			url: "/protected",
			headers: { authorization: `Bearer ${token}` },
		});
		// No cookie → 401
		expect(res.statusCode).toBe(401);
	});
});
