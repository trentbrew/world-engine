/**
 * Player avatar mesh sync across peers (spawn heal + pause-menu picker).
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

async function readRemotePlayerMeshes(page: Page) {
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
		const { session } = await import(
			/* @vite-ignore */ moduleUrl(
			'/net/session.svelte.ts',
			'/src/lib/engine/net/session.svelte.ts'
		)
		);
		const localId = world.localPlayerId;
		const meshes: Record<string, string | null> = {};
		for (const entity of world.entities) {
			if (!entity.id.startsWith('entity:player/')) continue;
			if (entity.id === localId) continue;
			meshes[entity.id] =
				(entity.components.SkinnedMesh as { mesh?: string } | undefined)?.mesh ?? null;
		}
		return { meshes, peerCount: session.peerCount };
	});
}

test.describe('player avatar peer sync', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('pause-menu avatar mesh syncs to a second tab', async ({ context }) => {
		test.setTimeout(120_000);
		const room = `avatar-peer-${Date.now()}`;
		const pageA = await context.newPage();
		const pageB = await context.newPage();

		await primeCollabStorage(pageA);
		await primeCollabStorage(pageB);

		await pageA.goto(e2eWorldUrl(`/?game=blank&room=${room}`));
		await pageB.goto(e2eWorldUrl(`/?game=blank&room=${room}`));
		await waitForWorldReady(pageA);
		await waitForWorldReady(pageB);
		await enterPlayMode(pageA);
		await enterPlayMode(pageB);
		await waitForLocalPlayer(pageA);
		await waitForLocalPlayer(pageB);

		await expect
			.poll(async () => (await readRemotePlayerMeshes(pageB)).peerCount, { timeout: 15_000 })
			.toBeGreaterThanOrEqual(2);

		await pageA.keyboard.press('p');
		const menu = pageA.getByRole('dialog', { name: /Paused/i });
		await expect(menu).toBeVisible({ timeout: 10_000 });
		await menu.getByRole('option', { name: /player/i }).first().click();

		await expect
			.poll(
				async () => {
					const { meshes } = await readRemotePlayerMeshes(pageB);
					return Object.values(meshes).some((m) => m?.includes('player.glb'));
				},
				{ timeout: 20_000 }
			)
			.toBe(true);

		await pageA.close();
		await pageB.close();
	});
});
