/**
 * E2E tests for the Workflows CRUD flows:
 *  - Page heading is visible
 *  - Empty state when no workflows exist
 *  - Create a new workflow via dialog
 *  - Create a workflow with a description
 *  - Workflow card is visible after creation
 *  - Delete a workflow from the card
 *  - Navigate to workflow runs from the card
 *  - Navigate to the workflow editor from the card
 *  - Trigger a workflow run from the card
 *  - Validation: create dialog requires a name
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/auth.js";
import { WorkflowsPage } from "../pages/workflows-page.js";

test.describe("Workflows list page", () => {
	test("shows the page heading", async ({ authenticatedPage: page }) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		await workflowsPage.expectHeadingVisible();
	});

	test("shows the New Workflow button", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		await expect(
			page.getByRole("button", { name: /new workflow/i }),
		).toBeVisible();
	});
});

test.describe("Workflow creation", () => {
	test("opens the create dialog when clicking New Workflow", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		await workflowsPage.openCreateDialog();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(
			page.getByRole("dialog").getByText(/create workflow/i),
		).toBeVisible();
	});

	test("creates a workflow and shows its card", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `E2E Workflow ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.expectWorkflowCardVisible(name);
	});

	test("creates a workflow with a description", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Described Workflow ${Date.now()}`;
		await workflowsPage.createWorkflow(name, "A workflow with a description");
		await workflowsPage.expectWorkflowCardVisible(name);
		await expect(
			page.getByText("A workflow with a description"),
		).toBeVisible();
	});

	test("dialog requires a name before submission", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		await workflowsPage.openCreateDialog();
		// Submit without filling in the name
		await workflowsPage.submitCreateForm();
		// Dialog should still be open (HTML5 validation blocks submission)
		await expect(page.getByRole("dialog")).toBeVisible();
	});
});

test.describe("Workflow deletion", () => {
	test("deletes a workflow and removes its card", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Delete Me ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.expectWorkflowCardVisible(name);

		// Accept the confirm dialog that appears
		page.on("dialog", (dialog) => dialog.accept());
		await workflowsPage.deleteWorkflow(name);

		// Wait for the card to disappear
		await expect(
			page.getByRole("link", { name, exact: true }),
		).not.toBeVisible({ timeout: 10_000 });
	});
});

test.describe("Workflow navigation", () => {
	test("Runs link navigates to the workflow runs page", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Nav Runs ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowRuns(name);
		await expect(page).toHaveURL(/\/workflows\/.+\/runs/);
	});

	test("Edit link navigates to the workflow editor", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Nav Edit ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowEdit(name);
		await expect(page).toHaveURL(/\/workflows\/.+\/edit/);
	});
});

test.describe("Workflow run trigger", () => {
	test("run button is visible on a workflow card", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Runnable ${Date.now()}`;
		await workflowsPage.createWorkflow(name);

		const card = page.locator(".group").filter({ hasText: name }).first();
		await card.hover();
		await expect(
			card.getByRole("button", { name: /run/i }),
		).toBeVisible();
	});

	test("clicking the run button enqueues a run", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Trigger Run ${Date.now()}`;
		await workflowsPage.createWorkflow(name);

		// Listen for the /run API call
		const runPromise = page.waitForResponse(
			(resp) =>
				resp.url().includes("/run") &&
				resp.request().method() === "POST",
		);
		await workflowsPage.triggerWorkflowRun(name);
		const runResponse = await runPromise;
		expect(runResponse.status()).toBe(201);
	});
});
