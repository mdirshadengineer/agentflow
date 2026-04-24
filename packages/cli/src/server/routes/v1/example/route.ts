import type { FastifyInstance, FastifyReply } from "fastify";

export default async function (fastify: FastifyInstance) {
	fastify.get("/", async (_request: unknown, reply: FastifyReply) => {
		reply.send({ message: "This is an example route!" });
	});
}
