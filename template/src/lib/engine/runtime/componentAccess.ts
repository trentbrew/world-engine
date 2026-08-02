import type { Entity } from '$lib/engine/ontology/schema';
import { isPlayerEntity } from '$lib/engine/player/access';

/** Components never offered in the add-component picker. */
const ADD_DENY = new Set(['EditorScene', 'Player']);

/** Components that require a companion — removal blocked when dependent exists. */
const REMOVE_REQUIRES: Record<string, string[]> = {
	Transform: ['Render', 'Ground', 'Marker', 'Physics']
};

export function listAddableComponents(entity: Entity, all: string[]): string[] {
	const present = new Set(Object.keys(entity.components));
	return all.filter((name) => {
		if (present.has(name)) return false;
		if (ADD_DENY.has(name)) return false;
		if (isPlayerEntity(entity) && name === 'Player') return false;
		return true;
	});
}

export function canRemoveComponent(entity: Entity, componentName: string): boolean {
	if (!entity.components[componentName]) return false;
	if (ADD_DENY.has(componentName)) return false;
	if (isPlayerEntity(entity) && componentName === 'Player') return false;

	const names = Object.keys(entity.components);
	if (names.length <= 1) return false;

	const dependents = REMOVE_REQUIRES[componentName];
	if (dependents?.some((dep) => dep in entity.components)) return false;

	return true;
}
