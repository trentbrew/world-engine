import { expect, test } from '@playwright/test';

async function primeCollabStorage(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(
	page: import('@playwright/test').Page,
	mode: 'edit' | 'play' = 'edit'
) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });

	if (mode === 'play') {
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
	}
}

test.describe('debug console', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('expands in play mode and shows stats panel', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		const playTab = page.getByRole('tab', { name: 'Play' });
		await playTab.click();
		await waitForWorldReady(page, 'play');

		// Ensure Developer HUD is on (scene prefs may have toggled it off).
		const viewportSettings = page.getByRole('button', { name: 'Viewport settings' });
		await viewportSettings.click();
		const statsSwitch = page.getByRole('switch', { name: /Developer HUD/i });
		if (!(await statsSwitch.isChecked())) {
			await statsSwitch.click();
		}
		// Close popover without Esc (Esc exits play to edit).
		await viewportSettings.click();

		const pill = page.getByRole('button', { name: /Developer HUD/i });
		await expect(pill).toBeVisible();
		await expect(pill).toHaveAttribute('aria-expanded', 'false');

		const box = await pill.boundingBox();
		expect(box).toBeTruthy();
		const viewport = page.viewportSize();
		expect(viewport).toBeTruthy();
		// Top-left in the play doc bar (replaces scene picker).
		expect(box!.y).toBeLessThan((viewport!.height ?? 800) * 0.35);
		expect(box!.x).toBeLessThan((viewport!.width ?? 1200) * 0.5);

		await pill.click();
		await expect(pill).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('region', { name: 'Stats' })).toBeVisible();
		await expect(page.getByText(/tick \d+/)).toBeVisible();
	});

	test('play mode camera accordion + hidden pause/reset toolbar', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Play' }).click();
		await waitForWorldReady(page, 'play');

		await expect(page.getByRole('toolbar', { name: 'Play controls' })).toHaveCount(0);

		const cameraPill = page.getByRole('button', { name: /Camera controls/i });
		await expect(cameraPill).toBeVisible();
		await cameraPill.click();
		await expect(page.getByRole('region', { name: 'Camera controls' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Reset preset' })).toBeVisible();
	});

	test('play mode jank accordion sits top-left next to stats', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		await page.getByRole('tab', { name: 'Play' }).click();
		await waitForWorldReady(page, 'play');

		const viewportSettings = page.getByRole('button', { name: 'Viewport settings' });
		await viewportSettings.click();
		const jankSwitch = page.getByRole('switch', { name: /Move jank/i });
		if (!(await jankSwitch.isChecked())) {
			await jankSwitch.click();
		}
		await viewportSettings.click();

		const jankPill = page.getByTestId('move-jank-pill');
		await expect(jankPill).toBeVisible();
		await expect(jankPill).toHaveAttribute('aria-expanded', 'false');

		const box = await jankPill.boundingBox();
		expect(box).toBeTruthy();
		const viewport = page.viewportSize();
		expect(viewport).toBeTruthy();
		expect(box!.y).toBeLessThan((viewport!.height ?? 800) * 0.35);
		expect(box!.x).toBeLessThan((viewport!.width ?? 1200) * 0.5);

		await jankPill.click();
		await expect(jankPill).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('region', { name: 'Movement smoothness' })).toBeVisible();
	});
});
