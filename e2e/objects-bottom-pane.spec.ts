import { expect, test, type Page } from '@playwright/test';
import { openObjectTypeBehaviorPane, primeCollabStorage, waitForWorldReady } from './helpers';

async function openObjectsRoute(page: Page) {
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
}

test.describe('objects inspector tabs', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('right inspector — Properties, Events, Schedule, Clip on Character', async ({ page }) => {
		test.setTimeout(90_000);

		await page.goto('/');
		await waitForWorldReady(page);
		await openObjectsRoute(page);

		await page.getByRole('option', { name: /^Character\b/ }).click();

		const inspector = page.getByRole('complementary', { name: 'Object type inspector' });
		await expect(inspector.getByRole('tab', { name: 'Properties' })).toBeVisible();
		await expect(inspector.getByRole('tab', { name: 'Events' })).toBeVisible();
		await expect(inspector.getByRole('tab', { name: 'Schedule' })).toBeVisible();
		await expect(inspector.getByRole('tab', { name: 'Clip' })).toBeVisible();

		await expect(page.getByRole('region', { name: 'Object type drawer' })).toHaveCount(0);

		await inspector.getByRole('tab', { name: 'Schedule' }).click();
		await expect(inspector.getByRole('tab', { name: 'Schedule' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(inspector.getByLabel('Clip schedule')).toBeVisible({ timeout: 10_000 });

		await inspector.getByRole('tab', { name: 'Clip' }).click();
		await expect(inspector.getByRole('tab', { name: 'Clip' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(inspector.getByLabel('Type clip authoring')).toBeVisible({ timeout: 10_000 });

		await openObjectTypeBehaviorPane(page);
		await expect(inspector.getByLabel('Type events')).toBeVisible({ timeout: 10_000 });
		await expect(inspector.getByLabel('Locomotion clips')).toBeVisible({ timeout: 10_000 });

		await inspector.getByRole('tab', { name: 'Properties' }).click();
		await expect(page.getByRole('complementary', { name: 'Object type editor' })).toBeVisible();
	});
});
