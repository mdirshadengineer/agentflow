import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
// Must be declared before any module that transitively imports getDb() or
// getRawSqlite() is imported, because vi.mock() is hoisted by vitest.
vi.mock("../../db/connection.js", async () => {
	const { default: Database } = await import("better-sqlite3");
	const { drizzle } = await import("drizzle-orm/better-sqlite3");
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite);
	return { getDb: () => db, getRawSqlite: () => sqlite };
});

// ── Imports after mock ────────────────────────────────────────────────────────
import { eq } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { runMigrations } from "../../db/migrate.js";
import { users, workflows, workflowRuns } from "../../db/schema.js";
import { SqliteRunLogger } from "../sqlite-run-logger.js";

// ── Seed helpers ──────────────────────────────────────────────────────────────

const TEST_USER_ID = randomUUID();
const TEST_WORKFLOW_ID = randomUUID();

beforeAll(() => {
	runMigrations();
	const db = getDb();
	// Insert a user and workflow so that workflow_runs FK constraint is satisfied.
	db.insert(users)
		.values({
			id: TEST_USER_ID,
			email: "logger-test@example.com",
			passwordHash: "hash",
		})
		.run();
	db.insert(workflows)
		.values({
			id: TEST_WORKFLOW_ID,
			name: "Test Workflow",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRunId() {
	const id = randomUUID();
	const db = getDb();
	db.insert(workflowRuns)
		.values({ id, workflowId: TEST_WORKFLOW_ID, status: "running" })
		.run();
	return id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SqliteRunLogger", () => {
	describe("initStep()", () => {
		it("inserts a step row with pending status", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			const logs = await logger.getLogsForRun(runId);
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("pending");
			expect(step?.logs).toBeNull();
		});
	});

	describe("startStep()", () => {
		it("updates the step to running status with a startedAt timestamp", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.startStep(runId, "step-a");
			const logs = await logger.getLogsForRun(runId);
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("running");
			expect(step?.startedAt).toBeInstanceOf(Date);
		});
	});

	describe("completeStep()", () => {
		it("updates the step to success with logs and finishedAt", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.startStep(runId, "step-a");
			await logger.completeStep(runId, "step-a", "output log");
			const logs = await logger.getLogsForRun(runId);
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("success");
			expect(step?.logs).toBe("output log");
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});

	describe("failStep()", () => {
		it("updates the step to failed with logs and finishedAt", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.failStep(runId, "step-a", "error message");
			const logs = await logger.getLogsForRun(runId);
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("failed");
			expect(step?.logs).toBe("error message");
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});

	describe("skipStep()", () => {
		it("updates the step to skipped with a reason and timestamps", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.skipStep(runId, "step-a", "upstream failed");
			const logs = await logger.getLogsForRun(runId);
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("skipped");
			expect(step?.logs).toBe("upstream failed");
			expect(step?.startedAt).toBeInstanceOf(Date);
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});

	describe("getLogsForRun()", () => {
		it("returns an empty array for a run with no steps", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			const logs = await logger.getLogsForRun(runId);
			expect(logs).toEqual([]);
		});

		it("returns all step rows for the run", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.initStep(runId, "step-b");
			const logs = await logger.getLogsForRun(runId);
			expect(logs).toHaveLength(2);
			const names = logs.map((l) => l.stepName).sort();
			expect(names).toEqual(["step-a", "step-b"]);
		});

		it("does not include steps from other runs", async () => {
			const logger = new SqliteRunLogger();
			const runId1 = makeRunId();
			const runId2 = makeRunId();
			await logger.initStep(runId1, "step-only-in-run1");
			const logsForRun2 = await logger.getLogsForRun(runId2);
			expect(logsForRun2.find((l) => l.stepName === "step-only-in-run1")).toBeUndefined();
		});
	});

	describe("streamLogsForRun()", () => {
		it("yields a step_complete event for each completed step", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			await logger.completeStep(runId, "step-a", "log output");

			const events = [];
			for await (const event of logger.streamLogsForRun(runId)) {
				events.push(event);
			}
			expect(events).toHaveLength(1);
			expect(events[0]?.type).toBe("step_complete");
			expect(events[0]?.stepName).toBe("step-a");
			expect(events[0]?.runId).toBe(runId);
			expect(events[0]?.status).toBe("success");
			expect(events[0]?.logs).toBe("log output");
		});

		it("omits the logs field when the step has no logs", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			await logger.initStep(runId, "step-a");
			// step stays in pending (logs = null)

			const events = [];
			for await (const event of logger.streamLogsForRun(runId)) {
				events.push(event);
			}
			expect(events[0]).not.toHaveProperty("logs");
		});

		it("yields nothing for a run with no steps", async () => {
			const logger = new SqliteRunLogger();
			const runId = makeRunId();
			const events = [];
			for await (const event of logger.streamLogsForRun(runId)) {
				events.push(event);
			}
			expect(events).toHaveLength(0);
		});
	});
});
