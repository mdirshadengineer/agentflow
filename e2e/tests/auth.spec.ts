/**
 * E2E tests for authentication flows:
 *  - Login page rendering
 *  - Successful login navigates to /dashboard
 *  - Invalid credentials shows an error
 *  - Signup page navigation from login
 *  - Signup with a new user navigates to /dashboard
 *  - Duplicate registration shows an error
 *  - Logout redirects to /login
 *  - Protected routes redirect unauthenticated users to /login
 */
import { expect, test } from "@playwright/test";
import { LoginPage } from "../pages/login-page.js";
import { SignupPage } from "../pages/signup-page.js";
import { AUTH_STATE_FILE } from "../fixtures/auth.js";

const BASE_EMAIL = "auth-e2e";

/** Generate a unique email address for each test run so tests are isolated. */
function uniqueEmail(suffix: string) {
	return `${BASE_EMAIL}-${suffix}-${Date.now()}@agentflow.test`;
}

// ── Login ──────────────────────────────────────────────────────────────────────

test.describe("Login page", () => {
	test("renders the login form with email and password fields", async ({
		page,
	}) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();

		await expect(page).toHaveTitle(/agentflow/i);
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(
			page.getByRole("button", { name: /login/i }),
		).toBeVisible();
	});

	test("shows a link to the signup page", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.expectSignupLinkVisible();
	});

	test("redirects to /dashboard after a successful login", async ({ page }) => {
		// The E2E test user was registered in global.setup.ts
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.login("e2e-test@agentflow.test", "e2e-password-123");
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
	});

	test("shows an error for invalid credentials", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.login("nobody@example.com", "wrongpassword");
		await loginPage.expectErrorVisible();
		// URL should remain at /login
		await expect(page).toHaveURL(/\/login/);
	});

	test("shows an error for a correct email but wrong password", async ({
		page,
	}) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.login("e2e-test@agentflow.test", "wrong-password-xyz");
		await loginPage.expectErrorVisible();
	});
});

// ── Signup ─────────────────────────────────────────────────────────────────────

test.describe("Signup page", () => {
	test("renders the signup form", async ({ page }) => {
		const signupPage = new SignupPage(page);
		await signupPage.goto();

		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
	});

	test("navigates to signup page from the login link", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.clickSignupLink();
		await expect(page).toHaveURL(/\/signup/);
	});

	test("successfully registers a new user and redirects to /dashboard", async ({
		page,
	}) => {
		const signupPage = new SignupPage(page);
		await signupPage.goto();
		const email = uniqueEmail("new-user");
		await signupPage.signUp(email, "newuser-password-123");
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
	});

	test("shows an error when registering a duplicate email", async ({
		page,
	}) => {
		const signupPage = new SignupPage(page);
		await signupPage.goto();
		// Use the pre-seeded test user email which already exists
		await signupPage.signUp("e2e-test@agentflow.test", "e2e-password-123");
		await signupPage.expectErrorVisible();
	});
});

// ── Protected routes ───────────────────────────────────────────────────────────

test.describe("Protected routes", () => {
	test("redirects /dashboard to /login when not authenticated", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
	});

	test("redirects /workflows to /login when not authenticated", async ({
		page,
	}) => {
		await page.goto("/workflows");
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
	});

	test("redirects /agents to /login when not authenticated", async ({
		page,
	}) => {
		await page.goto("/agents");
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
	});
});

// ── Logout ─────────────────────────────────────────────────────────────────────

test.describe("Logout", () => {
	test("logout button redirects to /login and clears the session", async ({
		browser,
	}) => {
		// Create an authenticated context using the saved storage state
		const context = await browser.newContext({ storageState: AUTH_STATE_FILE });
		const page = await context.newPage();

		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);

		// Click the logout button (ghost icon-button in the header)
		await page.getByRole("button", { name: /log out/i }).click();
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

		// Attempting to navigate back to dashboard should redirect to login
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

		await context.close();
	});
});
