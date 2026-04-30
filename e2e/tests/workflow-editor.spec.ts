/**
 * E2E tests for the Workflow Editor:
 *  - Page loads with the canvas area
 *  - Node library sidebar is accessible
 *  - Toolbar is visible with relevant actions
 *  - Back navigation returns to the workflow list
 *  - Workflow name is displayed in the toolbar
 *  - NodeConfigModal stays hidden when no node is selected
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/auth.js";
import { WorkflowsPage } from "../pages/workflows-page.js";

async function createAndOpenEditor(
	page: import("@playwright/test").Page,
): Promise<void> {
	const workflowsPage = new WorkflowsPage(page);
	await workflowsPage.goto();
	const name = `Editor WF ${Date.now()}`;
	await workflowsPage.createWorkflow(name);
	await workflowsPage.clickWorkflowEdit(name);
	await expect(page).toHaveURL(/\/workflows\/.+\/edit/);
}

test.describe("Workflow Editor", () => {
	test("loads the editor canvas", async ({ authenticatedPage: page }) => {
		await createAndOpenEditor(page);
		// The ReactFlow canvas element should be present
		await expect(
			page.locator(".react-flow"),
		).toBeVisible({ timeout: 15_000 });
	});

	test("shows the editor toolbar with Save and Run buttons", async ({
		authenticatedPage: page,
	}) => {
		await createAndOpenEditor(page);
		await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });
		// Toolbar buttons are always present
		await expect(page.getByRole("button", { name: /save/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /^run$/i })).toBeVisible();
	});

	test("back navigation returns to the workflow list", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Back Nav WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowEdit(name);
		await expect(page).toHaveURL(/\/workflows\/.+\/edit/);

		// Navigate back using browser back
		await page.goBack();
		await expect(page).toHaveURL(/\/workflows/, { timeout: 10_000 });
	});

	test("workflow name appears on the editor page", async ({
		authenticatedPage: page,
	}) => {
		const workflowsPage = new WorkflowsPage(page);
		await workflowsPage.goto();
		const name = `Named WF ${Date.now()}`;
		await workflowsPage.createWorkflow(name);
		await workflowsPage.clickWorkflowEdit(name);
		// The workflow name should appear somewhere on the editor page
		await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
	});

	test("NodeConfigModal is not visible when no node is selected", async ({
		authenticatedPage: page,
	}) => {
		await createAndOpenEditor(page);
		await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });
		// The config dialog/modal should not be open
		const modal = page.locator("[role='dialog']");
		await expect(modal).not.toBeVisible();
	});

	test("Node Library contains node type entries", async ({
		authenticatedPage: page,
	}) => {
		await createAndOpenEditor(page);
		await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 });
		// Node library panel is always visible in the editor layout
		// It shows a search input and node items
		const searchInput = page.getByPlaceholder(/search node/i);
		const nodeItem = page.getByText(/manual trigger|http request|delay|log/i).first();

		const hasSearch = await searchInput.isVisible().catch(() => false);
		const hasNode = await nodeItem.isVisible().catch(() => false);

		expect(hasSearch || hasNode).toBe(true);
	});
});
