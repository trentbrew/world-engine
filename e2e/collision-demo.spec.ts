/**
 * Phase 2 collision events (TRL-127) — runtime verification.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type CollisionProbe = {
	scoreAfterPickup: number;
	coinRemoved: boolean;
	coinRestored: boolean;
};

async function appProbe<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(async (body) => {
		const moduleUrl = (part: string, fallback: string) =>
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes(part)) ?? fallback;

		const { world } = await import(
			/* @vite-ignore */ moduleUrl('/runtime/world.svelte.ts', '/src/lib/engine/runtime/world.svelte.ts')
		);
		const eventsMod = await import(
			/* @vite-ignore */ moduleUrl('/systems/eventSystem.ts', '/src/lib/engine/systems/eventSystem.ts')
		);
		const collisionMod = await import(
			/* @vite-ignore */ moduleUrl('/systems/collisionSystem.ts', '/src/lib/engine/systems/collisionSystem.ts')
		);
		const { score } = await import(
			/* @vite-ignore */ moduleUrl('/game/score.svelte.ts', '/src/lib/engine/game/score.svelte.ts')
		);
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl('/systems/scheduler.svelte.ts', '/src/lib/engine/systems/scheduler.svelte.ts')
		);

		return new Function(
			'world',
			'eventsMod',
			'collisionMod',
			'score',
			'scheduler',
			`return (${body})(world, eventsMod, collisionMod, score, scheduler)`
		)(world, eventsMod, collisionMod, score, scheduler);
	}, fn) as Promise<T>;
}

test('collision-demo dispatches host collision pickup on XZ overlap', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=collision-demo&mode=play&room=collision-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<CollisionProbe>(
		page,
		`(world, eventsMod, collisionMod, score, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;

			const coin = world.getEntity('entity:coin/1');
			if (!coin) throw new Error('entity:coin/1 missing');
			const playerId = world.localPlayerId;
			const player = playerId ? world.getEntity(playerId) : null;
			if (!player) throw new Error('local player missing in play mode');

			score.reset();
			world.snapshotPlayState();

			const coinPos = coin.components.Transform.position;
			player.components.Transform.position = [coinPos[0], coinPos[1], coinPos[2]];

			const ctx = { dt: 1 / 60, t: 0, tick: 1 };
			collisionMod.collisionSystem(ctx);
			eventsMod.eventSystem(ctx);

			const scoreAfterPickup = score.value;
			const coinRemoved = !world.getEntity('entity:coin/1');

			world.restorePlayState();
			const coinRestored = !!world.getEntity('entity:coin/1');

			return { scoreAfterPickup, coinRemoved, coinRestored };
		}`
	);

	expect(result.scoreAfterPickup, 'collision handler adds Collectible.value to score').toBe(1);
	expect(result.coinRemoved, 'collision destroy action removes coin').toBe(true);
	expect(result.coinRestored, 'play restore resurrects coin').toBe(true);
});

test('collision-demo ignores vertical separation on the same XZ column', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=collision-demo&mode=play&room=collision-y-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<{ scoreAfterProbe: number; coinStillThere: boolean }>(
		page,
		`(world, eventsMod, collisionMod, score, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;

			const coin = world.getEntity('entity:coin/1');
			if (!coin) throw new Error('entity:coin/1 missing');
			const playerId = world.localPlayerId;
			const player = playerId ? world.getEntity(playerId) : null;
			if (!player) throw new Error('local player missing in play mode');

			score.reset();
			const coinPos = coin.components.Transform.position;
			player.components.Transform.position = [coinPos[0], coinPos[1] + 3, coinPos[2]];

			const ctx = { dt: 1 / 60, t: 0, tick: 1 };
			collisionMod.collisionSystem(ctx);
			eventsMod.eventSystem(ctx);

			return {
				scoreAfterProbe: score.value,
				coinStillThere: !!world.getEntity('entity:coin/1')
			};
		}`
	);

	expect(result.scoreAfterProbe, 'coin should not pickup when vertically separated').toBe(0);
	expect(result.coinStillThere).toBe(true);
});
