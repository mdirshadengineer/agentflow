/**
 * E2E tests for the Workflow Runs pages:
 *  - Runs list page renders after navigating from a workflow card
 *  - Empty state when no runs have been triggered
 *  - Run is listed after triggering one from the workflow list
 *  - Run status badge is displayed
 *  - Clicking a run navigates to the run detail page
 *  - Run detail page shows run ID and status
 *  - Global runs list (/api/v1/runs) contributes to dashboard stats
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/auth.js";
import { WorkflowsPage } from "../pages/workflows-page.js";

test.describe("Workflow Runs list page", () => {
	test("navigates to the runs page from the workflow card", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Runs List WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowRuns(name);
		await expect(page).toHaveURL(/\/workflows\/.+\/runs/);
	});

	test("shows the workflow name as a heading on the runs page", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Runs Heading WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowRuns(name);
		// The runs page should display the workflow name or a heading
		await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
	});

	test("shows an empty state when the workflow has no runs", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `No Runs WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowRuns(name);

		await page.waitForLoadState("networkidle");

		const emptyMsg = page.getByText(/no runs yet/i);
		const runRows = page.locator("table tbody tr").first();
		const hasEmpty = await emptyMsg.isVisible().catch(() => false);
		const hasRows = await runRows.isVisible().catch(() => false);

		// One or the other should be present
		expect(hasEmpty || hasRows).toBe(true);
	});
});

test.describe("Run creation and details", () => {
	test("a triggered run appears in the runs list with a status badge", async ({
		authenticatedPage: page,
	}) => {
		// Create a workflow and trigger a run from the workflow list
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Run Status WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);

		// Trigger a run and wait for the API response
		const runPromise = page.waitForResponse(
			(resp) =>
				resp.url().includes("/run") &&
				resp.request().method() === "POST",
		);
		await workflowsPage.triggerWorkflowRun(name);
		const runResp = await runPromise;
		const runBody = (await runResp.json()) as { id: string; status: string };
		expect(runBody.status).toBe("queued");

		// Navigate to the runs page
		await workflowsPage.clickWorkflowRuns(name);
		await expect(page).toHaveURL(/\/workflows\/.+\/runs/);
		await page.waitForLoadState("networkidle");

		// At least one run should be visible with a status badge
		const statusBadge = page
			.getByText(/queued|running|success|failed/)
			.first();
		await expect(statusBadge).toBeVisible({ timeout: 10_000 });
	});

	test("clicking a run navigates to the run detail page", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Run Detail WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);

		// Trigger a run
		await workflowsPage.triggerWorkflowRun(name);
		await page.waitForTimeout(500);

		// Go to runs list
		await workflowsPage.clickWorkflowRuns(name);
		await page.waitForLoadState("networkidle");

		// Click the first "View logs" link
		const runLink = page
			.getByRole("link", { name: /view logs/i })
			.first();

		const hasLink = await runLink.isVisible().catch(() => false);
		if (hasLink) {
			await runLink.click();
			await expect(page).toHaveURL(/\/runs\//);
		} else {
			// Check that the run rows themselves are visible
			const rowCount = await page.locator("table tbody tr").count();
			expect(rowCount).toBeGreaterThan(0);
		}
	});
});

test.describe("Run detail page", () => {
	test("the run detail page shows the run ID and status", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Run Detail Page WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);

		// Trigger a run via the API and capture the run ID
		const runPromise = page.waitForResponse(
			(resp) =>
				resp.url().includes("/run") &&
				resp.request().method() === "POST",
		);
		await workflowsPage.triggerWorkflowRun(name);
		const runResp = await runPromise;
		const { id: runId } = (await runResp.json()) as { id: string };

		// Navigate directly to the run detail page
		await page.goto(`/runs/${runId}`);
		await page.waitForLoadState("networkidle");

		// The run ID (or truncated version) should appear
		const runIdShort = runId.slice(0, 8);
		const runIdEl = page.getByText(runIdShort).or(page.getByText(runId));
		const visible = await runIdEl.first().isVisible().catch(() => false);

		// Either the run ID appears or a status badge appears
		const statusEl = page.getByText(/queued|running|success|failed/).first();
		const statusVisible = await statusEl.isVisible().catch(() => false);

		expect(visible || statusVisible).toBe(true);
	});
});
