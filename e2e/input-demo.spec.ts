/**
 * Phase 3 input events (TRL-129) — runtime verification.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type InputProbe = {
	scoreAfterE: number;
	fuseBlueAfterR: boolean;
	fuseRestored: boolean;
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
		const inputEventsMod = await import(
			/* @vite-ignore */ moduleUrl('/systems/inputEventSystem.ts', '/src/lib/engine/systems/inputEventSystem.ts')
		);
		const inputMod = await import(
			/* @vite-ignore */ moduleUrl('/player/input.ts', '/src/lib/engine/player/input.ts')
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
			'inputEventsMod',
			'inputMod',
			'score',
			'scheduler',
			`return (${body})(world, eventsMod, inputEventsMod, inputMod, score, scheduler)`
		)(world, eventsMod, inputEventsMod, inputMod, score, scheduler);
	}, fn) as Promise<T>;
}

test('input-demo keydown bumps score and with(Type) resets Fuse color', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=input-demo&mode=play&room=input-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<InputProbe>(
		page,
		`(world, eventsMod, inputEventsMod, inputMod, score, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;

			const fuse = world.getEntity('entity:fuse/1');
			if (!fuse) throw new Error('entity:fuse/1 missing');

			score.reset();
			world.snapshotPlayState();

			const ctx = { dt: 1 / 60, t: 0, tick: 1 };

			inputMod.__testInjectKeyEdge('down', 'e');
			inputEventsMod.inputEventSystem(ctx);

			const scoreAfterE = score.value;

			fuse.components.Render.color = '#ff0000';
			inputMod.__testInjectKeyEdge('down', 'r');
			inputEventsMod.inputEventSystem(ctx);

			const fuseBlueAfterR = fuse.components.Render.color === '#3498db';

			world.restorePlayState();
			const fuseRestored = fuse.components.Render.color === '#3498db';

			return { scoreAfterE, fuseBlueAfterR, fuseRestored };
		}`
	);

	expect(result.scoreAfterE, 'Player keydown e adds score').toBe(1);
	expect(result.fuseBlueAfterR, 'ResetSwitch keydown r with(Fuse) resets color').toBe(true);
	expect(result.fuseRestored, 'play restore resets fuse state').toBe(true);
});
