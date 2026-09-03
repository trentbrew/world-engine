import { expect, test, type Page } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, waitForWorldReady } from './helpers';

/**
 * Terrain-owned grass — the heightmap world boots cleanly with the new grass
 * layer wired in. Blade-surface alignment is the deterministic smoke's job
 * (scripts/grass-terrain-smoke.ts); this e2e just locks the render path: the
 * terrain+grass world loads with no fatal console errors and the scene reads
 * "Terrain".
 */

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
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) errors.push(msg.text());
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(err.message);
	});
	return errors;
}

test.describe('terrain + grass', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('terrain world with grass loads without fatal console errors', async ({ page }) => {
		const errors = await collectConsoleErrors(page);
		await page.goto(e2eWorldUrl('/?game=terrain'));
		await waitForWorldReady(page);
		expect(page.url()).toContain('game=terrain');
		await expect(page.getByRole('combobox', { name: 'Select scene' })).toContainText('Terrain');
		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
