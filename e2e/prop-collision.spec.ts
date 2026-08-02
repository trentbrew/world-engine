import { expect, test, type Page } from '@playwright/test';
import {
	e2eWorldUrl,
	enterEditMode,
	enterPlayMode,
	primeCollabStorage,
	readEntityJson,
	selectEntity,
	waitForWorldReady
} from './helpers';

function isBenignConsoleError(text: string): boolean {
	const t = text.toLowerCase();
	return (
		t.includes('webgl') ||
		t.includes('gpu') ||
		t.includes('favicon') ||
		(t.includes('failed to load resource') && t.includes('favicon'))
	);
}

function attachConsoleCollectors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
			errors.push(`[console] ${msg.text()}`);
		}
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(`[pageerror] ${err.message}`);
	});
	return errors;
}

test.describe('prop collision behavior', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('asset-dock-style prop (barrel GLB) ships without Physics', async ({ page }) => {
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'Prop crate-b', 'crate-b');

		const doc = await readEntityJson(page);
		expect(doc.components.Transform).toBeDefined();
		expect(doc.components.Render?.mesh).toBe('/models/barrel.glb');
		expect(doc.components.Physics).toBeUndefined();
	});

	test('physics.jsonld PhysBox entities include Physics defaults', async ({ page }) => {
		await page.goto(e2eWorldUrl('/?game=physics'));
		await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
		await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
		await enterEditMode(page);
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'PhysBox box-red', 'box-red');

		const doc = await readEntityJson(page);
		expect(doc.components.Physics).toMatchObject({
			body: 'dynamic',
			collider: 'box'
		});
	});

	test('adding Physics to a prop and entering play mode does not error', async ({ page }) => {
		const errors = attachConsoleCollectors(page);
		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Instances' }).click();
		await selectEntity(page, 'Prop crate-b', 'crate-b');

		await page.getByRole('tab', { name: 'Props' }).click();
		await expect(page.getByRole('button', { name: 'Physics', exact: true })).toHaveCount(0);

		await page.getByRole('tab', { name: 'JSON' }).click();
		const editor = page.getByRole('textbox', { name: 'Entity JSON editor' });
		const text = await editor.inputValue();
		const doc = JSON.parse(text) as {
			components: Record<string, Record<string, unknown>>;
		};
		doc.components.Physics = { body: 'dynamic', collider: 'box', mass: 1 };
		await editor.fill(JSON.stringify(doc, null, 2));
		await page.getByRole('button', { name: 'Apply' }).click();

		await page.getByRole('tab', { name: 'Props' }).click();
		await expect(page.getByRole('button', { name: 'Physics', exact: true })).toBeVisible();

		const applied = await readEntityJson(page);
		expect(applied.components.Physics).toBeDefined();

		await enterPlayMode(page);
		await expect(page.getByRole('region', { name: '3D viewport' })).toBeVisible({
			timeout: 30_000
		});

		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
