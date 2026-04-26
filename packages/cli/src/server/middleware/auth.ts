import type { FastifyReply, FastifyRequest } from "fastify";

export const requireAuth = async (
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	try {
		await request.jwtVerify({ onlyCookie: true });
	} catch {
		return reply.code(401).send({ error: "Unauthorized" });
	}
};
