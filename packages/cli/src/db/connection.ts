import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AGENTFLOW_DATA_DIR } from "../global.config.js";

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
	if (!_db) {
		if (!existsSync(AGENTFLOW_DATA_DIR)) {
			mkdirSync(AGENTFLOW_DATA_DIR, { recursive: true });
		}
		const sqlite = new Database(join(AGENTFLOW_DATA_DIR, "db.sqlite"));
		sqlite.pragma("journal_mode = WAL");
		sqlite.pragma("foreign_keys = ON");
		_db = drizzle(sqlite);
	}
	return _db;
}
