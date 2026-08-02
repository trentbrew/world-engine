/**
 * Era visibility helpers — Frame Shift wedge 3 (TRL-245).
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import type { Entity } from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';

const MUSEUM_CLOCK_ID = 'entity:museum/clock';

registerComponent({
	name: 'EraGate',
	fields: {
		decade: { t: 'number', default: 1890, sync: 'durable' }
	}
});

export function museumDecade(w: typeof world): number {
	const clock = w.getEntity(MUSEUM_CLOCK_ID);
	return Number(clock?.components?.MuseumEra?.decade ?? 1890);
}

export function eraGateVisible(entity: Entity, decade: number): boolean {
	const gate = entity.components.EraGate as { decade?: number } | undefined;
	if (!gate) return true;
	return Number(gate.decade) === decade;
}
