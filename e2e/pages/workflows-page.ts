/**
 * Page Object Model for the Workflows list page (/workflows).
 */
import { type Page, expect } from "@playwright/test";

export class WorkflowsPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto() {
		await this.page.goto("/workflows");
	}

	async expectHeadingVisible() {
		await expect(
			this.page.getByRole("heading", { name: /^workflows$/i }),
		).toBeVisible();
	}

	async expectEmptyState() {
		await expect(
			this.page.getByText(/no workflows yet/i),
		).toBeVisible();
	}

	async openCreateDialog() {
		await this.page.getByRole("button", { name: /new workflow/i }).click();
		// Wait for dialog to open
		await expect(
			this.page.getByRole("dialog"),
		).toBeVisible();
	}

	async fillCreateForm(name: string, description?: string) {
		await this.page.getByLabel(/name/i).first().fill(name);
		if (description) {
			await this.page.getByLabel(/description/i).fill(description);
		}
	}

	async submitCreateForm() {
		await this.page
			.getByRole("dialog")
			.getByRole("button", { name: /create workflow/i })
			.click();
	}

	/**
	 * Creates a workflow and waits for the dialog to close.
	 * Returns the workflow name.
	 */
	async createWorkflow(name: string, description?: string): Promise<string> {
		await this.openCreateDialog();
		await this.fillCreateForm(name, description);
		await this.submitCreateForm();
		// Dialog should close after successful creation
		await expect(this.page.getByRole("dialog")).not.toBeVisible({
			timeout: 10_000,
		});
		return name;
	}

	async expectWorkflowCardVisible(name: string) {
		await expect(
			this.page.getByRole("link", { name, exact: true }),
		).toBeVisible();
	}

	async expectWorkflowCardNotVisible(name: string) {
		await expect(
			this.page.getByText(name).first(),
		).not.toBeVisible();
	}

	/**
	 * Hover over a workflow card to reveal the delete button, then click it.
	 * Handles the browser confirm dialog.
	 */
	async deleteWorkflow(name: string) {
		const card = this.page.locator(".group").filter({ hasText: name }).first();
		await card.hover();
		await card.getByRole("button", { name: /delete/i }).click();
	}

	async clickWorkflowRuns(name: string) {
		const card = this.page.locator(".group").filter({ hasText: name }).first();
		await card.getByRole("link", { name: /runs/i }).click();
	}

	async clickWorkflowEdit(name: string) {
		const card = this.page.locator(".group").filter({ hasText: name }).first();
		await card.getByRole("link", { name: /edit/i }).click();
	}

	async triggerWorkflowRun(name: string) {
		const card = this.page.locator(".group").filter({ hasText: name }).first();
		await card.getByRole("button", { name: /run/i }).click();
	}

	/** Wait for workflows to finish loading (skeleton gone or content present). */
	async waitForLoad() {
		await this.page.waitForLoadState("networkidle");
	}
}
