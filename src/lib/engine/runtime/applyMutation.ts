/**
 * Apply durable graph mutations to the live world (remote sync / Trellis poll).
 */
import { createComponentBag } from '$lib/engine/ontology/resolveComponentBag';
import { getComponent } from '$lib/engine/ontology/registry';
import type { EntityEvents, Entity } from '$lib/engine/ontology/schema';
import type {
	DurablePatch,
	DurableDefineTypePatch,
	DurableDefineComponentPatch,
	DurableRemoveComponentPatch,
	DurableSetComponentPatch,
	DurableSetEntityPatch,
	DurableSetEventsPatch
} from '$lib/engine/ontology/durablePatch';
import { isFieldPatch, patchKind } from '$lib/engine/ontology/durablePatch';
import { registerType, setComponentSchema } from '$lib/engine/ontology/registry';
import { buildComponentsFromJson } from '$lib/engine/runtime/entityJson';
import { world } from '$lib/engine/runtime/world.svelte';
import { bootstrapFormulas } from '$lib/engine/systems';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import { warmLocomotionPack } from '$lib/engine/player/playerLocomotionClips';

export function applyDurableMutation(patch: DurablePatch) {
	switch (patchKind(patch)) {
		case 'setField':
			if (!isFieldPatch(patch)) return;
			world.applyFieldLocal(patch.entityId, patch.component, patch.field, patch.value);
			return;
		case 'setComponent':
			if (!('bag' in patch)) return;
			applyComponentLocal(patch as DurableSetComponentPatch);
			return;
		case 'removeComponent':
			if (!('component' in patch)) return;
			applyRemoveComponentLocal(patch as DurableRemoveComponentPatch);
			return;
		case 'setEntity':
			if (!('components' in patch)) return;
			applySetEntityLocal(patch as DurableSetEntityPatch);
			return;
		case 'removeEntity':
			if (!('entityId' in patch)) return;
			world.despawn(patch.entityId);
			return;
		case 'defineType':
			if (!('name' in patch)) return;
			applyDefineTypeLocal(patch as DurableDefineTypePatch);
			return;
		case 'defineComponent':
			if (!('fields' in patch)) return;
			applyDefineComponentLocal(patch as DurableDefineComponentPatch);
			return;
		case 'setEvents':
			if (!('events' in patch)) return;
			applySetEventsLocal(patch as DurableSetEventsPatch);
			return;
	}
}

function applySetEventsLocal(patch: DurableSetEventsPatch) {
	const entity = world.getEntity(patch.entityId);
	if (!entity) return;

	const events = patch.events as EntityEvents;
	if (!events || Object.keys(events).length === 0) {
		delete entity.events;
		if (entity.raw) delete entity.raw.events;
	} else {
		entity.events = structuredClone(events);
		if (entity.raw) entity.raw.events = structuredClone(events);
	}

	world.entities = [...world.entities];
}

function applyComponentLocal(patch: DurableSetComponentPatch) {
	const entity = world.getEntity(patch.entityId);
	if (!entity) return;

	const schema = getComponent(patch.component);
	const existing = entity.components[patch.component];

	if (!existing && schema) {
		const { bag, formulas } = createComponentBag(schema, patch.bag);
		entity.components[patch.component] = bag;
		if (formulas) {
			entity.formulas ??= {};
			entity.formulas[patch.component] = formulas;
		}
	} else {
		const bag = { ...(existing ?? {}) };
		for (const [field, value] of Object.entries(patch.bag)) {
			bag[field] = value;
		}
		entity.components[patch.component] = bag;
	}

	bootstrapFormulas();
	world.entities = [...world.entities];
}

function applyRemoveComponentLocal(patch: DurableRemoveComponentPatch) {
	const entity = world.getEntity(patch.entityId);
	if (!entity) return;

	delete entity.components[patch.component];
	if (entity.formulas?.[patch.component]) {
		delete entity.formulas[patch.component];
		if (Object.keys(entity.formulas).length === 0) delete entity.formulas;
	}

	world.entities = [...world.entities];
}

function applySetEntityLocal(patch: DurableSetEntityPatch) {
	const built = buildComponentsFromJson(patch.entityId, patch.components);
	if (!built.ok || !built.components) return;

	const entity = world.getEntity(patch.entityId);
	if (!entity) {
		// Create-if-absent — remote/record create replication.
		world.spawn({
			id: patch.entityId,
			type: patch.conformsTo,
			components: built.components,
			formulas: built.formulas,
			raw: {}
		});
		renderBounds.clear(patch.entityId);
		bootstrapFormulas();
		world.entities = [...world.entities];
		world.notifyEntityStructureChanged();
		return;
	}

	entity.components = built.components;
	entity.formulas = built.formulas;
	if (patch.conformsTo !== undefined) entity.type = patch.conformsTo;

	renderBounds.clear(patch.entityId);
	bootstrapFormulas();
	world.entities = [...world.entities];
	world.notifyEntityStructureChanged();
}

function applyDefineTypeLocal(patch: DurableDefineTypePatch) {
	const events = patch.events && Object.keys(patch.events).length > 0 ? patch.events : undefined;
	registerType({
		name: patch.name,
		components: patch.components,
		defaults: patch.defaults,
		events,
		collection: patch.collection === true,
		collectionMeta: patch.collectionMeta
	});
	for (const entity of world.entities) {
		if (entity.type !== patch.name) continue;
		if (entity.raw.events) continue;
		entity.events = events ? structuredClone(events) : undefined;
		// Re-apply visual Player defaults to already-spawned avatars so peers
		// already in the room adopt a GM-changed mesh/anim without respawning.
		if (patch.name === 'Player') reapplyPlayerVisualDefaults(entity, patch.defaults);
	}
	if (patch.applyToEntityId) {
		const entity = world.getEntity(patch.applyToEntityId);
		if (entity) entity.type = patch.name;
	}
	world.notifyTypeSchemaChanged();
}

/**
 * Mirror world.#syncPlayerVisualDefault on the receiving side: when a Player
 * type redefinition arrives, fold the new SkinnedMesh / Mesh3DAnimator defaults
 * into live player entities so each peer's own avatar swaps model + animation.
 */
function reapplyPlayerVisualDefaults(
	entity: Entity,
	defaults: DurableDefineTypePatch['defaults']
): void {
	if (!defaults) return;
	for (const component of ['SkinnedMesh', 'Mesh3DAnimator'] as const) {
		const next = defaults[component];
		if (!next) continue;
		const bag = entity.components[component];
		if (!bag) continue;
		for (const [field, value] of Object.entries(next)) {
			bag[field] = value;
		}
		if (component === 'SkinnedMesh' && ('mesh' in next || 'anchor' in next)) {
			renderBounds.clear(entity.id);
		}
		if (component === 'Mesh3DAnimator' && ('catalog' in next || 'locomotion' in next)) {
			warmLocomotionPack(entity);
		}
	}
}

function applyDefineComponentLocal(patch: DurableDefineComponentPatch) {
	// Replace (not merge): the patch carries the full authoritative field set, so
	// field removals/edits propagate to peers.
	setComponentSchema(patch.name, patch.fields);
	world.notifyComponentSchemaChanged();
}
