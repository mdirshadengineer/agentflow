import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AGENTFLOW_DATA_DIR } from "../global.config.js";

let _db: ReturnType<typeof drizzle> | undefined;
let _sqlite: Database.Database | undefined;

export function getDb() {
	if (!_db) {
		if (!existsSync(AGENTFLOW_DATA_DIR)) {
			mkdirSync(AGENTFLOW_DATA_DIR, { recursive: true });
		}
		_sqlite = new Database(join(AGENTFLOW_DATA_DIR, "db.sqlite"));
		_sqlite.pragma("journal_mode = WAL");
		_sqlite.pragma("foreign_keys = ON");
		_db = drizzle(_sqlite);
	}
	return _db;
}

/** Returns the underlying better-sqlite3 Database instance. */
export function getRawSqlite(): Database.Database {
	// Ensure the singleton is initialised.
	getDb();
	// biome-ignore lint/style/noNonNullAssertion: getDb() always initialises _sqlite
	return _sqlite!;
}
