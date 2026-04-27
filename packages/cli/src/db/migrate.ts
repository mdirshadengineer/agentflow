import { sql } from "drizzle-orm";
import { getDb } from "./connection.js";

export function runMigrations() {
	const db = getDb();
	db.run(sql`CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS agents (
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
	db.run(sql`CREATE TABLE IF NOT EXISTS workflows (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		definition TEXT NOT NULL DEFAULT '{}',
		owner_id TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
		FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS workflow_runs (
		id TEXT PRIMARY KEY,
		workflow_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'queued',
		started_at INTEGER,
		finished_at INTEGER,
		output TEXT,
		FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS workflow_run_steps (
		id TEXT PRIMARY KEY,
		run_id TEXT NOT NULL,
		step_name TEXT NOT NULL,
		status TEXT NOT NULL,
		logs TEXT,
		started_at INTEGER,
		finished_at INTEGER,
		FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
	)`);

	// Add new columns to agents (idempotent — ignore if already present)
	for (const ddl of [
		`ALTER TABLE agents ADD COLUMN llm_provider TEXT`,
		`ALTER TABLE agents ADD COLUMN llm_model TEXT`,
		`ALTER TABLE agents ADD COLUMN system_prompt TEXT`,
		`ALTER TABLE agents ADD COLUMN tools TEXT`,
	]) {
		try {
			db.run(sql.raw(ddl));
		} catch {
			// column already exists — safe to ignore
		}
	}

	db.run(sql`CREATE TABLE IF NOT EXISTS node_executions (
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

	db.run(sql`CREATE TABLE IF NOT EXISTS agent_sessions (
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
}
