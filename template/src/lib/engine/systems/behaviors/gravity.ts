/**
 * Gravity behavior primitive. Agents opt an entity in by giving it a `Gravity`
 * component in JSON-LD (parameters `g`, `rest` tune it) — no code required. The
 * system integrates vertical velocity and rests the entity on `rest` height.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';

registerComponent({
	name: 'Gravity',
	fields: {
		g: { t: 'number', default: 9.8 },
		vy: { t: 'number', sync: 'realtime', default: 0 },
		rest: { t: 'number', default: 0.5 }
	}
});

export function gravitySystem(ctx: TickContext) {
	for (const entity of world.query('Gravity')) {
		if (entity.components.Physics) continue;
		// Only the owner integrates; non-owners receive the result over the network.
		if (!world.isOwner(entity.id)) continue;
		const grav = entity.components.Gravity as { g: number; vy: number; rest: number };
		const transform = entity.components.Transform as
			| { position: [number, number, number] }
			| undefined;
		if (!transform) continue;

		let vy = grav.vy - grav.g * ctx.dt;
		let y = transform.position[1] + vy * ctx.dt;
		if (y <= grav.rest) {
			y = grav.rest;
			vy = 0;
		}
		grav.vy = vy;
		// New array identity so the renderer's $derived picks up the change.
		transform.position = [transform.position[0], y, transform.position[2]];
	}
}
