/**
 * Global teardown – runs once after all test suites complete.
 *
 * Cleans up the persisted auth state file created during global setup.
 */
import { test as teardown } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const AUTH_STATE_FILE = path.join(
	import.meta.dirname,
	".auth",
	"user.json",
);

teardown("remove auth state", async () => {
	if (fs.existsSync(AUTH_STATE_FILE)) {
		fs.rmSync(AUTH_STATE_FILE);
	}
	// Remove the .auth directory if it's empty
	const authDir = path.dirname(AUTH_STATE_FILE);
	try {
		if (
			fs.existsSync(authDir) &&
			fs.readdirSync(authDir).length === 0
		) {
			fs.rmdirSync(authDir);
		}
	} catch {
		// Ignore cleanup errors
	}
});
