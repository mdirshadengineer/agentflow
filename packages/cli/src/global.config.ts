import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Persistent config file ────────────────────────────────────────────────────
// Always lives at ~/.agentflow/config.json regardless of AGENTFLOW_DATA_DIR so
// there is no circular dependency between the data-dir setting and its loader.
/** Absolute path of the persistent per-user config file. */
export const CONFIG_FILE_PATH = join(homedir(), ".agentflow", "config.json");

function loadConfigFile(): Record<string, string> {
	if (!existsSync(CONFIG_FILE_PATH)) return {};
	try {
		const raw = readFileSync(CONFIG_FILE_PATH, "utf-8");
		const parsed: unknown = JSON.parse(raw);
		if (
			parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed)
		) {
			const result: Record<string, string> = {};
			for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof v === "string") result[k] = v;
				else if (typeof v === "number") result[k] = String(v);
			}
			return result;
		}
	} catch {
		// Ignore malformed config files silently.
	}
	return {};
}

const _fileConfig = loadConfigFile();

// ── Global configuration ──────────────────────────────────────────────────────
// Priority: environment variable > config file > built-in default.

export const AGENTFLOW_DATA_DIR =
	process.env.AGENTFLOW_DATA_DIR ??
	_fileConfig["dataDir"] ??
	join(homedir(), ".agentflow");

export const AGENTFLOW_DEFAULT_COMMAND = "start";

export const AGENTFLOW_API_SERVER_PORT = Number(
	process.env.AGENTFLOW_PORT ?? _fileConfig["port"] ?? "3000",
);

const _jwtEnv = process.env.AGENTFLOW_JWT_SECRET;
if (!_jwtEnv && process.env.NODE_ENV === "production") {
	throw new Error("AGENTFLOW_JWT_SECRET must be set in production");
}
export const AGENTFLOW_JWT_SECRET =
	_jwtEnv ?? "agentflow-dev-secret-change-in-production";

export const POLL_INTERVAL_MS: number = 200; // 200ms

export const GRACEFUL_SHUTDOWN_TIMEOUT_MS: number = 5000; // 5 seconds
