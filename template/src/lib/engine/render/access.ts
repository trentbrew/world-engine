/** Typed accessors over the (coerced) component bag — keeps views cast-free. */
import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

/** Read a component's data, typed by the caller. */
export function comp<T = ComponentData>(entity: Entity, name: string): T | undefined {
	return entity.components[name] as T | undefined;
}

/** World position from the Transform component, defaulting to origin. */
export function position(entity: Entity): [number, number, number] {
	const t = entity.components.Transform as { position?: [number, number, number] } | undefined;
	return t?.position ?? [0, 0, 0];
}

/** Non-uniform scale from Transform (defaults to unit cube). */
export function scaleVec(entity: Entity): [number, number, number] {
	const t = entity.components.Transform as { scale?: [number, number, number] } | undefined;
	const s = t?.scale;
	if (Array.isArray(s) && s.length >= 3) {
		return [s[0], s[1], s[2]];
	}
	return [1, 1, 1];
}

/** World rotation quaternion from Transform (identity when unset). */
export function rotationQuat(entity: Entity): [number, number, number, number] {
	const t = entity.components.Transform as
		| { rotation?: [number, number, number, number] }
		| undefined;
	const r = t?.rotation;
	if (Array.isArray(r) && r.length >= 4) {
		return [r[0], r[1], r[2], r[3]];
	}
	return [0, 0, 0, 1];
}

/** Scene backdrop — pickable but not a useful peer-presence target. */
export function isGroundEntity(entity: Entity): boolean {
	return 'Ground' in entity.components;
}
