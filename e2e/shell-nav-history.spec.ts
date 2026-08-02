import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, selectEntity, waitForWorldReady } from './helpers';

test.describe('doc-bar history + open type in Objects', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('rooms selection opens type in Objects; back returns to Rooms', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		const back = page.getByRole('button', { name: 'Go back' });
		const forward = page.getByRole('button', { name: 'Go forward' });
		await expect(back).toBeVisible();
		await expect(back).toBeDisabled();
		await expect(forward).toBeDisabled();

		await selectEntity(page, 'Prop crate-b', 'crate-b');

		const openType = page.getByRole('button', { name: 'Open Prop in Objects' });
		await expect(openType).toBeVisible({ timeout: 15_000 });
		await openType.click();

		await expect(page.getByRole('complementary', { name: 'Object type inspector' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.locator('.object-inspector-panel .header-title')).toHaveText('Prop');

		await expect(back).toBeEnabled();
		await back.click();

		await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('tree', { name: 'World entities' })).toBeVisible();
		await expect(forward).toBeEnabled({ timeout: 5_000 });
		await forward.click();

		await expect(page.getByRole('complementary', { name: 'Object type inspector' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.locator('.object-inspector-panel .header-title')).toHaveText('Prop');
	});

	test('history arrows track rail route changes', async ({ page }) => {
		test.setTimeout(90_000);

		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		const back = page.getByRole('button', { name: 'Go back' });
		await expect(back).toBeDisabled();

		await page.getByRole('button', { name: 'Objects', exact: true }).click();
		await expect(page.getByRole('complementary', { name: 'Object type inspector' })).toBeVisible({
			timeout: 15_000
		});
		await expect(back).toBeEnabled();

		await back.click();
		await expect(page.getByRole('tree', { name: 'World entities' })).toBeVisible({
			timeout: 15_000
		});
	});
});
