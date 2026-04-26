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
}
