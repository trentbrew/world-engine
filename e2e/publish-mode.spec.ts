import { expect, test } from '@playwright/test';

async function waitForWorldReady(page: import('@playwright/test').Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
}

test.describe('publish mode', () => {
	test('opens from doc-bar button right of presence and returns to edit', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('collab:username-prompted', '1');
		});
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		const end = page.locator('.doc-bar-end');
		const publishBtn = end.getByRole('button', { name: 'Publish' });
		const modeTabs = end.getByRole('tablist', { name: 'Editor mode' });
		await expect(publishBtn).toBeVisible();
		await expect(modeTabs).toBeVisible();

		// Right cluster order: … avatars → chat → Publish → Edit/Play
		const orderOk = await end.evaluate((el) => {
			const publish = el.querySelector('.publish-btn');
			const tabs = el.querySelector('[aria-label="Editor mode"]');
			const presence = el.querySelector('[aria-label="Room presence"]');
			const chat = el.querySelector('#doc-bar-chat-anchor');
			if (!publish || !tabs) return false;
			const tabsAfterPublish =
				(publish.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			if (!presence) return tabsAfterPublish;
			const chatAfterPresence =
				!!chat &&
				(presence.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			const publishAfterChat =
				!!chat &&
				(chat.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			return chatAfterPresence && publishAfterChat && tabsAfterPublish;
		});
		expect(orderOk).toBe(true);

		await publishBtn.click();

		await expect(page.getByRole('button', { name: 'Exit publish' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('complementary', { name: 'Publish' })).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'World navigation' })).toHaveCount(0);
		await expect(modeTabs.getByRole('tab')).toHaveCount(2);

		await page.getByRole('button', { name: 'Back to edit' }).click();
		await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('navigation', { name: 'World navigation' })).toBeVisible();
	});
});
