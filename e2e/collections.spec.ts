import { expect, test } from '@playwright/test';
import { primeCollabStorage, dismissAllToasts, waitForWorldReady } from './helpers';

test.describe('collections', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('browse, filter, link, create and delete game-global records', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/?game=collections-demo');
		await waitForWorldReady(page);

		// Open the Collections route from the bottom dock.
		await page.getByRole('button', { name: 'Collections', exact: true }).click();

		// Seeded collections appear in the left navigator (collectionMeta plural labels).
		const heroes = page.getByRole('button', { name: /Heroes/ });
		await expect(heroes).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Story Beats/ })).toBeVisible();

		// Select Heroes → the datatable renders columns from the Profile fields + 2 seed rows.
		await heroes.click();
		await expect(page.getByRole('columnheader', { name: /displayName/ })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('columnheader', { name: /rival/ })).toBeVisible();
		const rows = page.locator('.records-table tbody tr');
		await expect(rows).toHaveCount(2);

		// Relational ref rendered as a picker populated with the other records.
		await expect(page.getByRole('option', { name: 'Koa' }).first()).toBeAttached();

		// Search filters record rows by field value ("Rider" is Alba's role, unique to her).
		const search = page.getByRole('searchbox', { name: 'Search records' });
		await search.fill('Rider');
		await expect(rows).toHaveCount(1);
		await search.fill('');
		await expect(rows).toHaveCount(2);

		// Create a new record from the toolbar → third row.
		await page.getByRole('button', { name: 'New record' }).click();
		await expect(rows).toHaveCount(3, { timeout: 10_000 });

		// Delete the new record → back to two seeded rows.
		await rows.last().hover();
		await rows.last().getByRole('button', { name: 'Delete record' }).click();
		await expect(rows).toHaveCount(2, { timeout: 10_000 });

		// Records are game-global: leave and return, the collection + rows persist in-session.
		await page.getByRole('button', { name: 'Models', exact: true }).click();
		await page.getByRole('button', { name: 'Collections', exact: true }).click();
		await page.getByRole('button', { name: /Heroes/ }).click();
		await expect(page.locator('.records-table tbody tr')).toHaveCount(2);
	});

	test('add a field to a collection schema from the datatable', async ({ page }) => {
		await page.goto('/?game=collections-demo');
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Collections', exact: true }).click();
		await page.getByRole('button', { name: /Story Beats/ }).click();
		await expect(page.getByRole('columnheader', { name: /title/ })).toBeVisible({
			timeout: 15_000
		});

		await page.getByRole('button', { name: 'Add field' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add field' });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Field name').fill('priority');
		await dialog.getByLabel('Type').selectOption('number');
		await dialog.getByRole('button', { name: 'Add field', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Add field' })).toHaveCount(0);
		await expect(page.getByRole('columnheader', { name: /priority/ })).toBeVisible({
			timeout: 10_000
		});
	});

	test('add a select field with options renders a dropdown cell', async ({ page }) => {
		await page.goto('/?game=collections-demo');
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Collections', exact: true }).click();
		await page.getByRole('button', { name: /Heroes/ }).click();
		await expect(page.getByRole('columnheader', { name: /displayName/ })).toBeVisible({
			timeout: 15_000
		});

		await page.getByRole('button', { name: 'Add field' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add field' });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Field name').fill('rank');
		await dialog.getByLabel('Type').selectOption('select');
		await dialog.getByLabel('Options').fill('bronze, silver, gold');
		await dialog.getByRole('button', { name: 'Add field', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Add field' })).toHaveCount(0);

		// New column + a dropdown cell offering the declared options.
		await expect(page.getByRole('columnheader', { name: /rank/ })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('option', { name: 'gold' }).first()).toBeAttached();
	});

	test('delete a field from a collection schema removes its column', async ({ page }) => {
		await page.goto('/?game=collections-demo');
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Collections', exact: true }).click();
		await page.getByRole('button', { name: /Story Beats/ }).click();

		// Add a throwaway field, confirm it appears.
		await page.getByRole('button', { name: 'Add field' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add field' });
		await dialog.getByLabel('Field name').fill('scratch');
		await dialog.getByLabel('Type').selectOption('number');
		await dialog.getByRole('button', { name: 'Add field', exact: true }).click();
		const col = page.getByRole('columnheader', { name: /scratch/ });
		await expect(col).toBeVisible({ timeout: 10_000 });
		await dismissAllToasts(page);

		// Delete it → column disappears.
		await col.getByRole('button', { name: 'Delete field scratch' }).click({ force: true });
		await expect(page.getByRole('columnheader', { name: /scratch/ })).toHaveCount(0, {
			timeout: 10_000
		});
	});

	test('rename a field on a collection schema', async ({ page }) => {
		await page.goto('/?game=collections-demo');
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Collections', exact: true }).click();
		await page.getByRole('button', { name: /Story Beats/ }).click();

		await page.getByRole('button', { name: 'Add field' }).click();
		const addDialog = page.getByRole('dialog', { name: 'Add field' });
		await addDialog.getByLabel('Field name').fill('scratch');
		await addDialog.getByLabel('Type').selectOption('number');
		await addDialog.getByRole('button', { name: 'Add field', exact: true }).click();
		const col = page.getByRole('columnheader', { name: /scratch/ });
		await expect(col).toBeVisible({ timeout: 10_000 });
		await dismissAllToasts(page);

		await col.getByRole('button', { name: 'Edit field scratch' }).click();
		const editDialog = page.getByRole('dialog', { name: 'Edit field' });
		await expect(editDialog).toBeVisible({ timeout: 10_000 });
		await editDialog.locator('#edit-field-name').fill('severity');
		await editDialog.getByRole('button', { name: 'Save field' }).click();
		await expect(page.getByRole('columnheader', { name: /severity/ })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByRole('columnheader', { name: /scratch/ })).toHaveCount(0);
	});
});
