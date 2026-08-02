import { expect, test, type Page } from '@playwright/test';
import {
	primeCollabStorage,
	dismissAllToasts,
	waitForToastsToClear,
	waitForWorldReady,
	openObjectTypeBehaviorPane,
	submitTypeBehaviorForm
} from './helpers';

async function openObjectsRoute(page: Page) {
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
}

async function createCustomType(page: Page, name: string) {
	const panel = page.locator('.objects-resource-panel');
	await panel.getByRole('listbox', { name: 'Object types' }).getByLabel('New object type').click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toBeVisible();
	await page.getByLabel('Type name').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toHaveCount(0);
	await expect(page.getByRole('option', { name: new RegExp(`^${name}\\b`) })).toBeVisible({
		timeout: 15_000
	});
	await waitForToastsToClear(page);
}

test.describe('object type events (inspector Events tab)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('author a create-event on a type via the Events inspector tab', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Sentry');
		await dismissAllToasts(page);

		const behavior = await openObjectTypeBehaviorPane(page);
		const addForm = behavior.locator('form[aria-label="Add type event action"]');

		await addForm.getByLabel('Event trigger', { exact: true }).selectOption('create');
		await addForm.getByLabel('Event action', { exact: true }).selectOption('score');
		await addForm.getByLabel('Score points', { exact: true }).fill('25');
		await submitTypeBehaviorForm(page, behavior);

		await expect(behavior.getByRole('button', { name: 'Remove Create action 1' })).toBeVisible({
			timeout: 10_000
		});
	});
});
