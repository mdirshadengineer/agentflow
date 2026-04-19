import { spawn } from "node:child_process";
import {
	GRACEFUL_SHUTDOWN_TIMEOUT_MS,
	POLL_INTERVAL_MS,
} from "../global.config.js";
import { ProcessStore } from "./process-store.js";
import type { ProcessRecord } from "./process-types.js";

export class ProcessManager {
	constructor(private store = new ProcessStore()) {}

	// -----------------------------
	// Start (Detached)
	// -----------------------------
	startDetached(args: string[], id = "default"): number {
		// IMPORTANT: ensure no recursive detach
		const filteredArgs = args.filter((arg) => arg !== "--detach");

		const child = spawn(process.execPath, filteredArgs, {
			detached: true,
			stdio: "ignore",
		});

		child.unref();

		if (child.pid === undefined) {
			throw new Error(
				"Failed to start detached process: child PID is undefined. Check system logs for more details.",
			);
		}

		const record: ProcessRecord = {
			id,
			pid: child.pid,
			command: filteredArgs[0] ?? "",
			args: filteredArgs,
			startedAt: Date.now(),
		};

		this.store.add(record);

		return record.pid;
	}

	// -----------------------------
	// List (Self-Healing)
	// -----------------------------
	list(): ProcessRecord[] {
		const processes = this.store.load();

		const alive: ProcessRecord[] = [];

		for (const p of processes) {
			if (this.isAlive(p.pid)) {
				alive.push(p);
			} else {
				// stale → dropped
			}
		}

		// persist cleaned state
		this.store.save(alive);

		return alive;
	}

	// -----------------------------
	// Stop
	// -----------------------------
	async stop(id = "default", force = false): Promise<void> {
		const processes = this.store.load();
		const target = processes.find((p) => p.id === id);

		if (!target) {
			throw new Error(`Process "${id}" not found`);
		}

		if (!this.isAlive(target.pid)) {
			// already dead → cleanup
			this.store.remove(id);
			return;
		}

		if (force) {
			process.kill(target.pid, "SIGKILL");
			this.store.remove(id);
			return;
		}

		// graceful shutdown
		process.kill(target.pid, "SIGTERM");

		const exited = await this.waitForExit(
			target.pid,
			GRACEFUL_SHUTDOWN_TIMEOUT_MS,
		);

		if (!exited) {
			process.kill(target.pid, "SIGKILL");
		}

		this.store.remove(id);
	}

	// -----------------------------
	// Helpers
	// -----------------------------
	private isAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
		const start = Date.now();

		while (Date.now() - start < timeoutMs) {
			if (!this.isAlive(pid)) return true;
			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		}

		return false;
	}
}
