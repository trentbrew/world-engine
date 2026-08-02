import { cloneComponentBag, cloneComponentMap } from '$lib/engine/authoring/cloneComponentData';
import { durableComponentsOnly } from '$lib/engine/ontology/durableBag';
import type {
	DurableRemoveComponentPatch,
	DurableSetComponentPatch,
	DurableSetEntityPatch
} from '$lib/engine/ontology/durablePatch';
import type { Entity } from '$lib/engine/ontology/schema';
import { fieldTypeFor } from '$lib/engine/runtime/setField';

export function captureFieldValue(
	entity: Entity,
	component: string,
	field: string
): unknown {
	const bag = entity.components[component];
	if (!bag) return undefined;
	const value = bag[field];
	const type = fieldTypeFor(component, field);
	if (type === 'vec3' && Array.isArray(value)) return [...value];
	if (type === 'vec2' && Array.isArray(value)) return [...value];
	if (type === 'quat' && Array.isArray(value)) return [...value];
	return value;
}

export function buildSetEntityPatch(entity: Entity, opts?: { full?: boolean }): DurableSetEntityPatch {
	const components = opts?.full
		? cloneComponentMap(entity.components)
		: durableComponentsOnly(entity.components);
	return {
		kind: 'setEntity',
		entityId: entity.id,
		...(entity.type !== undefined ? { conformsTo: entity.type } : {}),
		components
	};
}

export function buildRemoveComponentPatch(
	entityId: string,
	component: string
): DurableRemoveComponentPatch {
	return { kind: 'removeComponent', entityId, component };
}

export function buildSetComponentPatch(
	entity: Entity,
	component: string
): DurableSetComponentPatch {
	const bag = entity.components[component] ?? {};
	return {
		kind: 'setComponent',
		entityId: entity.id,
		component,
		bag: cloneComponentBag(bag)
	};
}
