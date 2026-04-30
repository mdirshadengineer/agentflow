/**
 * Global test setup – runs once before all test suites.
 *
 * Responsibilities:
 *  1. Seed a persistent "E2E test user" so that the auth storage state file
 *     is valid for the whole test run.
 *  2. Save the browser storage state (cookie) to disk so that authenticated
 *     tests can skip the login step.
 */
import { expect, test as setup } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.AGENTFLOW_E2E_BASE_URL ?? "http://localhost:3000";

export const TEST_USER_EMAIL = "e2e-test@agentflow.test";
export const TEST_USER_PASSWORD = "e2e-password-123";

/** Path where the authenticated storage state is saved. */
export const AUTH_STATE_FILE = path.join(
	import.meta.dirname,
	".auth",
	"user.json",
);

/**
 * Register the test user (idempotent – silently ignores 409 Conflict so the
 * user is only created once even if the server is reused across runs).
 */
async function ensureTestUserExists(): Promise<void> {
	const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: TEST_USER_EMAIL,
			password: TEST_USER_PASSWORD,
		}),
	});

	if (!res.ok && res.status !== 409) {
		const body = (await res.json()) as { error?: string };
		throw new Error(
			`Failed to register test user: ${body.error ?? res.statusText}`,
		);
	}
}

setup("create authenticated session", async ({ page }) => {
	// Ensure the .auth directory exists
	const authDir = path.dirname(AUTH_STATE_FILE);
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true });
	}

	// Register the test user (idempotent)
	await ensureTestUserExists();

	// Navigate to login and authenticate
	await page.goto("/login");
	await page.getByLabel("Email").fill(TEST_USER_EMAIL);
	await page.getByLabel("Password").fill(TEST_USER_PASSWORD);
	await page.getByRole("button", { name: /login/i }).click();

	// Wait for redirect to dashboard
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

	// Save the storage state (cookies + localStorage)
	await page.context().storageState({ path: AUTH_STATE_FILE });
});
