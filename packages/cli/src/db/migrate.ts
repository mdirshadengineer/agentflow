import Database from "better-sqlite3";
import { getRawSqlite } from "./connection.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a column already exists in a table using PRAGMA table_info.
 * This is version-agnostic and avoids relying on SQLite error message wording.
 */
function columnExists(
	raw: Database.Database,
	table: string,
	column: string,
): boolean {
	const rows = raw.pragma(`table_info(${table})`) as Array<{ name: string }>;
	return rows.some((r) => r.name === column);
}

/**
 * Check whether a version has already been applied.
 */
function isApplied(raw: Database.Database, version: number): boolean {
	const row = raw
		.prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
		.get(version);
	return row !== undefined;
}

/**
 * Record a successfully applied migration version.
 */
function markApplied(raw: Database.Database, version: number): void {
	raw
		.prepare(
			"INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
		)
		.run(version, Date.now());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function runMigrations() {
	const raw = getRawSqlite();

	// The version-tracking table must exist before any version check.
	raw.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version    INTEGER PRIMARY KEY,
		applied_at INTEGER NOT NULL
	)`);

	// ── Version 1: core tables ────────────────────────────────────────────────
	if (!isApplied(raw, 1)) {
		raw.transaction(() => {
			raw.exec(`CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
			)`);
			raw.exec(`CREATE TABLE IF NOT EXISTS agents (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				type TEXT NOT NULL,
				config TEXT NOT NULL DEFAULT '{}',
				owner_id TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
			)`);
			raw.exec(`CREATE TABLE IF NOT EXISTS workflows (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				definition TEXT NOT NULL DEFAULT '{}',
				owner_id TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
			)`);
			raw.exec(`CREATE TABLE IF NOT EXISTS workflow_runs (
				id TEXT PRIMARY KEY,
				workflow_id TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'queued',
				started_at INTEGER,
				finished_at INTEGER,
				output TEXT,
				FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
			)`);
			raw.exec(`CREATE TABLE IF NOT EXISTS workflow_run_steps (
				id TEXT PRIMARY KEY,
				run_id TEXT NOT NULL,
				step_name TEXT NOT NULL,
				status TEXT NOT NULL,
				logs TEXT,
				started_at INTEGER,
				finished_at INTEGER,
				FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
			)`);
			markApplied(raw, 1);
		})();
	}

	// ── Version 2: agent LLM columns ─────────────────────────────────────────
	if (!isApplied(raw, 2)) {
		raw.transaction(() => {
			for (const col of ["llm_provider", "llm_model", "system_prompt", "tools"]) {
				if (!columnExists(raw, "agents", col)) {
					raw.exec(`ALTER TABLE agents ADD COLUMN ${col} TEXT`);
				}
			}
			markApplied(raw, 2);
		})();
	}

	// ── Version 3: node_executions + agent_sessions tables ───────────────────
	if (!isApplied(raw, 3)) {
		raw.transaction(() => {
			raw.exec(`CREATE TABLE IF NOT EXISTS node_executions (
				id TEXT PRIMARY KEY,
				run_id TEXT NOT NULL,
				node_id TEXT NOT NULL,
				step_name TEXT NOT NULL,
				node_type TEXT NOT NULL,
				status TEXT NOT NULL,
				input_data TEXT,
				output_data TEXT,
				logs TEXT,
				started_at INTEGER,
				finished_at INTEGER,
				FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
			)`);
			raw.exec(`CREATE TABLE IF NOT EXISTS agent_sessions (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				workflow_run_id TEXT,
				messages TEXT NOT NULL DEFAULT '[]',
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
				FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
				FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL
			)`);
			markApplied(raw, 3);
		})();
	}
}
