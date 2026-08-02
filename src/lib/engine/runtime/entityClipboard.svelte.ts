import type { Entity } from '$lib/engine/ontology/schema';

let clipboard = $state<Entity | null>(null);

export function getEntityClipboard(): Entity | null {
	return clipboard;
}

export function hasEntityClipboard(): boolean {
	return clipboard !== null;
}

export function setEntityClipboard(entity: Entity) {
	clipboard = cloneEntity(entity);
}

export function clearEntityClipboard() {
	clipboard = null;
}

export function cloneEntity(entity: Entity): Entity {
	return {
		...entity,
		components: $state.snapshot(entity.components),
		raw: $state.snapshot(entity.raw),
		formulas: entity.formulas,
		children: entity.children ? [...entity.children] : undefined
	};
}
