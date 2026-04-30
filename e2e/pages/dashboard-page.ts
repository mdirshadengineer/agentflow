/**
 * Page Object Model for the Dashboard page (/dashboard).
 */
import { type Page, expect } from "@playwright/test";

export class DashboardPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto() {
		await this.page.goto("/dashboard");
	}

	async expectHeadingVisible() {
		await expect(
			this.page.getByRole("heading", { name: /dashboard/i }),
		).toBeVisible();
	}

	async expectStatCardsVisible() {
		// The dashboard shows 4 stat cards: Agents, Workflows, Running Now, Total Runs
		await expect(this.page.getByText("Agents")).toBeVisible();
		await expect(this.page.getByText("Workflows")).toBeVisible();
		await expect(this.page.getByText("Running Now")).toBeVisible();
		await expect(this.page.getByText("Total Runs")).toBeVisible();
	}

	async expectRecentRunsSectionVisible() {
		await expect(this.page.getByText("Recent Runs")).toBeVisible();
	}

	/** Returns the text content of the agents stat card value. */
	async getAgentCount(): Promise<string> {
		const cards = this.page.getByText("Agents");
		// Find the card, then get sibling with the number
		return (await cards.first().textContent()) ?? "";
	}

	async expectSidebarNavigation() {
		await expect(
			this.page.getByRole("link", { name: /dashboard/i }),
		).toBeVisible();
		await expect(
			this.page.getByRole("link", { name: /agents/i }),
		).toBeVisible();
		await expect(
			this.page.getByRole("link", { name: /workflows/i }),
		).toBeVisible();
	}

	async navigateToWorkflows() {
		await this.page.getByRole("link", { name: /^workflows$/i }).click();
		await expect(this.page).toHaveURL(/\/workflows/);
	}

	async navigateToAgents() {
		await this.page.getByRole("link", { name: /^agents$/i }).click();
		await expect(this.page).toHaveURL(/\/agents/);
	}

	async logout() {
		// The logout button is a ghost icon-button with "Log out" sr-only text
		await this.page.getByRole("button", { name: /log out/i }).click();
		await expect(this.page).toHaveURL(/\/login/);
	}
}
