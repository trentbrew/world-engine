/**
 * TRL-177 — pause menu avatar switcher.
 */
import { expect, test, type Page } from '@playwright/test';
import {
	e2eWorldUrl,
	enterPlayMode,
	primeCollabStorage,
	waitForWorldReady
} from './helpers';

async function waitForLocalPlayer(page: Page) {
	await expect
		.poll(
			async () =>
				page.evaluate(async () => {
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
					const id = world.localPlayerId;
					return id && world.getEntity(id) ? id : null;
				}),
			{ timeout: 30_000 }
		)
		.not.toBeNull();
}

async function readMesh(page: Page) {
	return page.evaluate(async () => {
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
		const id = world.localPlayerId;
		const e = id ? world.getEntity(id) : null;
		return (e?.components.SkinnedMesh as { mesh?: string } | undefined)?.mesh ?? null;
	});
}

test.describe('pause menu avatar (TRL-177)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('pause menu lists avatars; selecting player.glb updates mesh', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(e2eWorldUrl(`/?game=blank&room=trl177-pause-${Date.now()}`));
		await waitForWorldReady(page);
		await enterPlayMode(page);
		await waitForLocalPlayer(page);

		await page.keyboard.press('p');
		const menu = page.getByRole('dialog', { name: /Paused/i });
		await expect(menu).toBeVisible({ timeout: 10_000 });
		await expect(menu.getByRole('listbox', { name: 'Player models' })).toBeVisible({
			timeout: 15_000
		});
		// Only configured avatars (player / mannequin / xbot) — not raya / buildings.
		await expect(menu.getByRole('option', { name: /raya/i })).toHaveCount(0);
		await expect(menu.getByRole('option', { name: /player/i })).toBeVisible();

		const before = await readMesh(page);
		expect(before).toContain('mannequin');

		await menu.getByRole('option', { name: /player/i }).first().click();
		await expect
			.poll(async () => readMesh(page), { timeout: 15_000 })
			.toContain('player.glb');

		// R reset restores play snapshot bags — must re-apply Player type avatar.
		await page.keyboard.press('r');
		await expect
			.poll(async () => readMesh(page), { timeout: 15_000 })
			.toContain('player.glb');
	});
});
