/**
 * Evaluates a compiled formula in the context of one entity + the current tick.
 *
 * Scope resolution (in priority order):
 *   - functions & constants (min/max/clamp/sin/…, t, dt, tick, pi, other())
 *   - every component on the entity, by name  → `Transform.position.y`
 *   - the current component's own fields, bare → `max`, `current`
 */
import { world } from '$lib/engine/runtime/world.svelte';
import type { CompiledFormula, Entity, FormulaScope, TickContext } from '$lib/engine/ontology/schema';

const FNS: Record<string, unknown> = {
	min: Math.min,
	max: Math.max,
	abs: Math.abs,
	floor: Math.floor,
	ceil: Math.ceil,
	round: Math.round,
	sqrt: Math.sqrt,
	sin: Math.sin,
	cos: Math.cos,
	clamp: (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi),
	vec2: (x: number, y: number) => [x, y],
	vec: (x: number, y: number, z: number) => [x, y, z],
	other: (id: string) => world.getEntity(id)?.components ?? {}
};

export function evaluate(
	entity: Entity,
	componentName: string,
	formula: CompiledFormula,
	ctx: TickContext
): unknown {
	const scope: FormulaScope = {
		...FNS,
		t: ctx.t,
		dt: ctx.dt,
		tick: ctx.tick,
		pi: Math.PI,
		...entity.components,
		...(entity.components[componentName] ?? {})
	};
	return formula.eval(scope);
}

/**
 * Scope for an event action's expression (no "current component", but with a
 * `self` handle and room for `other` in collision events). Reuses the same
 * functions/constants + component-by-name resolution as field formulas, so
 * `=Transform.position.y + dt * 2` reads the same in a handler as in a formula.
 */
export function actionScope(
	entity: Entity,
	ctx: TickContext,
	extra?: Record<string, unknown>
): FormulaScope {
	return {
		...FNS,
		t: ctx.t,
		dt: ctx.dt,
		tick: ctx.tick,
		pi: Math.PI,
		self: entity.components,
		...entity.components,
		...(extra ?? {})
	};
}
