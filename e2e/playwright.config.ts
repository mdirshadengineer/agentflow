import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration for AgentFlow.
 *
 * Test execution requires both the Fastify API server and the Vite dev server
 * to be running. The `webServer` option below starts both automatically.
 *
 * Environment variables:
 *   AGENTFLOW_E2E_BASE_URL  – override the base URL (default: http://localhost:3000)
 *   AGENTFLOW_DATA_DIR       – path to the test data directory
 */

const BASE_URL = process.env.AGENTFLOW_E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
	testDir: "./tests",
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Sequential workers to avoid DB race conditions */
	workers: 1,
	/* Reporter to use */
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report", open: "never" }],
	],
	/* Shared settings for all the projects below */
	use: {
		baseURL: BASE_URL,
		/* Collect trace when retrying the failed test */
		trace: "on-first-retry",
		/* Take screenshot on failure */
		screenshot: "only-on-failure",
		/* Default timeout for actions */
		actionTimeout: 10_000,
		/* Navigation timeout */
		navigationTimeout: 30_000,
	},

	projects: [
		/* Setup project that handles authentication */
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
			teardown: "teardown",
		},
		{
			name: "teardown",
			testMatch: /global\.teardown\.ts/,
		},
		/* Main test project using Chromium */
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			dependencies: ["setup"],
		},
	],

	/* Start both the Vite dev server and the Fastify API server */
	webServer: [
		{
			/* Vite UI dev server */
			command: `cd ${import.meta.dirname}/../app && pnpm vite --port 5173`,
			url: "http://localhost:5173",
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
		{
			/* Fastify API server (proxies non-API routes to Vite) */
			command: `cd ${import.meta.dirname}/../packages/cli && pnpm exec tsx src/dev/main.ts`,
			url: `${BASE_URL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
			env: {
				AGENTFLOW_DATA_DIR: "/tmp/agentflow-e2e",
				AGENTFLOW_PORT: "3000",
				NODE_ENV: "development",
			},
		},
	],

	/* Output directory for test artifacts */
	outputDir: "test-results",
});
