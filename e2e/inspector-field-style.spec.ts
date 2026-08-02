import { expect, test } from '@playwright/test';
import { e2eWorldUrl, enterEditMode, primeCollabStorage, selectEntity, waitForWorldReady } from './helpers';

test.describe('inspector field language', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('anime.js wells, slider tick, dirty state, nudge, and scene tab parity', async ({ page }) => {
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);
		await enterEditMode(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'GroundPlane main', 'main');

		await page.getByRole('tab', { name: 'Props' }).click();
		const propsPanel = page.getByRole('tabpanel', { name: 'Props' });
		await expect(propsPanel.locator('.field-well').first()).toBeVisible({ timeout: 15_000 });
		expect(await propsPanel.locator('.field-well').count()).toBeGreaterThanOrEqual(1);

		const sizeRow = propsPanel.locator('.field-row', { has: page.getByLabel('size', { exact: true }) });
		await expect(sizeRow.locator('.field-split .field-well--slider .slider-tick')).toBeVisible();
		await expect(sizeRow.locator('.field-split .field-well--num input')).toBeVisible();

		const sizeInput = propsPanel.getByLabel('size value');
		await expect(sizeInput).toHaveValue('20');
		await sizeInput.fill('25');
		await sizeInput.press('Enter');
		await expect(sizeRow).toHaveClass(/field-row--dirty/);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'Prop crate-b', 'crate-b');
		await page.getByRole('tab', { name: 'Props' }).click();

		const positionX = propsPanel.getByLabel('position x');
		await positionX.click();
		const before = Number(await positionX.inputValue());
		await positionX.press('ArrowUp');
		const after = Number(await positionX.inputValue());
		expect(after).toBeGreaterThan(before);

		await page.getByRole('tab', { name: 'Room' }).click();
		const scenePanel = page.locator('#left-panel-room');
		await expect(scenePanel.locator('.field-row').first()).toBeVisible({ timeout: 15_000 });
		await expect(scenePanel.locator('[data-slot="button-group"]')).toHaveCount(0);
	});
});
