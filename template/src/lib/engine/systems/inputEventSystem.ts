/**
 * Input event dispatcher — GameMaker-style key triggers (Phase 3, TRL-129).
 *
 * Fires keydown / keyup / keyheld handlers on owned entities when play-mode
 * keyboard edges occur. Runs after playerSystem so movement reads keys first.
 */
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';
import { drainPressedEdges, drainReleasedEdges, input } from '$lib/engine/player/input';
import { runActions } from './eventSystem';

export function resetInputEventState(): void {
	/* no module state v1 */
}

export function inputEventSystem(ctx: TickContext): void {
	const pressed = drainPressedEdges();
	const released = drainReleasedEdges();

	for (const entity of world.entities) {
		if (!world.isOwner(entity.id)) continue;
		const events = entity.events;
		if (!events) continue;

		if (events.keydown) {
			for (const rule of events.keydown) {
				if (!pressed.includes(rule.key.toLowerCase())) continue;
				runActions(entity, rule.do, ctx);
			}
		}
		if (events.keyup) {
			for (const rule of events.keyup) {
				if (!released.includes(rule.key.toLowerCase())) continue;
				runActions(entity, rule.do, ctx);
			}
		}
		if (events.keyheld) {
			for (const rule of events.keyheld) {
				if (!input.pressed(rule.key)) continue;
				runActions(entity, rule.do, ctx);
			}
		}
	}
}
