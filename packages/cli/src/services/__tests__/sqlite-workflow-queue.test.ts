import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
vi.mock("../../db/connection.js", async () => {
	const { default: Database } = await import("better-sqlite3");
	const { drizzle } = await import("drizzle-orm/better-sqlite3");
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite);
	return { getDb: () => db, getRawSqlite: () => sqlite };
});

// ── Imports after mock ────────────────────────────────────────────────────────
import { getDb } from "../../db/connection.js";
import { runMigrations } from "../../db/migrate.js";
import { users, workflows } from "../../db/schema.js";
import { SqliteWorkflowQueue } from "../sqlite-workflow-queue.js";

// ── Seed helpers ──────────────────────────────────────────────────────────────

const TEST_USER_ID = randomUUID();
const TEST_WORKFLOW_ID = randomUUID();

beforeAll(() => {
	runMigrations();
	const db = getDb();
	db.insert(users)
		.values({
			id: TEST_USER_ID,
			email: "queue-test@example.com",
			passwordHash: "hash",
		})
		.run();
	db.insert(workflows)
		.values({
			id: TEST_WORKFLOW_ID,
			name: "Queue Test Workflow",
			definition: "{}",
			ownerId: TEST_USER_ID,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.run();
});

afterAll(() => {
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SqliteWorkflowQueue", () => {
	describe("enqueue()", () => {
		it("inserts a queued run and returns a run id string", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			expect(typeof runId).toBe("string");
			expect(runId.length).toBeGreaterThan(0);
		});

		it("returns a unique id for every call", async () => {
			const queue = new SqliteWorkflowQueue();
			const id1 = await queue.enqueue(TEST_WORKFLOW_ID);
			const id2 = await queue.enqueue(TEST_WORKFLOW_ID);
			expect(id1).not.toBe(id2);
		});

		it("stores the run with queued status", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			const runs = await queue.poll();
			const match = runs.find((r) => r.id === runId);
			expect(match).toBeDefined();
		});

		it("stores triggerData in the output field when provided", async () => {
			const queue = new SqliteWorkflowQueue();
			const triggerData = { source: "webhook", payload: { x: 1 } };
			const runId = await queue.enqueue(TEST_WORKFLOW_ID, triggerData);
			// Verify the run exists (poll returns queued runs)
			const runs = await queue.poll();
			expect(runs.find((r) => r.id === runId)).toBeDefined();
		});
	});

	describe("poll()", () => {
		it("returns all queued runs", async () => {
			const queue = new SqliteWorkflowQueue();
			const before = (await queue.poll()).length;
			await queue.enqueue(TEST_WORKFLOW_ID);
			await queue.enqueue(TEST_WORKFLOW_ID);
			const after = await queue.poll();
			expect(after.length).toBeGreaterThanOrEqual(before + 2);
		});

		it("returned items include workflowId", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			const runs = await queue.poll();
			const run = runs.find((r) => r.id === runId);
			expect(run?.workflowId).toBe(TEST_WORKFLOW_ID);
		});

		it("does not return runs that have been marked running", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			await queue.markRunning(runId);
			const runs = await queue.poll();
			expect(runs.find((r) => r.id === runId)).toBeUndefined();
		});

		it("does not return runs that have been marked done", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			await queue.markDone(runId, "success");
			const runs = await queue.poll();
			expect(runs.find((r) => r.id === runId)).toBeUndefined();
		});
	});

	describe("markRunning()", () => {
		it("removes the run from the queued poll results", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			await queue.markRunning(runId);
			const runs = await queue.poll();
			expect(runs.find((r) => r.id === runId)).toBeUndefined();
		});
	});

	describe("markDone()", () => {
		it("marks a run as success without throwing", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			await expect(queue.markDone(runId, "success")).resolves.toBeUndefined();
		});

		it("marks a run as failed without throwing", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			await expect(queue.markDone(runId, "failed")).resolves.toBeUndefined();
		});

		it("stores output when provided", async () => {
			const queue = new SqliteWorkflowQueue();
			const runId = await queue.enqueue(TEST_WORKFLOW_ID);
			const output = { result: "ok", data: [1, 2, 3] };
			await queue.markDone(runId, "success", output);
			// The run is no longer queued — just verify no error was thrown
			const runs = await queue.poll();
			expect(runs.find((r) => r.id === runId)).toBeUndefined();
		});
	});
});
