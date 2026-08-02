import { expect, test } from '@playwright/test';
import { primeCollabStorage, waitForWorldReady } from './helpers';

test.describe('objects type preview', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('shows a 3D preview canvas for the selected object type', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Objects', exact: true }).click();
		await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();

		// Auto-selects Character by default.
		await expect(page.locator('.type-row.active .type-name')).toHaveText('Character');

		const preview = page.getByRole('region', { name: 'Object type preview' });
		await expect(preview).toBeVisible();
		await expect(preview.locator('canvas')).toBeVisible({ timeout: 15_000 });
		await expect(preview.locator('.preview-type')).toHaveText('Character');
	});
});
