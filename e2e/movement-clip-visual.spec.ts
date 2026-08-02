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
		const playerMod = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/playerSystem.ts',
				'/src/lib/engine/player/playerSystem.ts'
			)
		);
		const visualMod = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/playerVisualStepLag.ts',
				'/src/lib/engine/player/playerVisualStepLag.ts'
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
			'playerMod',
			'visualMod',
			'jumpMod',
			'scheduler',
			`return (${body})(world, groundStore, playerMod, visualMod, jumpMod, scheduler)`
		)(world, groundStore, playerMod, visualMod, jumpMod, scheduler);
	}, fn) as Promise<T>;
}

async function openPlayWorld(page: Page, room: string) {
	await primeCollabStorage(page);
	await page.goto(`/?game=physics&mode=play&room=${room}`);
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 30_000
	});
	// HMR/dev reuse may clear world.statusMessage; wait for a playable local player instead.
	await page.waitForFunction(
		async () => {
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
			if (!id) return false;
			const player = world.getEntity(id);
			return Boolean(player?.components.Transform && player?.components.Jump);
		},
		null,
		{ timeout: 30_000 }
	);
	await page.waitForTimeout(500);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await openPlayWorld(page, `movement-clip-visual-${Date.now()}`);
});

test('visual step-lag offsets mesh down on grounded step-up', async ({ page }) => {
	const offset = await appProbe<number>(
		page,
		`(world, groundStore, playerMod, visualMod, jumpMod, scheduler) => {
			scheduler.pause();
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			visualMod.resetPlayerVisualLag();
			jump.vy = 0;
			groundStore.grounded = true;
			groundStore.normal = [0, 1, 0];

			const restY = transform.position[1];
			const restHeight = groundStore.height;
			visualMod.stepPlayerVisualStepLag(player, 1 / 60);
			// Step-lag only fires on a real ground-height rise (not flat snap).
			groundStore.height = restHeight + 0.15;
			transform.position = [transform.position[0], restY + 0.15, transform.position[2]];
			return visualMod.stepPlayerVisualStepLag(player, 1 / 60);
		}`
	);

	expect(offset, 'step-up should pull visual mesh down').toBeLessThan(-0.05);
});

test('flat ground snap without height rise does not step-lag', async ({ page }) => {
	const offset = await appProbe<number>(
		page,
		`(world, groundStore, playerMod, visualMod, jumpMod, scheduler) => {
			scheduler.pause();
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			visualMod.resetPlayerVisualLag();
			jump.vy = 0;
			groundStore.grounded = true;
			groundStore.normal = [0, 1, 0];

			const restY = transform.position[1];
			visualMod.stepPlayerVisualStepLag(player, 1 / 60);
			// Body snaps up; ground height unchanged (flat settle / capsule noise).
			transform.position = [transform.position[0], restY + 0.15, transform.position[2]];
			return visualMod.stepPlayerVisualStepLag(player, 1 / 60);
		}`
	);

	expect(offset, 'flat snap must not pull visual mesh').toBeGreaterThan(-0.02);
});
