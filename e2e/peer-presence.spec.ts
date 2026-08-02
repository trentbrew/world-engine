import { expect, test } from '@playwright/test';

async function primeCollabStorage(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(page: import('@playwright/test').Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
}

test.describe('peer presence', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('shows room presence bar in edit mode', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		await expect(page.getByRole('button', { name: 'Share room' })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('region', { name: 'Room presence' })).toBeVisible();
	});

	test('hides presence bar in play mode', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Play' }).click();
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('region', { name: 'Room presence' })).toHaveCount(0);
	});
});
