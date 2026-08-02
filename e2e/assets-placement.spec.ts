/**
 * Rooms Objects tab — place object types into the room (GameMaker model).
 * Rail Models remains for mesh library; Rooms no longer mounts Assets/Settings.
 */
import { expect, test, type Page } from '@playwright/test';

function isBenignConsoleError(text: string): boolean {
	const t = text.toLowerCase();
	return t.includes('webgl') || t.includes('gpu') || t.includes('favicon');
}

function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) errors.push(msg.text());
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(err.message);
	});
	return errors;
}

async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => localStorage.setItem('collab:username-prompted', '1'));
}

async function waitForWorldReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('tree', { name: 'World entities' })).toBeVisible({ timeout: 30_000 });
}

test.describe('rooms objects placement', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('Rooms tabs are Room|Instances|Objects; type tile arms placement; rail Models works', async ({
		page
	}) => {
		const errors = collectConsoleErrors(page);
		await page.goto(`/?game=animated-npc-demo&room=objects-place-${Date.now()}`);
		await waitForWorldReady(page);

		const roomViews = page.getByRole('tablist', { name: 'Room views' });
		await expect(roomViews.getByRole('tab', { name: 'Room', exact: true })).toBeVisible();
		await expect(roomViews.getByRole('tab', { name: 'Instances', exact: true })).toBeVisible();
		await expect(roomViews.getByRole('tab', { name: 'Objects', exact: true })).toBeVisible();
		await expect(roomViews.getByRole('tab', { name: 'Assets' })).toHaveCount(0);
		await expect(roomViews.getByRole('tab', { name: 'Settings' })).toHaveCount(0);

		await roomViews.getByRole('tab', { name: 'Objects', exact: true }).click();
		await expect(page.getByText('Place types into this room')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Place Prop' })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: 'Place Player' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Place Character', exact: true })).toBeVisible();

		const propTile = page.getByRole('button', { name: 'Place Prop' });
		await propTile.click();

		const draftKind = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);
			return ui.placementDraft?.kind ?? null;
		});
		expect(draftKind, 'clicking Prop arms kind:type placement').toBe('type');

		const draftType = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);
			const d = ui.placementDraft;
			return d?.kind === 'type' ? d.typeName : null;
		});
		expect(draftType).toBe('Prop');

		// Drag also arms type draft
		const characterTile = page.getByRole('button', { name: 'Place Character', exact: true });
		const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
		await characterTile.dispatchEvent('dragstart', { dataTransfer });

		const dragType = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);
			const d = ui.placementDraft;
			return d?.kind === 'type' ? d.typeName : null;
		});
		expect(dragType).toBe('Character');

		// Rail Models still reachable for mesh library
		await page.getByRole('button', { name: 'Models', exact: true }).click();
		await expect(page.getByRole('region', { name: 'Primitives' })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByRole('button', { name: /Preview /i }).first()).toBeVisible({
			timeout: 15_000
		});

		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
