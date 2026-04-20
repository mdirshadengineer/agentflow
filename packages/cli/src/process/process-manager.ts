import { spawn } from "node:child_process";
import {
	GRACEFUL_SHUTDOWN_TIMEOUT_MS,
	POLL_INTERVAL_MS,
} from "../global.config.js";
import { ProcessStore } from "./process-store.js";
import type { ProcessRecord } from "./process-types.js";

// Windows does not support POSIX signals — process.kill() only accepts
// numeric signals there, and only SIGKILL (9) is universally honoured.
// We normalise to the numeric equivalents so the same code path works
// on every platform.
const SIG = {
	TERM: process.platform === "win32" ? 9 : "SIGTERM", // no SIGTERM on Windows
	KILL: 9, // SIGKILL (numeric) is cross-platform safe
} as const;

/** Signal error codes that mean the process is already gone. */
const ALREADY_GONE_CODES = new Set(["ESRCH", "EPERM"]);
// EPERM can surface on some Linux kernels when the PID slot has been
// recycled and the caller lacks permission to signal the new owner;
// it is safer to treat it as "not our process anymore" than to abort.

/**
 * Attempts to send `signal` to `pid`.
 *
 * @returns `true` if the signal was delivered, or if the process is already gone
 * @throws Re-throws unexpected failures when sending the signal
 */
function trySend(pid: number, signal: string | number): boolean {
	try {
		process.kill(pid, signal);
		return true;
	} catch (err: unknown) {
		const code = (err as NodeJS.ErrnoException).code ?? "";
		if (ALREADY_GONE_CODES.has(code)) {
			// Race: process exited between isAlive() and kill() — that's fine,
			// our goal (the process is no longer running) is already achieved.
			return true;
		}
		// Unexpected error (e.g. EINVAL for a bad signal on this platform).
		// Bubble it up so the caller can decide.
		throw err;
	}
}

export class ProcessManager {
	constructor(private store = new ProcessStore()) {}

	private isDetachArg(arg: string): boolean {
		return arg === "--detach" || arg.startsWith("--detach=");
	}

	// -----------------------------
	// Start (Detached)
	// -----------------------------
	startDetached(args: string[], id = "default"): number {
		// IMPORTANT: ensure no recursive detach
		const filteredArgs = args.filter((arg) => !this.isDetachArg(arg));
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
			}
			// stale → dropped
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

		// Helper: remove from store and return — used in every exit path so
		// we never skip cleanup even when signals race with natural exit.
		const cleanup = () => this.store.remove(id);

		if (!this.isAlive(target.pid)) {
			cleanup();
			return;
		}

		if (force) {
			// trySend treats ESRCH/EPERM as success, so cleanup always runs.
			trySend(target.pid, SIG.KILL);
			cleanup();
			return;
		}

		// ── Graceful shutdown ────────────────────────────────────────────────
		// Send SIGTERM (or numeric 9 on Windows). If the process is already
		// gone at this instant, trySend returns true and we skip the wait.
		const termDelivered = trySend(target.pid, SIG.TERM);

		if (termDelivered) {
			const exited = await this.waitForExit(
				target.pid,
				GRACEFUL_SHUTDOWN_TIMEOUT_MS,
			);

			if (!exited) {
				// Escalate to SIGKILL. Again, guard the race: the process might
				// have exited in the brief gap between waitForExit timing out and
				// this call.
				trySend(target.pid, SIG.KILL);
			}
		}

		// Cleanup runs unconditionally — whether SIGTERM was delivered, the
		// process raced to exit, or SIGKILL was needed.
		cleanup();
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
