/**
 * Phase 6 scripts (TRL-135) — named action lists + script refs.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type ScriptsProbe = {
	scoreAfterE: number;
	scoreAfterR: number;
	fusesOrange: boolean;
	fusesRestored: boolean;
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
			'inputEventsMod',
			'inputMod',
			'score',
			'scheduler',
			`return (${body})(world, inputEventsMod, inputMod, score, scheduler)`
		)(world, inputEventsMod, inputMod, score, scheduler);
	}, fn) as Promise<T>;
}

test('scripts-demo keydown invokes named scripts and nested combo', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=scripts-demo&mode=play&room=scripts-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<ScriptsProbe>(
		page,
		`(world, inputEventsMod, inputMod, score, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;

			score.reset();
			world.snapshotPlayState();

			const ctx = { dt: 1 / 60, t: 0, tick: 1 };

			inputMod.__testInjectKeyEdge('down', 'e');
			inputEventsMod.inputEventSystem(ctx);
			const scoreAfterE = score.value;

			inputMod.__testInjectKeyEdge('down', 'r');
			inputEventsMod.inputEventSystem(ctx);
			const scoreAfterR = score.value;

			const fuses = world.entities.filter((entity) => entity.type === 'Fuse');
			const fusesOrange =
				fuses.length >= 2 &&
				fuses.every((fuse) => fuse.components.Render.color === '#ff6600');

			world.restorePlayState();
			const fusesRestored = fuses.every(
				(fuse) => fuse.components.Render.color === '#3498db'
			);

			return { scoreAfterE, scoreAfterR, fusesOrange, fusesRestored };
		}`
	);

	expect(result.scoreAfterE, 'script:bump-score via key e').toBe(1);
	expect(result.scoreAfterR, 'script:combo nests bump-score again').toBe(2);
	expect(result.fusesOrange, 'script:combo resets all fuses').toBe(true);
	expect(result.fusesRestored, 'play restore resets fuse colors').toBe(true);
});
