import { describe, expect, it } from "vitest";
import { InMemoryRunLogger } from "../run-logger.js";

function makeLogger() {
	return new InMemoryRunLogger();
}

describe("InMemoryRunLogger", () => {
	describe("initStep()", () => {
		it("creates a step entry with pending status", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("pending");
			expect(step?.logs).toBeNull();
			expect(step?.startedAt).toBeNull();
			expect(step?.finishedAt).toBeNull();
		});

		it("creates independent entries for multiple steps", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.initStep("run-1", "step-b");
			const logs = await logger.getLogsForRun("run-1");
			expect(logs).toHaveLength(2);
		});
	});

	describe("startStep()", () => {
		it("transitions an existing step to running status", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.startStep("run-1", "step-a");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("running");
			expect(step?.startedAt).toBeInstanceOf(Date);
		});

		it("works even without a prior initStep call", async () => {
			const logger = makeLogger();
			await logger.startStep("run-1", "step-x");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-x");
			expect(step?.status).toBe("running");
		});
	});

	describe("completeStep()", () => {
		it("transitions a step to success with logs and finishedAt", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.startStep("run-1", "step-a");
			await logger.completeStep("run-1", "step-a", "all done");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("success");
			expect(step?.logs).toBe("all done");
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});

		it("preserves startedAt from a prior startStep call", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.startStep("run-1", "step-a");
			const before = await logger.getLogsForRun("run-1");
			const startedAt = before.find((l) => l.stepName === "step-a")?.startedAt;

			await logger.completeStep("run-1", "step-a", "done");
			const after = await logger.getLogsForRun("run-1");
			expect(after.find((l) => l.stepName === "step-a")?.startedAt).toEqual(
				startedAt,
			);
		});
	});

	describe("failStep()", () => {
		it("transitions a step to failed with logs", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.failStep("run-1", "step-a", "something broke");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("failed");
			expect(step?.logs).toBe("something broke");
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});

	describe("skipStep()", () => {
		it("transitions a step to skipped with a reason", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.skipStep("run-1", "step-a", "dependency failed");
			const logs = await logger.getLogsForRun("run-1");
			const step = logs.find((l) => l.stepName === "step-a");
			expect(step?.status).toBe("skipped");
			expect(step?.logs).toBe("dependency failed");
			expect(step?.startedAt).toBeInstanceOf(Date);
			expect(step?.finishedAt).toBeInstanceOf(Date);
		});
	});

	describe("getLogsForRun()", () => {
		it("returns an empty array for an unknown runId", async () => {
			const logger = makeLogger();
			const logs = await logger.getLogsForRun("no-such-run");
			expect(logs).toEqual([]);
		});

		it("returns logs only for the requested runId", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.initStep("run-2", "step-b");
			const run1Logs = await logger.getLogsForRun("run-1");
			expect(run1Logs).toHaveLength(1);
			expect(run1Logs[0]?.stepName).toBe("step-a");
		});

		it("returns all step entries for a run", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.initStep("run-1", "step-b");
			await logger.initStep("run-1", "step-c");
			const logs = await logger.getLogsForRun("run-1");
			expect(logs).toHaveLength(3);
		});
	});

	describe("streamLogsForRun()", () => {
		it("yields a LogEvent for each step in the run", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.completeStep("run-1", "step-a", "done");

			const events = [];
			for await (const event of logger.streamLogsForRun("run-1")) {
				events.push(event);
			}
			expect(events).toHaveLength(1);
			expect(events[0]?.type).toBe("step_complete");
			expect(events[0]?.stepName).toBe("step-a");
			expect(events[0]?.runId).toBe("run-1");
			expect(events[0]?.status).toBe("success");
		});

		it("includes logs in the event when the step has logs", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.completeStep("run-1", "step-a", "output text");

			const events = [];
			for await (const event of logger.streamLogsForRun("run-1")) {
				events.push(event);
			}
			expect(events[0]?.logs).toBe("output text");
		});

		it("omits the logs field when the step has no logs", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			// Don't complete step — logs stays null

			const events = [];
			for await (const event of logger.streamLogsForRun("run-1")) {
				events.push(event);
			}
			expect(events[0]).not.toHaveProperty("logs");
		});

		it("yields nothing for an unknown runId", async () => {
			const logger = makeLogger();
			const events = [];
			for await (const event of logger.streamLogsForRun("no-such-run")) {
				events.push(event);
			}
			expect(events).toHaveLength(0);
		});

		it("yields events for multiple steps", async () => {
			const logger = makeLogger();
			await logger.initStep("run-1", "step-a");
			await logger.initStep("run-1", "step-b");
			await logger.completeStep("run-1", "step-a", "a done");
			await logger.failStep("run-1", "step-b", "b failed");

			const events = [];
			for await (const event of logger.streamLogsForRun("run-1")) {
				events.push(event);
			}
			expect(events).toHaveLength(2);
		});
	});
});
