import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, selectEntity, waitForWorldReady } from './helpers';

test('workbench tabs expose events and asset preview surfaces', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(e2eWorldUrl(`/?game=events-demo&room=workbench-${Date.now()}`));
	await waitForWorldReady(page);

	await page.getByRole('tab', { name: 'Instances' }).click();
	await selectEntity(page, 'Riser 1', '1');
	await page.getByRole('tab', { name: 'JSON' }).click();

	const editor = page.getByRole('textbox', { name: 'Entity JSON editor' });
	await expect(editor).toBeVisible();
	await expect.poll(async () => editor.inputValue()).toContain('entity:riser/1');

	await page.getByRole('tab', { name: 'Ops', exact: true }).click();
	await expect(page.getByRole('tabpanel', { name: 'Ops' })).toBeVisible();

	await page.getByRole('button', { name: 'Textures', exact: true }).click();
	await expect(page.getByRole('searchbox', { name: /Search textures/i })).toBeVisible({
		timeout: 10_000
	});

	const previewBtn = page.getByRole('button', { name: /^Preview / }).first();
	await expect(previewBtn).toBeVisible({ timeout: 15_000 });
	const assetName = ((await previewBtn.getAttribute('aria-label')) ?? '').replace(/^Preview /, '');
	expect(assetName.length).toBeGreaterThan(0);

	await previewBtn.click();
	await expect(page.getByRole('region', { name: 'Asset preview' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Asset inspector' })).toContainText(assetName);

	// Off asset routes, preview uses overlay + tray (Rooms route).
	await page.getByRole('button', { name: 'Rooms', exact: true }).click();
	await page.evaluate(async () => {
		const moduleUrl = (part: string, fallback: string) =>
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes(part)) ?? fallback;
		const { ui } = await import(
			/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
		);
		const { assetLibrary } = await import(
			/* @vite-ignore */ moduleUrl('/ui/assetLibrary.svelte.ts', '/src/lib/ui/assetLibrary.svelte.ts')
		);
		await assetLibrary.ensureLoaded();
		const asset = assetLibrary.assets.find((a) => a.kind === 'textures');
		if (asset) ui.openAssetPreview(asset);
	});

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(page.getByRole('region', { name: 'Preview tray' })).toBeVisible();

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Preview tray' })).toHaveCount(0);
});
