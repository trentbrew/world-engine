import { expect, test } from '@playwright/test';
import { primeCollabStorage, waitForWorldReady } from './helpers';

test.describe('asset rail routes + inspector', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('four asset rail routes expose catalogs and right-pane inspector tabs', async ({ page }) => {
		await page.goto(`/?game=animated-npc-demo&room=asset-rail-${Date.now()}`);
		await waitForWorldReady(page);

		for (const route of ['Models', 'Textures', 'Audio', 'Files'] as const) {
			await page.getByRole('button', { name: route, exact: true }).click();
			await expect(page.getByRole('region', { name: 'Asset preview' })).toBeVisible({
				timeout: 10_000
			});
		}

		await page.getByRole('button', { name: 'Models', exact: true }).click();
		await expect(page.getByRole('region', { name: 'Primitives', exact: true })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Models', exact: true })).toBeVisible();

		const previewBtn = page.getByRole('button', { name: /^Preview /i }).first();
		await expect(previewBtn).toBeVisible({ timeout: 15_000 });
		await previewBtn.click();

		const inspector = page.getByRole('complementary', { name: 'Asset inspector' });
		await expect(inspector).toBeVisible({ timeout: 10_000 });

		const tabs = inspector.getByRole('tablist', { name: 'Asset inspector views' });
		await expect(tabs.getByRole('tab', { name: 'Inspector' })).toBeVisible();
		await expect(tabs.getByRole('tab', { name: 'Details' })).toBeVisible();

		// Primitives / non-rigged first pick may hide Animations; Inspector is always present.
		await tabs.getByRole('tab', { name: 'Inspector' }).click();
		await expect(inspector.getByRole('region', { name: 'Asset view options' })).toBeVisible();

		await tabs.getByRole('tab', { name: 'Details' }).click();
		await expect(inspector.getByRole('region', { name: 'Asset details' })).toBeVisible();
	});

	test('rigged model shows Animations tab and playback bar', async ({ page }) => {
		await page.goto(`/?game=animated-npc-demo&room=asset-anim-${Date.now()}`);
		await waitForWorldReady(page);

		await page.getByRole('button', { name: 'Models', exact: true }).click();
		const modelBtn =
			(await page.getByRole('button', { name: /Preview player\.glb/i }).count()) > 0
				? page.getByRole('button', { name: /Preview player\.glb/i }).first()
				: page.getByRole('button', { name: /Preview xbot\.glb/i }).first();
		await expect(modelBtn).toBeVisible({ timeout: 20_000 });
		await modelBtn.click();

		const inspector = page.getByRole('complementary', { name: 'Asset inspector' });
		const animTab = inspector.getByRole('tab', { name: 'Animations' });
		await expect(animTab).toBeVisible({ timeout: 15_000 });
		// Animations is first + default for models
		await expect(animTab).toHaveAttribute('aria-selected', 'true');

		const clips = inspector.getByRole('listbox', { name: 'Animation clips' });
		await expect(clips).toBeVisible({ timeout: 15_000 });
		// Semantic descriptions help authoring agents pick clips without watching previews
		await expect(inspector.getByText(/Standing idle|locomotion|Idle|walk/i).first()).toBeVisible({
			timeout: 10_000
		});
	});
});
