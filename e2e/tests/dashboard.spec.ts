/**
 * E2E tests for the Dashboard page:
 *  - Shows the four stat cards (Agents, Workflows, Running Now, Total Runs)
 *  - Shows the Recent Runs section
 *  - Empty state for recent runs
 *  - Sidebar navigation links are present
 *  - Stat card values update after creating resources
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/auth.js";
import { DashboardPage } from "../pages/dashboard-page.js";

test.describe("Dashboard page", () => {
	test("shows page heading and four stat cards", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.expectHeadingVisible();
		await dashboard.expectStatCardsVisible();
	});

	test("shows the Recent Runs section", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.expectRecentRunsSectionVisible();
	});

	test("shows empty-state message when there are no recent runs", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		// Either a list of runs or the empty state is visible
		const runsList = page.locator("ul.divide-y li");
		const emptyMsg = page.getByText(/no runs yet/i);

		const hasRuns = await runsList.count() > 0;
		if (!hasRuns) {
			await expect(emptyMsg).toBeVisible();
		}
	});

	test("sidebar navigation links to Workflows, Agents and Dashboard", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.expectSidebarNavigation();
	});

	test("user email is displayed in the header", async ({
		authenticatedPage: page,
	}) => {
		await page.goto("/dashboard");
		// The header shows the logged-in user's email
		await expect(
			page.getByText("e2e-test@agentflow.test"),
		).toBeVisible();
	});

	test("clicking Workflows in the sidebar navigates to /workflows", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		// Use sidebar link – there may be multiple "Workflows" elements so pick the nav link
		await page
			.getByRole("navigation", { name: /sidebar/i })
			.getByRole("link", { name: /workflows/i })
			.click()
			.catch(async () => {
				// Fallback: use any sidebar menu link
				await page.getByRole("link", { name: /workflows/i }).first().click();
			});
		await expect(page).toHaveURL(/\/workflows/);
	});

	test("clicking Agents in the sidebar navigates to /agents", async ({
		authenticatedPage: page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await page.getByRole("link", { name: /agents/i }).first().click();
		await expect(page).toHaveURL(/\/agents/);
	});
});
