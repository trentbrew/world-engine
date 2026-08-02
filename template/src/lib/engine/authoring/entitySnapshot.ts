import { cloneComponentMap } from '$lib/engine/authoring/cloneComponentData';
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

export type EntitySnapshot = {
	id: string;
	type?: string;
	components: Record<string, ComponentData>;
	formulas?: Entity['formulas'];
};

export function captureEntitySnapshot(entity: Entity): EntitySnapshot {
	return {
		id: entity.id,
		type: entity.type,
		components: cloneComponentMap(entity.components),
		formulas: entity.formulas
	};
}

export function entityFromSnapshot(snap: EntitySnapshot): Entity {
	return {
		id: snap.id,
		type: snap.type,
		components: cloneComponentMap(snap.components),
		formulas: snap.formulas,
		raw: {}
	};
}
