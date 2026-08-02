/**
 * GameMaker-style alarm timers (Phase 1, TRL-125).
 *
 * Runs before eventSystem each tick. Owner-local countdown on Alarm.t0…t11;
 * fires alarm0…alarm11 handlers via runActions when a slot reaches zero.
 */
import { world } from '$lib/engine/runtime/world.svelte';
import type { AlarmTrigger, TickContext } from '$lib/engine/ontology/schema';
import { ALARM_SLOT_COUNT } from './alarmRuntime';
import { runActions } from './eventSystem';

export { ALARM_SLOT_COUNT, ensureAlarm, resetAlarmState } from './alarmRuntime';

export function alarmSystem(ctx: TickContext): void {
	for (const entity of world.entities) {
		if (!world.isOwner(entity.id)) continue;
		const alarm = entity.components.Alarm;
		if (!alarm) continue;

		for (let n = 0; n < ALARM_SLOT_COUNT; n++) {
			const key = `t${n}`;
			const remaining = Number(alarm[key]);
			if (remaining < 0) continue;

			if (remaining === 0) {
				const handler = entity.events?.[`alarm${n}` as AlarmTrigger];
				if (handler) runActions(entity, handler, ctx);
				world.applyFieldLocal(entity.id, 'Alarm', key, -1);
				continue;
			}

			const next = remaining - ctx.dt;
			if (next <= 0) {
				world.applyFieldLocal(entity.id, 'Alarm', key, 0);
			} else {
				world.applyFieldLocal(entity.id, 'Alarm', key, next);
			}
		}
	}
}
