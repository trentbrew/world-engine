/**
 * Phase 5 rooms (TRL-133) — multi-room catalog + switchRoom.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type RoomsProbe = {
	activeRoomId: string | null;
	doorInHall: boolean;
	gemInHall: boolean;
	afterSwitchRoomId: string | null;
	gemInVault: boolean;
	doorInVault: boolean;
	playerKept: boolean;
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
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl('/systems/scheduler.svelte.ts', '/src/lib/engine/systems/scheduler.svelte.ts')
		);

		return new Function(
			'world',
			'scheduler',
			`return (${body})(world, scheduler)`
		)(world, scheduler);
	}, fn) as Promise<T>;
}

test('rooms-demo loads hall, switchRoom swaps to vault and keeps player', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=rooms-demo&mode=play&room=rooms-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<RoomsProbe>(
		page,
		`(world, scheduler) => {
			scheduler.pause();

			const playerId = world.localPlayerId;
			const playerBefore = playerId ? world.getEntity(playerId) : null;
			if (!playerBefore) throw new Error('local player missing in play mode');

			const activeRoomId = world.activeRoomId;
			const doorInHall = !!world.getEntity('entity:door/1');
			const gemInHall = !!world.getEntity('entity:gem/1');

			const switched = world.switchRoom('room:vault');
			if (!switched) throw new Error('switchRoom returned false');

			const afterSwitchRoomId = world.activeRoomId;
			const gemInVault = !!world.getEntity('entity:gem/1');
			const doorInVault = !!world.getEntity('entity:door/1');
			const playerKept = !!world.getEntity(playerBefore.id);

			return {
				activeRoomId,
				doorInHall,
				gemInHall,
				afterSwitchRoomId,
				gemInVault,
				doorInVault,
				playerKept
			};
		}`
	);

	expect(result.activeRoomId, 'boot room is hall').toBe('room:hall');
	expect(result.doorInHall, 'hall contains door').toBe(true);
	expect(result.gemInHall, 'vault gem hidden in hall').toBe(false);
	expect(result.afterSwitchRoomId, 'switchRoom updates active room').toBe('room:vault');
	expect(result.gemInVault, 'vault contains gem').toBe(true);
	expect(result.doorInVault, 'hall door removed in vault').toBe(false);
	expect(result.playerKept, 'player survives room switch').toBe(true);
});
