/**
 * Phase 0 event dispatcher (TRL-123) — runtime verification.
 *
 * Loads the events-demo world, pauses the scheduler, resets to a known state,
 * then drives `eventSystem` directly and asserts every trigger + action fired:
 *   - create  → Riser turns green (set action)
 *   - step    → Riser rises (set action integrator)
 *   - if/destroy(action) → Riser removes itself past y=3
 *   - destroy (trigger)  → spawns a Puff (spawn action) at the death position
 *   - Fountain create → spawns a Riser (spawn action)
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type EventProbe = {
	colorAfterCreate: unknown;
	rose: boolean;
	fountainSpawned: boolean;
	riserDestroyed: boolean;
	runtimeDespawnCalled: boolean;
	puffSpawnedOnDestroy: boolean;
	restoredRiser: boolean;
	leakedRuntimeEntities: string[];
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
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl('/systems/scheduler.svelte.ts', '/src/lib/engine/systems/scheduler.svelte.ts')
		);

		return new Function(
			'world',
			'eventsMod',
			'scheduler',
			`return (${body})(world, eventsMod, scheduler)`
		)(world, eventsMod, scheduler);
	}, fn) as Promise<T>;
}

test('events-demo dispatches create/step/destroy triggers and set/spawn/destroy/if actions', async ({
	page
}) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=events-demo&mode=play&room=events-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	await page.waitForTimeout(300);

	const result = await appProbe<EventProbe>(
		page,
		`(world, eventsMod, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;           // remove ownership ambiguity for the test
			// The page starts in play mode; clean up any create events that fired
			// before this probe paused the scheduler, then take our own snapshot.
			world.entities = world.entities.filter((e) => !e.id.includes('/evt-') && e.type !== 'Puff');
			eventsMod.resetEventState();
			const runtimeDespawnIds = [];
			world.bindRuntimeNet({
				onSpawn: () => {},
				onRuntimeDespawn: (id) => {
					runtimeDespawnIds.push(id);
					world.despawn(id);
				}
			});

			const riser = world.getEntity('entity:riser/1');
			if (!riser) throw new Error('entity:riser/1 missing at load');
			// Known start: red + base height, so create/step effects are unambiguous.
			riser.components.Render.color = '#c0392b';
			riser.components.Transform.position = [-1.5, 0.5, 0];
			world.snapshotPlayState();

			// riser/1 is the only entity at x = -1.5, so its death-Puff is identifiable
			// by position — robust to other risers' puffs spawning/vanishing.
			const puffAtRiser = () =>
				world.entities.some(
					(e) => e.type === 'Puff' && Math.abs(e.components.Transform.position[0] + 1.5) < 0.1
				);
			const spawnedRiser = () =>
				world.entities.some((e) => e.type === 'Riser' && e.id.includes('/evt-'));

			let t = 0;
			const stepOnce = () => {
				eventsMod.eventSystem({ dt: 1 / 60, t, tick: Math.round(t * 60) + 1 });
				t += 1 / 60;
			};

			// 1 tick: create fires (green + fountain spawn), step begins the rise.
			stepOnce();
			const colorAfterCreate = riser.components.Render.color;
			const yAfterCreate = riser.components.Transform.position[1];
			const fountainSpawned = spawnedRiser();

			// Rise for a bit and confirm upward motion from the step handler.
			for (let i = 0; i < 10; i++) stepOnce();
			const rose = riser.components.Transform.position[1] > yAfterCreate;

			// Drive until riser/1 removes itself (step → if → destroy action).
			let riserDestroyed = false;
			for (let i = 0; i < 400 && !riserDestroyed; i++) {
				stepOnce();
				if (!world.getEntity('entity:riser/1')) riserDestroyed = true;
			}

			// One more tick fires the destroy TRIGGER, spawning a Puff at riser/1's spot.
			stepOnce();
			const puffSpawnedOnDestroy = puffAtRiser();
			const runtimeDespawnCalled = runtimeDespawnIds.includes('entity:riser/1');

			world.restorePlayState();
			const restored = world.getEntity('entity:riser/1');
			const restoredRiser =
				!!restored &&
				restored.components.Render.color === '#c0392b' &&
				Math.abs(restored.components.Transform.position[1] - 0.5) < 0.001;
			const leakedRuntimeEntities = world.entities
				.filter((e) => e.id.includes('/evt-') || e.type === 'Puff')
				.map((e) => e.id);

			return {
				colorAfterCreate,
				rose,
				fountainSpawned,
				riserDestroyed,
				runtimeDespawnCalled,
				puffSpawnedOnDestroy,
				restoredRiser,
				leakedRuntimeEntities
			};
		}`
	);

	expect(result.colorAfterCreate, 'create trigger + set action turns the Riser green').toBe('#3ecf8e');
	expect(result.rose, 'step trigger + set action raises the Riser').toBe(true);
	expect(result.fountainSpawned, 'Fountain create + spawn action instances a Riser').toBe(true);
	expect(result.riserDestroyed, 'step + if + destroy action removes the Riser past y=3').toBe(true);
	expect(result.runtimeDespawnCalled, 'destroy action routes through runtime despawn seam').toBe(true);
	expect(result.puffSpawnedOnDestroy, 'destroy trigger + spawn action emits a Puff').toBe(true);
	expect(result.restoredRiser, 'play snapshot restore resurrects and resets authored entities').toBe(true);
	expect(result.leakedRuntimeEntities, 'runtime event spawns are removed on play restore').toEqual([]);
});
