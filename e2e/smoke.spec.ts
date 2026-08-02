import { expect, test, type Page } from '@playwright/test';

/** Benign browser/WebGL noise — not app regressions. */
function isBenignConsoleError(text: string): boolean {
	const t = text.toLowerCase();
	return (
		t.includes('webgl') ||
		t.includes('gpu') ||
		t.includes('favicon') ||
		(t.includes('failed to load resource') && t.includes('favicon'))
	);
}

async function collectConsoleErrors(page: Page): Promise<string[]> {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
			errors.push(msg.text());
		}
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(err.message);
	});
	return errors;
}

/** Skip first-visit username dialog so it does not block play-mode clicks. */
async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(page: Page, mode: 'edit' | 'play' = 'edit') {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });

	if (mode === 'edit') {
		await expect(page.getByRole('combobox', { name: 'Select scene' })).toBeVisible();
	} else {
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
	}
}

test.describe('world shell smoke', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('default world loads without fatal console errors', async ({ page }) => {
		const errors = await collectConsoleErrors(page);
		await page.goto('/');
		await waitForWorldReady(page);
		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});

	test('orbit game tab loads', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);
		await expect(page.getByRole('combobox', { name: 'Select scene' })).toContainText('Orbit');
	});

	test('play mode toggles from doc bar', async ({ page }) => {
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		const playTab = page.getByRole('tab', { name: 'Play' });
		await expect(playTab).toBeVisible();
		await playTab.click();

		await waitForWorldReady(page, 'play');

		await page.keyboard.press('Escape');
		await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
	});

	test('collect game loads in play mode via query param', async ({ page }) => {
		const errors = await collectConsoleErrors(page);
		await page.goto('/?game=collect&play');
		await waitForWorldReady(page, 'play');
		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
