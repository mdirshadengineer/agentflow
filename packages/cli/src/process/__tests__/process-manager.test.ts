import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessManager } from "../process-manager.js";
import { ProcessStore } from "../process-store.js";
import type { ProcessRecord } from "../process-types.js";

function makeRecord(overrides: Partial<ProcessRecord> = {}): ProcessRecord {
	return {
		id: "default",
		pid: 12345,
		command: "node",
		args: ["server.js"],
		startedAt: Date.now(),
		...overrides,
	};
}

/** Build a ProcessManager backed by an isolated temp-dir store. */
function makeManager() {
	const dir = mkdtempSync(join(tmpdir(), "agentflow-pm-"));
	const file = join(dir, "processes.json");
	const store = new ProcessStore(file);
	return { manager: new ProcessManager(store), store, dir };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ProcessManager", () => {
	describe("list()", () => {
		it("returns an empty array when no processes are stored", () => {
			const { manager } = makeManager();
			expect(manager.list()).toEqual([]);
		});

		it("includes processes that are alive", () => {
			const { manager, store } = makeManager();
			const rec = makeRecord({ id: "alive", pid: 11111 });
			store.add(rec);

			// Simulate an alive process (signal 0 does not throw)
			vi.spyOn(process, "kill").mockImplementation(
				(_pid: number, _sig?: string | number) => true,
			);

			const result = manager.list();
			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe("alive");
		});

		it("filters out processes that are no longer alive", () => {
			const { manager, store } = makeManager();
			store.add(makeRecord({ id: "dead", pid: 99999 }));

			vi.spyOn(process, "kill").mockImplementation(
				(pid: number, _sig?: string | number) => {
					if (pid === 99999)
						throw Object.assign(new Error("no such process"), {
							code: "ESRCH",
						});
					return true;
				},
			);

			expect(manager.list()).toEqual([]);
		});
	});

	describe("stop()", () => {
		it("throws when the process is not found in the store", async () => {
			const { manager } = makeManager();
			await expect(manager.stop("nonexistent")).rejects.toThrow(
				'Process "nonexistent" not found',
			);
		});

		it("cleans up a stale process entry without signalling", async () => {
			const { manager, store } = makeManager();
			store.add(makeRecord({ id: "default", pid: 99999 }));

			// Process is already gone — signal 0 throws ESRCH
			vi.spyOn(process, "kill").mockImplementation(
				(pid: number, _sig?: string | number) => {
					if (pid === 99999)
						throw Object.assign(new Error("no such process"), {
							code: "ESRCH",
						});
					return true;
				},
			);

			await expect(manager.stop("default")).resolves.toBeUndefined();
			expect(store.load()).toEqual([]);
		});
	});
});
