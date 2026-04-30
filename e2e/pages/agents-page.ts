/**
 * Page Object Model for the Agents list page (/agents).
 */
import { type Page, expect } from "@playwright/test";

export class AgentsPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto() {
		await this.page.goto("/agents");
	}

	async expectHeadingVisible() {
		await expect(
			this.page.getByRole("heading", { name: /^agents$/i }),
		).toBeVisible();
	}

	async expectEmptyState() {
		await expect(
			this.page.getByText(/no agents yet/i),
		).toBeVisible();
	}

	async openCreateDialog() {
		await this.page.getByRole("button", { name: /new agent/i }).click();
		await expect(this.page.getByRole("dialog")).toBeVisible();
	}

	async fillCreateForm(params: {
		name: string;
		type: string;
		description?: string;
	}) {
		await this.page.getByLabel(/^name/i).first().fill(params.name);
		await this.page.getByLabel(/^type/i).first().fill(params.type);
		if (params.description) {
			await this.page.getByLabel(/description/i).fill(params.description);
		}
	}

	async submitCreateForm() {
		await this.page
			.getByRole("dialog")
			.getByRole("button", { name: /create agent/i })
			.click();
	}

	async createAgent(params: {
		name: string;
		type: string;
		description?: string;
	}): Promise<string> {
		await this.openCreateDialog();
		await this.fillCreateForm(params);
		await this.submitCreateForm();
		await expect(this.page.getByRole("dialog")).not.toBeVisible({
			timeout: 10_000,
		});
		return params.name;
	}

	async expectAgentCardVisible(name: string) {
		await expect(
			this.page.getByRole("link", { name, exact: true }),
		).toBeVisible();
	}

	async expectAgentCardNotVisible(name: string) {
		await expect(
			this.page.getByText(name).first(),
		).not.toBeVisible();
	}

	async deleteAgent(name: string) {
		const card = this.page.locator(".group").filter({ hasText: name }).first();
		await card.hover();
		await card.getByRole("button", { name: /delete/i }).click();
	}

	async clickAgentDetail(name: string) {
		await this.page.getByRole("link", { name, exact: true }).click();
	}

	async waitForLoad() {
		await this.page.waitForLoadState("networkidle");
	}
}
