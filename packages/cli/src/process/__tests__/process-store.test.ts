import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

let tmpDir: string;
let storeFile: string;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "agentflow-test-"));
	storeFile = join(tmpDir, "processes.json");
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("ProcessStore", () => {
	describe("load()", () => {
		it("returns an empty array when the file does not exist", () => {
			const store = new ProcessStore(storeFile);
			expect(store.load()).toEqual([]);
		});

		it("returns parsed records when the file exists", () => {
			const record = makeRecord();
			const store = new ProcessStore(storeFile);
			store.save([record]);
			expect(store.load()).toEqual([record]);
		});

		it("returns an empty array for a malformed JSON file", () => {
			const store = new ProcessStore(storeFile);
			// Write invalid JSON (create the dir first via a valid save)
			store.save([]);
			writeFileSync(storeFile, "not-json", "utf-8");
			expect(store.load()).toEqual([]);
		});
	});

	describe("save()", () => {
		it("writes processes to disk atomically (temp file swap)", () => {
			const store = new ProcessStore(storeFile);
			const record = makeRecord({ id: "proc-1" });
			store.save([record]);

			const raw = readFileSync(storeFile, "utf-8");
			const parsed = JSON.parse(raw) as ProcessRecord[];
			expect(parsed).toEqual([record]);
		});

		it("file does not exist after saving an empty array (still creates it)", () => {
			const store = new ProcessStore(storeFile);
			store.save([]);
			expect(existsSync(storeFile)).toBe(true);
		});
	});

	describe("add()", () => {
		it("adds a new record", () => {
			const store = new ProcessStore(storeFile);
			const record = makeRecord({ id: "proc-1" });
			store.add(record);
			expect(store.load()).toEqual([record]);
		});

		it("replaces an existing record with the same id", () => {
			const store = new ProcessStore(storeFile);
			const original = makeRecord({ id: "proc-1", pid: 100 });
			const updated = makeRecord({ id: "proc-1", pid: 200 });
			store.add(original);
			store.add(updated);
			const all = store.load();
			expect(all).toHaveLength(1);
			expect(all[0]?.pid).toBe(200);
		});
	});

	describe("remove()", () => {
		it("removes a record by id", () => {
			const store = new ProcessStore(storeFile);
			store.add(makeRecord({ id: "proc-1" }));
			store.add(makeRecord({ id: "proc-2" }));
			store.remove("proc-1");
			const all = store.load();
			expect(all).toHaveLength(1);
			expect(all[0]?.id).toBe("proc-2");
		});

		it("is a no-op when the id does not exist", () => {
			const store = new ProcessStore(storeFile);
			store.add(makeRecord({ id: "proc-1" }));
			store.remove("nonexistent");
			expect(store.load()).toHaveLength(1);
		});
	});
});
