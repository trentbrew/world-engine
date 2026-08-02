import { expect, test, type Page } from '@playwright/test';
import { e2eWorldUrl, enterPlayMode, primeCollabStorage, selectEntity, waitForWorldReady } from './helpers';

const isMac = process.platform === 'darwin';

async function undo(page: Page) {
	await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
}

async function redo(page: Page) {
	await page.keyboard.press(isMac ? 'Meta+Shift+z' : 'Control+Shift+z');
}

test.describe('editor undo/redo', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('undo and redo inspector field edit', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await selectEntity(page, 'Prop crate-b', 'crate-b');
		await page.getByRole('tab', { name: 'Props' }).click();

		const colorInput = page.locator('input[type="color"]').first();
		await expect(colorInput).toBeVisible({ timeout: 15_000 });
		const before = await colorInput.inputValue();

		await colorInput.fill('#00ff00');
		await expect(colorInput).toHaveValue('#00ff00');

		await undo(page);
		await expect(colorInput).toHaveValue(before, { timeout: 10_000 });

		await redo(page);
		await expect(colorInput).toHaveValue('#00ff00', { timeout: 10_000 });
	});

	test('undo delete restores entity in tree', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto('/');
		await waitForWorldReady(page);

		const treeItem = page.getByRole('treeitem', { name: 'Prop crate-b', exact: true });
		await expect(treeItem).toBeVisible();
		await selectEntity(page, 'Prop crate-b', 'crate-b');

		await page.keyboard.press('Delete');
		await expect(treeItem).toHaveCount(0, { timeout: 15_000 });

		await undo(page);
		await expect(treeItem).toBeVisible({ timeout: 15_000 });
	});

	test('undo does nothing in play mode', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto('/?game=orbit');
		await waitForWorldReady(page);
		await enterPlayMode(page);

		await undo(page);
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
	});
});
