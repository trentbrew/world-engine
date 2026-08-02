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

test.describe('entity inspector components', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('rooms inspector has no structural authoring controls', async ({ page }) => {
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'Prop crate-b', 'crate-b');

		await expect(page.getByRole('tab', { name: 'Props' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add component' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Save as type…' })).toHaveCount(0);
	});

	test('add Gravity capability to a custom object type in Objects route', async ({ page }) => {
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'TestCrate');

		const editor = page.getByRole('complementary', { name: 'Object type editor' });
		await expect(editor.getByRole('button', { name: 'Gravity', exact: true })).toHaveCount(0);
		await dismissAllToasts(page);
		const addBtn = editor.getByRole('button', { name: 'Add capability' });
		await addBtn.focus();
		await page.keyboard.press('Enter');
		await page.getByRole('menuitem', { name: 'Gravity' }).click({ force: true });
		await expect(editor.getByRole('button', { name: 'Gravity', exact: true })).toBeVisible();
	});

	test('JSON tab shows entity fragment and applies edits', async ({ page }) => {
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'Prop crate-b', 'crate-b');

		await page.getByRole('tab', { name: 'JSON' }).click();
		const editor = page.getByRole('textbox', { name: 'Entity JSON editor' });
		await expect(editor).toBeVisible();
		await expect(editor).toHaveValue(/entity:prop\/crate-b/);

		const text = await editor.inputValue();
		const doc = JSON.parse(text) as {
			components: Record<string, Record<string, unknown>>;
		};
		doc.components.Gravity = { g: 9.8, rest: 0.5 };
		const edited = JSON.stringify(doc, null, 2);
		await editor.fill(edited);
		await dismissAllToasts(page);
		const jsonPanel = page.locator('#inspector-panel-json');
		await expect(jsonPanel.getByRole('button', { name: 'Apply' })).toBeEnabled();
		await jsonPanel.getByRole('button', { name: 'Apply' }).evaluate((el) => {
			(el as HTMLButtonElement).click();
		});

		await expect(editor).toHaveValue(/"Gravity"/, { timeout: 10_000 });
	});
});
