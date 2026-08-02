/**
 * Phase 1 alarms (TRL-125) — runtime verification.
 *
 * Fuse create arms alarm0; alarmSystem countdown fires alarm0 (red + destroy);
 * destroy trigger spawns Puff. Play restore clears runtime alarm state.
 */
import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

type AlarmProbe = {
	armedAfterCreate: number;
	fuseDestroyed: boolean;
	puffSpawned: boolean;
	restoredFuse: boolean;
	alarmDisarmedAfterRestore: boolean;
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
		const alarmMod = await import(
			/* @vite-ignore */ moduleUrl('/systems/alarmSystem.ts', '/src/lib/engine/systems/alarmSystem.ts')
		);
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl('/systems/scheduler.svelte.ts', '/src/lib/engine/systems/scheduler.svelte.ts')
		);

		return new Function(
			'world',
			'eventsMod',
			'alarmMod',
			'scheduler',
			`return (${body})(world, eventsMod, alarmMod, scheduler)`
		)(world, eventsMod, alarmMod, scheduler);
	}, fn) as Promise<T>;
}

test('alarms-demo arms alarm0, fires handler, and restores clean on play exit', async ({
	page
}) => {
	await primeCollabStorage(page);
	await page.goto(`/?game=alarms-demo&mode=play&room=alarms-${Date.now()}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await page.waitForTimeout(300);

	const result = await appProbe<AlarmProbe>(
		page,
		`(world, eventsMod, alarmMod, scheduler) => {
			scheduler.pause();
			world.isOwner = () => true;
			world.entities = world.entities.filter((e) => !e.id.includes('/evt-') && e.type !== 'Puff');
			eventsMod.resetEventState();
			alarmMod.resetAlarmState();

			const fuse = world.getEntity('entity:fuse/1');
			if (!fuse) throw new Error('entity:fuse/1 missing at load');
			fuse.components.Render.color = '#3498db';
			world.snapshotPlayState();

			const puffNearFuse = () =>
				world.entities.some(
					(e) => e.type === 'Puff' && Math.abs(e.components.Transform.position[0]) < 0.1
				);

			let t = 0;
			const dt = 0.5;
			const stepOnce = () => {
				const ctx = { dt, t, tick: Math.round(t * 60) + 1 };
				alarmMod.alarmSystem(ctx);
				eventsMod.eventSystem(ctx);
				t += dt;
			};

			stepOnce();
			const armedAfterCreate = fuse.components.Alarm?.t0 ?? -1;

			let fuseDestroyed = false;
			let puffSpawned = false;
			for (let i = 0; i < 20 && !fuseDestroyed; i++) {
				stepOnce();
				if (!world.getEntity('entity:fuse/1')) {
					fuseDestroyed = true;
					puffSpawned = puffNearFuse();
				}
			}

			if (!puffSpawned) {
				stepOnce();
				puffSpawned = puffNearFuse();
			}

			world.restorePlayState();
			const restored = world.getEntity('entity:fuse/1');
			const restoredFuse =
				!!restored && restored.components.Render.color === '#3498db';
			alarmMod.resetAlarmState();
			const alarmDisarmedAfterRestore =
				!restored?.components.Alarm || Number(restored.components.Alarm.t0) < 0;

			return {
				armedAfterCreate,
				fuseDestroyed,
				puffSpawned,
				restoredFuse,
				alarmDisarmedAfterRestore
			};
		}`
	);

	expect(result.armedAfterCreate, 'create + alarm action arms slot 0').toBe(1.5);
	expect(result.fuseDestroyed, 'alarm0 handler destroys fuse after countdown').toBe(true);
	expect(result.puffSpawned, 'destroy trigger spawns puff at fuse position').toBe(true);
	expect(result.restoredFuse, 'play restore resurrects fuse at authored color').toBe(true);
	expect(result.alarmDisarmedAfterRestore, 'alarm timers cleared after restore + reset').toBe(
		true
	);
});
