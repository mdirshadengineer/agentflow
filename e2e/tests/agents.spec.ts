/**
 * E2E tests for the Agents CRUD flows:
 *  - Page heading is visible
 *  - Empty state when no agents exist
 *  - Create an agent via dialog
 *  - Agent card is visible after creation
 *  - Agent type badge is displayed
 *  - Delete an agent from the list
 *  - Navigate to the agent detail page
 *  - Agent detail page shows tabs (Config, Chat)
 *  - Edit an agent name on the detail page
 *  - Invalid JSON in config shows an error
 *  - Chat tab is accessible
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/auth.js";
import { AgentsPage } from "../pages/agents-page.js";

test.describe("Agents list page", () => {
	test("shows the page heading and New Agent button", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		await agentsPage.expectHeadingVisible();
		await expect(
			page.getByRole("button", { name: /new agent/i }),
		).toBeVisible();
	});
});

test.describe("Agent creation", () => {
	test("opens the create dialog when clicking New Agent", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		await agentsPage.openCreateDialog();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(
			page.getByRole("dialog").getByText(/create agent/i),
		).toBeVisible();
	});

	test("creates an agent and shows its card", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `E2E Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "llm" });
		await agentsPage.expectAgentCardVisible(name);
	});

	test("shows the agent type badge on the card", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Badge Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "tool" });

		const card = page.locator(".group").filter({ hasText: name }).first();
		// The badge shows the agent type
		await expect(card.getByText("tool")).toBeVisible();
	});

	test("creates an agent with a description", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Described Agent ${Date.now()}`;
		await agentsPage.createAgent({
			name,
			type: "llm",
			description: "An agent for E2E testing",
		});
		await agentsPage.expectAgentCardVisible(name);
		const card = page.locator(".group").filter({ hasText: name }).first();
		await expect(card.getByText("An agent for E2E testing")).toBeVisible();
	});

	test("dialog requires Name and Type before submission", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		await agentsPage.openCreateDialog();
		// Submit without filling fields
		await agentsPage.submitCreateForm();
		// Dialog must still be visible (HTML5 validation)
		await expect(page.getByRole("dialog")).toBeVisible();
	});
});

test.describe("Agent deletion", () => {
	test("deletes an agent and removes its card", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Delete Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "rpa" });
		await agentsPage.expectAgentCardVisible(name);

		page.on("dialog", (dialog) => dialog.accept());
		await agentsPage.deleteAgent(name);

		await expect(
			page.getByRole("link", { name, exact: true }),
		).not.toBeVisible({ timeout: 10_000 });
	});
});

test.describe("Agent detail page", () => {
	test("navigates to the agent detail page and shows the Config tab", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Detail Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "llm" });
		await agentsPage.clickAgentDetail(name);
		await expect(page).toHaveURL(/\/agents\/.+/);
		// Config tab should be the default
		await expect(
			page.getByRole("tab", { name: /config/i }),
		).toBeVisible();
		await expect(
			page.getByRole("tab", { name: /chat/i }),
		).toBeVisible();
	});

	test("can update the agent name on the detail page", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const originalName = `Rename Agent ${Date.now()}`;
		await agentsPage.createAgent({ name: originalName, type: "llm" });
		await agentsPage.clickAgentDetail(originalName);

		// Edit the name field
		const newName = `Renamed Agent ${Date.now()}`;
		await page.getByLabel(/^name/i).fill(newName);
		await page.getByRole("button", { name: /save changes/i }).click();

		// Success toast or updated state
		await expect(
			page.getByText("Agent saved"),
		).toBeVisible({ timeout: 10_000 });
	});

	test("shows an error if Config JSON is invalid", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Config Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "llm" });
		await agentsPage.clickAgentDetail(name);

		// Overwrite the config textarea with invalid JSON
		const configTextarea = page.getByLabel(/config \(json\)/i);
		await configTextarea.clear();
		await configTextarea.fill("{ invalid json }");

		await page.getByRole("button", { name: /save changes/i }).click();

		// An inline error about invalid JSON should appear
		await expect(
			page.getByText(/config must be valid json/i),
		).toBeVisible();
	});

	test("Chat tab is accessible and shows the message input", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Chat Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "llm" });
		await agentsPage.clickAgentDetail(name);

		await page.getByRole("tab", { name: /chat/i }).click();
		// The chat tab should have a textarea for input
		await expect(
			page.getByPlaceholder(/type a message/i),
		).toBeVisible();
		// And a send button
		await expect(
			page.getByRole("button", { name: /send/i }),
		).toBeVisible();
	});

	test("back link from detail page returns to /agents", async ({
		authenticatedPage: page,
	}) => {
		const agentsPage = new AgentsPage(page);
		await agentsPage.goto();
		const name = `Back Agent ${Date.now()}`;
		await agentsPage.createAgent({ name, type: "llm" });
		await agentsPage.clickAgentDetail(name);

		await page.getByRole("link", { name: /back/i }).click();
		await expect(page).toHaveURL(/\/agents$/);
	});
});
