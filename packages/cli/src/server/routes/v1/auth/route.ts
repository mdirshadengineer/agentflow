import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getDb, users } from "../../../../db/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isProduction = process.env.NODE_ENV === "production";

const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
	try {
		await request.jwtVerify({ onlyCookie: true });
	} catch {
		reply.code(401).send({ error: "Unauthorized" });
	}
};

export default async function authRoutes(fastify: FastifyInstance) {
	// POST /api/v1/auth/register
	fastify.post<{ Body: { email: string; password: string } }>(
		"/register",
		async (request, reply) => {
			const { email, password } = request.body;
			if (!email || !EMAIL_RE.test(email) || !password || password.length < 8) {
				return reply
					.code(400)
					.send({ error: "Invalid email or password (min 8 chars)" });
			}
			const db = getDb();
			const existing = db
				.select()
				.from(users)
				.where(eq(users.email, email))
				.get();
			if (existing) {
				return reply.code(409).send({ error: "Email already registered" });
			}
			const passwordHash = await bcrypt.hash(password, 12);
			const id = randomUUID();
			db.insert(users).values({ id, email, passwordHash }).run();
			const token = fastify.jwt.sign({ userId: id, email });
			return reply
				.setCookie("token", token, {
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
				})
				.code(201)
				.send({ id, email });
		},
	);

	// POST /api/v1/auth/login
	fastify.post<{ Body: { email: string; password: string } }>(
		"/login",
		async (request, reply) => {
			const { email, password } = request.body;
			if (!email || !password) {
				return reply.code(400).send({ error: "Email and password required" });
			}
			const db = getDb();
			const user = db.select().from(users).where(eq(users.email, email)).get();
			if (!user) {
				return reply.code(401).send({ error: "Invalid credentials" });
			}
			const valid = await bcrypt.compare(password, user.passwordHash);
			if (!valid) {
				return reply.code(401).send({ error: "Invalid credentials" });
			}
			const token = fastify.jwt.sign({
				userId: user.id,
				email: user.email,
			});
			return reply
				.setCookie("token", token, {
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
				})
				.send({ id: user.id, email: user.email });
		},
	);

	// POST /api/v1/auth/logout
	fastify.post("/logout", async (_request, reply) => {
		return reply.clearCookie("token", { path: "/" }).send({ ok: true });
	});

	// GET /api/v1/auth/me  (protected)
	fastify.get("/me", { preHandler: requireAuth }, async (request, reply) => {
		const payload = request.user as { userId: string; email: string };
		const db = getDb();
		const user = db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.id, payload.userId))
			.get();
		if (!user) {
			return reply.code(404).send({ error: "User not found" });
		}
		return reply.send(user);
	});
}
