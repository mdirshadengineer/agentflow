import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// ---------------------------------------------------------------------------
// Persistence helpers — plain JSON file at ~/.agentflow/workflows.json
// ---------------------------------------------------------------------------

type WorkflowRecord = {
	id: string;
	name: string;
	description: string;
	graph: unknown; // serialised ReactFlow nodes + edges
	createdAt: string;
	updatedAt: string;
};

type WorkflowStore = Record<string, WorkflowRecord>;

const DATA_DIR = join(
	process.env.AGENTFLOW_DATA_DIR ?? join(homedir(), ".agentflow"),
);
const WORKFLOWS_FILE = join(DATA_DIR, "workflows.json");

async function readStore(): Promise<WorkflowStore> {
	try {
		const raw = await readFile(WORKFLOWS_FILE, "utf8");
		return JSON.parse(raw) as WorkflowStore;
	} catch {
		return {};
	}
}

async function writeStore(store: WorkflowStore): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
	await writeFile(WORKFLOWS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function generateId(): string {
	return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export default async function (fastify: FastifyInstance) {
	// GET /api/v1/workflows
	fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
		const store = await readStore();
		const workflows = Object.values(store).sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);
		return reply.send(workflows);
	});

	// POST /api/v1/workflows
	fastify.post(
		"/",
		async (
			request: FastifyRequest<{
				Body: { name?: string; description?: string; graph?: unknown };
			}>,
			reply: FastifyReply,
		) => {
			const body = request.body ?? {};
			const now = new Date().toISOString();
			const record: WorkflowRecord = {
				id: generateId(),
				name: (body.name as string) ?? "Untitled Workflow",
				description: (body.description as string) ?? "",
				graph: body.graph ?? { nodes: [], edges: [] },
				createdAt: now,
				updatedAt: now,
			};
			const store = await readStore();
			store[record.id] = record;
			await writeStore(store);
			return reply.code(201).send(record);
		},
	);

	// GET /api/v1/workflows/:id
	fastify.get(
		"/:id",
		async (
			request: FastifyRequest<{ Params: { id: string } }>,
			reply: FastifyReply,
		) => {
			const store = await readStore();
			const record = store[request.params.id];
			if (!record) {
				return reply.code(404).send({ error: "Workflow not found" });
			}
			return reply.send(record);
		},
	);

	// PUT /api/v1/workflows/:id
	fastify.put(
		"/:id",
		async (
			request: FastifyRequest<{
				Params: { id: string };
				Body: { name?: string; description?: string; graph?: unknown };
			}>,
			reply: FastifyReply,
		) => {
			const store = await readStore();
			const existing = store[request.params.id];
			if (!existing) {
				return reply.code(404).send({ error: "Workflow not found" });
			}
			const body = request.body ?? {};
			const updated: WorkflowRecord = {
				...existing,
				name: (body.name as string) ?? existing.name,
				description: (body.description as string) ?? existing.description,
				graph: body.graph ?? existing.graph,
				updatedAt: new Date().toISOString(),
			};
			store[request.params.id] = updated;
			await writeStore(store);
			return reply.send(updated);
		},
	);

	// DELETE /api/v1/workflows/:id
	fastify.delete(
		"/:id",
		async (
			request: FastifyRequest<{ Params: { id: string } }>,
			reply: FastifyReply,
		) => {
			const store = await readStore();
			if (!store[request.params.id]) {
				return reply.code(404).send({ error: "Workflow not found" });
			}
			delete store[request.params.id];
			await writeStore(store);
			return reply.code(204).send();
		},
	);
}
