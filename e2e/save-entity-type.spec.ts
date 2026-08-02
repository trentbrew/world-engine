import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, selectEntity, dismissAllToasts, waitForToastsToClear, waitForWorldReady } from './helpers';

async function openObjectsRoute(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
}

async function createCustomType(page: import('@playwright/test').Page, name: string) {
	const panel = page.locator('.objects-resource-panel');
	await panel.getByRole('button', { name: 'New object type' }).click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toBeVisible();
	await page.getByLabel('Type name').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toHaveCount(0);
	await expect(page.locator('.type-row.active .type-name')).toHaveText(name);
	await waitForToastsToClear(page);
}

test.describe('save entity type', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('defines object type in Objects route and spawns into Rooms', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'FallingCrate');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await dismissAllToasts(page);
		const addBtn = typeEditor.getByRole('button', { name: 'Add capability' });
		await addBtn.focus();
		await page.keyboard.press('Enter');
		await page.getByRole('menuitem', { name: 'Gravity' }).click({ force: true });
		await expect(typeEditor.getByRole('button', { name: 'Gravity', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Rooms', exact: true }).click();
		const roomViews = page.getByRole('tablist', { name: 'Room views' });
		await expect(roomViews.getByRole('tab', { name: 'Objects', exact: true })).toBeVisible();
		await expect(roomViews.getByRole('tab', { name: 'Assets' })).toHaveCount(0);
		await expect(roomViews.getByRole('tab', { name: 'Settings' })).toHaveCount(0);

		const ok = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { world } = await import(
				/* @vite-ignore */ moduleUrl(
					'/runtime/world.svelte.ts',
					'/src/lib/engine/runtime/world.svelte.ts'
				)
			);
			return !!world.spawnFromType('FallingCrate', 'falling-a');
		});
		expect(ok).toBe(true);

		await page.getByRole('tab', { name: 'Instances' }).click();

		await expect(
			page.getByRole('treeitem', { name: 'FallingCrate falling-a', exact: true })
		).toBeVisible({ timeout: 15_000 });

		await selectEntity(page, 'FallingCrate falling-a', 'falling-a');
		await page.getByRole('tab', { name: 'Props' }).click();
		await expect(
			page.getByRole('tabpanel', { name: 'Props' }).getByRole('button', { name: 'Gravity', exact: true })
		).toBeVisible();
	});
});
