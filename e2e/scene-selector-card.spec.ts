import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, waitForWorldReady } from './helpers';

/** Scene selector card (TRL-241) — the scene is a full-width card above the left pane;
 *  the doc-bar pill is deduped while the card is up, and returns when the panel collapses. */

test.describe('scene selector card', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('card is visible above the left panel and the doc-bar pill is deduped', async ({ page }) => {
		await page.goto(e2eWorldUrl('/?game=meadow'));
		await waitForWorldReady(page);
		await expect(page.locator('.scene-card')).toBeVisible();
		await expect(page.locator('.scene-card .scene-trigger-title')).toContainText('Meadow');
		// No compact scene pill in the doc bar while the card is up (rooms + bars visible).
		await expect(page.locator('.doc-bar .scene-selector--compact')).toHaveCount(0);
	});

	test('clicking the card opens the scene selector popover', async ({ page }) => {
		await page.goto(e2eWorldUrl('/?game=meadow'));
		await waitForWorldReady(page);
		await page.locator('.scene-card').click();
		await expect(page.locator('.scene-popover')).toBeVisible();
	});

	test('trailing + opens the New blank scene dialog', async ({ page }) => {
		await page.goto(e2eWorldUrl('/?game=meadow'));
		await waitForWorldReady(page);
		await expect(page.locator('.scene-card-new')).toBeVisible();
		await page.locator('.scene-card-new').click();
		await expect(page.locator('.blank-scene-options')).toBeVisible();
	});

	test('collapsing sidebars hides the card and restores the doc-bar crumb', async ({ page }) => {
		await page.goto(e2eWorldUrl('/?game=meadow'));
		await waitForWorldReady(page);
		await expect(page.locator('.scene-card')).toBeVisible();
		await page.keyboard.press('Meta+\\');
		await expect(page.locator('.scene-card')).toHaveCount(0, { timeout: 5000 });
		await expect(page.locator('.doc-bar .scene-selector--compact')).toHaveCount(1);
	});
});
