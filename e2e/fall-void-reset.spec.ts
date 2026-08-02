import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

async function appProbe<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(async (body) => {
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
		const { groundStore } = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/groundStore.svelte.ts',
				'/src/lib/engine/player/groundStore.svelte.ts'
			)
		);
		const jumpMod = await import(
			/* @vite-ignore */ moduleUrl(
				'/systems/behaviors/jump.ts',
				'/src/lib/engine/systems/behaviors/jump.ts'
			)
		);
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl(
				'/systems/scheduler.svelte.ts',
				'/src/lib/engine/systems/scheduler.svelte.ts'
			)
		);

		return new Function(
			'world',
			'groundStore',
			'jumpMod',
			'scheduler',
			`return (${body})(world, groundStore, jumpMod, scheduler)`
		)(world, groundStore, jumpMod, scheduler);
	}, fn) as Promise<T>;
}

async function openPlayWorld(page: Page, room: string) {
	await primeCollabStorage(page);
	await page.goto(`/?game=physics&mode=play&room=${room}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	await page.waitForTimeout(400);
}

test.describe('void fall auto-reset', () => {
	test('requests play reset after continuous ungrounded fall threshold', async ({ page }) => {
		await openPlayWorld(page, `fall-void-${Date.now()}`);

		const before = await appProbe<{ y: number; requested: boolean }>(
			page,
			`(world, groundStore, jumpMod, scheduler) => {
				scheduler.pause();
				jumpMod.resetJumpInputState();
				jumpMod.__testSetFallResetMs(400);
				const player = world.localPlayerId && world.getEntity(world.localPlayerId);
				if (!player) throw new Error('missing local player');
				const transform = player.components.Transform;
				const jump = player.components.Jump;
				if (!transform || !jump) throw new Error('missing components');
				groundStore.grounded = false;
				groundStore.height = -50;
				jump.vy = -1;
				const dt = 1 / 60;
				let t = 0;
				// ~167ms — under 400ms threshold
				for (let i = 0; i < 10; i++) {
					t += dt;
					jumpMod.jumpSystem({ dt, t, tick: i + 1 });
				}
				return {
					y: transform.position[1],
					requested: jumpMod.consumeFallResetRequest()
				};
			}`
		);

		expect(before.requested, 'fall under threshold should not request reset').toBe(false);

		const after = await appProbe<{ y: number; requested: boolean; second: boolean }>(
			page,
			`(world, groundStore, jumpMod) => {
				const player = world.localPlayerId && world.getEntity(world.localPlayerId);
				if (!player) throw new Error('missing local player');
				const transform = player.components.Transform;
				groundStore.grounded = false;
				groundStore.height = -50;
				const dt = 1 / 60;
				let t = 10 / 60;
				// another ~500ms → past 400ms threshold
				for (let i = 0; i < 30; i++) {
					t += dt;
					jumpMod.jumpSystem({ dt, t, tick: 11 + i });
				}
				const requested = jumpMod.consumeFallResetRequest();
				const second = jumpMod.consumeFallResetRequest();
				return { y: transform.position[1], requested, second };
			}`
		);

		expect(after.y, 'player should keep falling while ungrounded').toBeLessThan(before.y);
		expect(after.requested, 'fall past threshold should request reset').toBe(true);
		expect(after.second, 'request should latch once until re-armed').toBe(false);
	});

	test('live play triggers reset FX after shortened void fall', async ({ page }) => {
		await openPlayWorld(page, `fall-void-live-${Date.now()}`);

		await appProbe<void>(
			page,
			`(world, groundStore, jumpMod, scheduler) => {
				jumpMod.resetJumpInputState();
				jumpMod.__testSetFallResetMs(200);
				const player = world.localPlayerId && world.getEntity(world.localPlayerId);
				if (!player) throw new Error('missing local player');
				const transform = player.components.Transform;
				const jump = player.components.Jump;
				if (!transform || !jump) throw new Error('missing components');
				// Drop into the void; GroundSensor will keep us ungrounded.
				transform.position = [transform.position[0], -20, transform.position[2]];
				jump.vy = -8;
				groundStore.grounded = false;
				groundStore.height = -100;
				if (scheduler.paused) scheduler.resume();
			}`
		);

		await expect(page.locator('.reset-scrim')).toBeVisible({ timeout: 5_000 });
		await expect(page.locator('.reset-scrim')).toBeHidden({ timeout: 5_000 });

		const landed = await appProbe<{ y: number }>(
			page,
			`(world) => {
				const player = world.localPlayerId && world.getEntity(world.localPlayerId);
				if (!player) throw new Error('missing local player');
				const transform = player.components.Transform;
				return { y: transform.position[1] };
			}`
		);

		expect(landed.y, 'reset should return player near spawn height').toBeGreaterThan(-5);
	});
});
