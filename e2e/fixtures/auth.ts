/**
 * Custom Playwright fixtures.
 *
 * `authenticatedPage` – a page that is already logged in as the E2E test user.
 * It reuses the storage state saved by `global.setup.ts` so no additional
 * network round-trips are needed per test.
 */
import { test as base, type Page } from "@playwright/test";
import * as path from "node:path";

export const AUTH_STATE_FILE = path.join(
	import.meta.dirname,
	"..",
	".auth",
	"user.json",
);

export const TEST_USER_EMAIL = "e2e-test@agentflow.test";
export const TEST_USER_PASSWORD = "e2e-password-123";

type Fixtures = {
	authenticatedPage: Page;
};

/**
 * Drop-in replacement for `test` that provides an `authenticatedPage` fixture
 * pre-seeded with the test user's session cookie.
 */
export const test = base.extend<Fixtures>({
	authenticatedPage: async ({ browser }, use) => {
		const context = await browser.newContext({
			storageState: AUTH_STATE_FILE,
		});
		const page = await context.newPage();
		await use(page);
		await context.close();
	},
});

export { expect } from "@playwright/test";
