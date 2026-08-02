/** Shared alarm runtime helpers (no eventSystem dependency). */
import { world } from '$lib/engine/runtime/world.svelte';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

export const ALARM_SLOT_COUNT = 12;

/** Ensure entity has a runtime Alarm bag (all slots disarmed). */
export function ensureAlarm(entity: Entity): void {
	if (entity.components.Alarm) return;
	const bag: ComponentData = {};
	for (let i = 0; i < ALARM_SLOT_COUNT; i++) bag[`t${i}`] = -1;
	entity.components.Alarm = bag;
}

export function resetAlarmState(): void {
	for (const entity of world.entities) {
		const alarm = entity.components.Alarm;
		if (!alarm) continue;
		for (let n = 0; n < ALARM_SLOT_COUNT; n++) alarm[`t${n}`] = -1;
	}
}
