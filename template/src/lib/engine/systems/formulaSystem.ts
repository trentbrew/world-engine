/**
 * Derives every formula-backed field each tick, writing results into component
 * data. Runs after behavior systems so derived values reflect the same frame's
 * movement. Re-assigning the field (only when changed) drives Svelte reactivity.
 */
import { evaluate } from '$lib/engine/formula/evaluate';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';

export function formulaSystem(ctx: TickContext) {
	for (const entity of world.entities) {
		if (!entity.formulas) continue;
		for (const [componentName, fields] of Object.entries(entity.formulas)) {
			const data = entity.components[componentName];
			if (!data) continue;
			for (const [field, formula] of Object.entries(fields)) {
				const value = evaluate(entity, componentName, formula, ctx);
				if (data[field] !== value) data[field] = value;
			}
		}
	}
}
