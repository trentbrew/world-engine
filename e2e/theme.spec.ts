import { expect, test } from '@playwright/test';

async function primeCollabStorage(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

test.describe('theme infrastructure', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('switches theme preset from Config → Shell', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
		await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });

		await page.getByRole('button', { name: 'Config', exact: true }).click();
		await page.getByRole('tab', { name: 'Shell' }).click();
		await page.getByRole('button', { name: 'Violet Bloom theme' }).click();

		await expect
			.poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
			.toBe('violet-bloom');
	});
});
