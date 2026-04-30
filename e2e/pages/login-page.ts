/**
 * Page Object Model for the Login page (/login).
 */
import { type Page, expect } from "@playwright/test";

export class LoginPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto() {
		await this.page.goto("/login");
	}

	async fillEmail(email: string) {
		await this.page.getByLabel("Email").fill(email);
	}

	async fillPassword(password: string) {
		await this.page.getByLabel("Password").fill(password);
	}

	async submit() {
		await this.page.getByRole("button", { name: /login/i }).click();
	}

	async login(email: string, password: string) {
		await this.fillEmail(email);
		await this.fillPassword(password);
		await this.submit();
	}

	async expectErrorVisible(text?: string | RegExp) {
		const error = this.page.locator(
			".text-destructive, [class*='destructive']",
		);
		await expect(error.first()).toBeVisible();
		if (text) {
			await expect(error.first()).toContainText(text);
		}
	}

	async expectSignupLinkVisible() {
		await expect(
			this.page.getByRole("link", { name: /sign up/i }),
		).toBeVisible();
	}

	async clickSignupLink() {
		await this.page.getByRole("link", { name: /sign up/i }).click();
	}
}
