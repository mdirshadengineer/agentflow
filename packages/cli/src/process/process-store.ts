import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProcessRecord } from "./process-types.js";

const PROCESS_FILE = join(homedir(), ".agentflow", "processes.json");

export class ProcessStore {
	private file = PROCESS_FILE;

	private ensureDir() {
		const dir = dirname(this.file);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
	}

	load(): ProcessRecord[] {
		this.ensureDir();

		if (!existsSync(this.file)) return [];

		try {
			const content = readFileSync(this.file, "utf-8");
			return JSON.parse(content) as ProcessRecord[];
		} catch {
			// corrupted file fallback
			return [];
		}
	}

	save(processes: ProcessRecord[]): void {
		this.ensureDir();

		const tmp = `${this.file}.tmp`;
		writeFileSync(tmp, JSON.stringify(processes, null, 2));
		renameSync(tmp, this.file);
	}

	add(record: ProcessRecord): void {
		const processes = this.load();

		// overwrite same id (current design: single instance "default")
		const updated = processes.filter((p) => p.id !== record.id);
		updated.push(record);

		this.save(updated);
	}

	remove(id: string): void {
		const processes = this.load();
		const updated = processes.filter((p) => p.id !== id);
		this.save(updated);
	}
}
