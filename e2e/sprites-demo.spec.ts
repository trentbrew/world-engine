/**
 * Phase 4 sprites (TRL-131) — derived frameIndex + GM mask alignment.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type SpritesProbe = {
	fpsAfterCreate: number;
	frameIndexAt025: number;
	frameIndexAt05: number;
	mask: string;
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
		const formulaMod = await import(
			/* @vite-ignore */ moduleUrl('/systems/formulaSystem.ts', '/src/lib/engine/systems/formulaSystem.ts')
		);
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl('/systems/scheduler.svelte.ts', '/src/lib/engine/systems/scheduler.svelte.ts')
		);

		return new Function(
			'world',
			'eventsMod',
			'formulaMod',
			'scheduler',
			`return (${body})(world, eventsMod, formulaMod, scheduler)`
		)(world, eventsMod, formulaMod, scheduler);
	}, fn) as Promise<T>;
}

test('sprites-demo derives frameIndex and create sets Animator.fps', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=sprites-demo&mode=play&room=sprites-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(400);

	const result = await appProbe<SpritesProbe>(
		page,
		`(world, eventsMod, formulaMod, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;
			eventsMod.resetEventState();

			const torch = world.getEntity('entity:torch/1');
			if (!torch) throw new Error('entity:torch/1 missing');

			const ctx0 = { dt: 1 / 60, t: 0, tick: 1 };
			eventsMod.eventSystem(ctx0);

			const fpsAfterCreate = torch.components.Animator?.fps;
			const mask = torch.components.Sprite?.mask;

			formulaMod.formulaSystem({ dt: 0.25, t: 0.25, tick: 2 });
			const frameIndexAt025 = torch.components.Animator?.frameIndex;

			formulaMod.formulaSystem({ dt: 0.25, t: 0.5, tick: 3 });
			const frameIndexAt05 = torch.components.Animator?.frameIndex;

			return { fpsAfterCreate, frameIndexAt025, frameIndexAt05, mask };
		}`
	);

	expect(result.fpsAfterCreate, 'create event sets Animator.fps to 4').toBe(4);
	expect(result.frameIndexAt025, 'floor(0.25*4)%4').toBe(1);
	expect(result.frameIndexAt05, 'floor(0.5*4)%4').toBe(2);
	expect(result.mask, 'Sprite.mask defaults to box').toBe('box');
});
