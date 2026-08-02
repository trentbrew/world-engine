/**
 * Event dispatcher — the GameMaker-style event layer (Phase 0, TRL-123).
 *
 * Entities (via their type or inline) may carry `events`: ordered action lists
 * keyed by a life-cycle trigger. This system fires them from the world's own
 * life-cycle each tick:
 *   - create:  once, the first tick an entity with a create handler is live
 *   - step:    every tick
 *   - destroy: the tick an entity that had a destroy handler leaves the world
 *
 * Handlers run only on the entity's owner (Phase 0 authority = owner), and their
 * actions mutate through the same seams behaviors use (`applyFieldLocal`,
 * `despawn`, `spawnRuntime`) — never the durable/broadcast authoring path.
 *
 * The action DSL is deliberately finite (set / spawn / destroy / if / alarm / score / sfx) so games
 * stay diffable, agent-authorable, and multiplayer-safe. See
 * docs/plans/gamemaker-model.md.
 */
import { world } from '$lib/engine/runtime/world.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { normalizeRoomId } from '$lib/engine/ontology/roomCatalog';
import { getScriptActions, normalizeScriptId } from '$lib/engine/ontology/scriptCatalog';
import { getComponent, getType } from '$lib/engine/ontology/registry';
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import { compile, isFormula } from '$lib/engine/formula/parse';
import { actionScope } from '$lib/engine/formula/evaluate';
import { score } from '$lib/engine/game/score.svelte';
import { playSfx } from '$lib/engine/audio/sfx';
import type {
	CompiledFormula,
	ComponentData,
	Entity,
	EventAction,
	TickContext
} from '$lib/engine/ontology/schema';
import { ALARM_SLOT_COUNT, ensureAlarm } from './alarmRuntime';

const VEC_INDEX: Record<string, number> = { x: 0, y: 1, z: 2, w: 3 };

/** Max nested script invocations before warn-skip (TRL-135). */
export const MAX_SCRIPT_DEPTH = 16;

// Cache compiled expressions so a step handler doesn't re-parse every tick.
const exprCache = new Map<string, CompiledFormula>();
function compileCached(src: string): CompiledFormula {
	let compiled = exprCache.get(src);
	if (!compiled) {
		compiled = compile(src);
		exprCache.set(src, compiled);
	}
	return compiled;
}

/** Resolve an action value: a formula string evaluates in-entity; else literal. */
function evalValue(
	value: unknown,
	entity: Entity,
	ctx: TickContext,
	other?: Entity
): unknown {
	const extra = other ? { other: other.components } : undefined;
	if (isFormula(value)) return compileCached(value).eval(actionScope(entity, ctx, extra));
	return value;
}

/** Write "Comp.field" or "Comp.field.axis" locally (no durable/broadcast). */
function applySet(entity: Entity, path: string, value: unknown): void {
	const parts = path.split('.');
	if (parts.length === 2) {
		const [comp, field] = parts;
		if (!entity.components[comp]) return;
		world.applyFieldLocal(entity.id, comp, field, value);
		return;
	}
	if (parts.length === 3 && parts[2] in VEC_INDEX) {
		const [comp, field, axis] = parts;
		const arr = entity.components[comp]?.[field];
		if (!Array.isArray(arr)) return;
		const next = [...arr];
		next[VEC_INDEX[axis]] = Number(value);
		world.applyFieldLocal(entity.id, comp, field, next);
	}
}

let spawnSeq = 0;

/** Build a fresh entity from a registered type for a spawn action. */
function buildFromType(
	typeName: string,
	at: unknown,
	id: string | undefined,
	overrides: Record<string, ComponentData> | undefined
): Entity | null {
	const name = typeName.replace(/^type:/, '');
	const type = getType(name);
	if (!type) {
		console.warn(`[events] spawn: unknown type "${typeName}"`);
		return null;
	}

	const components: Record<string, ComponentData> = {};
	const formulas: NonNullable<Entity['formulas']> = {};
	for (const compName of type.components) {
		const schema = getComponent(compName);
		if (!schema) continue;
		const raw = { ...(type.defaults?.[compName] ?? {}), ...(overrides?.[compName] ?? {}) };
		const { bag, formulas: compiled } = createComponentBag(schema, raw);
		components[compName] = bag;
		if (compiled) formulas[compName] = compiled;
	}

	if (Array.isArray(at) && components.Transform) {
		components.Transform.position = [Number(at[0]) || 0, Number(at[1]) || 0, Number(at[2]) || 0];
	}

	let entityId = id ?? `entity:${name.toLowerCase()}/evt-${(spawnSeq += 1)}`;
	while (world.getEntity(entityId)) entityId = `entity:${name.toLowerCase()}/evt-${(spawnSeq += 1)}`;

	return {
		id: entityId,
		type: name,
		components,
		formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
		events: type.events,
		raw: {}
	};
}

/** Run a handler's action list against an entity. Exported for tests/reuse. */
export function runActions(
	entity: Entity,
	actions: EventAction[],
	ctx: TickContext,
	opts?: { other?: Entity; scriptDepth?: number }
): void {
	const other = opts?.other;
	for (const action of actions) {
		if ('set' in action) {
			applySet(entity, action.set, evalValue(action.to, entity, ctx, other));
		} else if ('spawn' in action) {
			const at = action.at !== undefined ? evalValue(action.at, entity, ctx, other) : undefined;
			const spawned = buildFromType(action.spawn, at, action.id, action.with);
			if (spawned) world.spawnRuntime(spawned);
		} else if ('destroy' in action) {
			world.despawnRuntime(action.destroy === 'self' ? entity.id : action.destroy);
		} else if ('if' in action) {
			const branch = evalValue(action.if, entity, ctx, other) ? action.then : action.else;
			if (branch) runActions(entity, branch, ctx, opts);
		} else if ('alarm' in action) {
			const n = action.alarm;
			if (n < 0 || n >= ALARM_SLOT_COUNT) continue;
			const seconds = Number(evalValue(action.in, entity, ctx, other));
			ensureAlarm(entity);
			world.applyFieldLocal(entity.id, 'Alarm', `t${n}`, seconds < 0 ? -1 : seconds);
		} else if ('score' in action) {
			score.add(Number(evalValue(action.score, entity, ctx, other)));
		} else if ('sfx' in action) {
			playSfx(String(evalValue(action.sfx, entity, ctx, other)));
		} else if ('with' in action && typeof action.with === 'string' && 'do' in action) {
			const typeName = action.with.replace(/^type:/, '');
			for (const target of world.entities) {
				if (target.type !== typeName) continue;
				if (!world.isOwner(target.id)) continue;
				runActions(target, action.do, ctx, opts);
			}
		} else if ('goto_room' in action) {
			if (!session.isHost) continue;
			const roomId = normalizeRoomId(String(evalValue(action.goto_room, entity, ctx, other)));
			world.switchRoom(roomId, { members: session.members });
		} else if ('script' in action) {
			const scriptId = normalizeScriptId(String(evalValue(action.script, entity, ctx, other)));
			const scriptActions = getScriptActions(scriptId);
			if (!scriptActions) {
				console.warn(`[events] script: unknown "${scriptId}"`);
				continue;
			}
			const depth = (opts?.scriptDepth ?? 0) + 1;
			if (depth > MAX_SCRIPT_DEPTH) {
				console.warn(`[events] script: max depth exceeded at "${scriptId}"`);
				continue;
			}
			runActions(entity, scriptActions, ctx, { ...opts, scriptDepth: depth });
		}
	}
}

// --- dispatcher state (reset on play stop so edit→play cycles start clean) ---
let firedCreate = new Set<string>();
let prevDestroyable = new Map<string, Entity>();

export function resetEventState(): void {
	firedCreate = new Set();
	prevDestroyable = new Map();
}

export function eventSystem(ctx: TickContext): void {
	const live = new Set<string>();
	const nextDestroyable = new Map<string, Entity>();

	for (const entity of world.entities) {
		live.add(entity.id);
		const events = entity.events;
		if (!events || !world.isOwner(entity.id)) continue;

		if (events.create && !firedCreate.has(entity.id)) {
			firedCreate.add(entity.id);
			runActions(entity, events.create, ctx);
		}
		if (events.step) runActions(entity, events.step, ctx);
		if (events.destroy) nextDestroyable.set(entity.id, entity);
	}

	// destroy: entities that had a destroy handler last tick and are now gone.
	for (const [id, entity] of prevDestroyable) {
		if (live.has(id)) continue;
		const destroy = entity.events?.destroy;
		if (destroy && world.isOwner(id)) runActions(entity, destroy, ctx);
	}

	// Forget create-state for entities that left, so a reused id re-fires create.
	for (const id of firedCreate) if (!live.has(id)) firedCreate.delete(id);

	prevDestroyable = nextDestroyable;
}
