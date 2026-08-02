/**
 * Collectible component schema — pickup radius/value/sfx for collision events.
 *
 * Pickup behavior is authored via `events.collision` (Phase 2). The legacy
 * `collectSystem` tick behavior is no longer registered; this module keeps the
 * component registration for world files.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { score } from '$lib/engine/game/score.svelte';
import { playSfx } from '$lib/engine/audio/sfx';
import type { TickContext } from '$lib/engine/ontology/schema';

registerComponent({
	name: 'Collectible',
	fields: {
		radius: { t: 'number', default: 0.9 },
		value: { t: 'number', default: 1 },
		sfx: { t: 'ref', default: '/audio/collect.wav' }
	}
});

export function collectSystem(_ctx: TickContext) {
	const playerId = world.localPlayerId;
	if (!playerId) return;
	const player = world.getEntity(playerId);
	const pp = (player?.components.Transform as { position?: [number, number, number] })?.position;
	if (!pp) return;

	for (const entity of world.query('Collectible')) {
		const c = entity.components.Collectible as { radius: number; value: number; sfx?: string };
		const ep = (entity.components.Transform as { position?: [number, number, number] })?.position;
		if (!ep) continue;
		const dx = pp[0] - ep[0];
		const dz = pp[2] - ep[2];
		if (dx * dx + dz * dz <= c.radius * c.radius) {
			score.add(c.value);
			playSfx(c.sfx);
			session.despawnRuntime(entity.id);
		}
	}
}
