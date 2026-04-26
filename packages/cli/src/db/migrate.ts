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
		FOREIGN KEY (owner_id) REFERENCES users(id)
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS workflows (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		definition TEXT NOT NULL DEFAULT '{}',
		owner_id TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
		FOREIGN KEY (owner_id) REFERENCES users(id)
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS workflow_runs (
		id TEXT PRIMARY KEY,
		workflow_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'queued',
		started_at INTEGER,
		finished_at INTEGER,
		output TEXT,
		FOREIGN KEY (workflow_id) REFERENCES workflows(id)
	)`);
	db.run(sql`CREATE TABLE IF NOT EXISTS workflow_run_steps (
		id TEXT PRIMARY KEY,
		run_id TEXT NOT NULL,
		step_name TEXT NOT NULL,
		status TEXT NOT NULL,
		logs TEXT,
		started_at INTEGER,
		finished_at INTEGER,
		FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
	)`);
}
