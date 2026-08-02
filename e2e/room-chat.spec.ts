import { expect, test } from '@playwright/test';

const CHAT_URL = '/?game=orbit&net=local';

async function primeCollabStorage(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(page: import('@playwright/test').Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
}

async function openChat(page: import('@playwright/test').Page) {
	const fab = page.getByRole('button', { name: 'Open room chat' });
	await expect(fab).toBeVisible({ timeout: 10_000 });
	await fab.click();
	await expect(page.getByRole('dialog', { name: 'Room chat' })).toBeVisible();
	await expect(page.getByLabel('Chat message')).toBeEnabled({ timeout: 10_000 });
}

test.describe('room chat', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('opens chat panel from FAB', async ({ page }) => {
		await page.goto(CHAT_URL);
		await waitForWorldReady(page);
		await openChat(page);
		await expect(page.getByPlaceholder('Message the room…')).toBeVisible();
	});

	test('syncs messages across tabs', async ({ context }) => {
		// BroadcastChannel is per browser profile — two pages in one context, not two contexts.
		const pageA = await context.newPage();
		const pageB = await context.newPage();

		await primeCollabStorage(pageA);
		await primeCollabStorage(pageB);

		await pageA.goto(CHAT_URL);
		await pageB.goto(CHAT_URL);
		await waitForWorldReady(pageA);
		await waitForWorldReady(pageB);

		await openChat(pageA);
		await openChat(pageB);

		await pageA.getByLabel('Chat message').fill('hello from tab A');
		await pageA.getByRole('button', { name: 'Send message' }).click();

		await expect(pageB.getByText('hello from tab A')).toBeVisible({ timeout: 10_000 });
		await expect(pageB.getByText('You', { exact: true })).toHaveCount(0);

		await pageA.close();
		await pageB.close();
	});
});
