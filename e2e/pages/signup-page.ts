/**
 * Page Object Model for the Sign Up page (/signup).
 */
import { type Page, expect } from "@playwright/test";

export class SignupPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto() {
		await this.page.goto("/signup");
	}

	async fillEmail(email: string) {
		await this.page.getByLabel("Email").fill(email);
	}

	async fillPassword(password: string) {
		await this.page.getByLabel("Password").fill(password);
	}

	async submit() {
		await this.page.getByRole("button", { name: /create account|sign up|register/i }).click();
	}

	async signUp(email: string, password: string) {
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

	async expectLoginLinkVisible() {
		await expect(
			this.page.getByRole("link", { name: /log in|login/i }),
		).toBeVisible();
	}
}
