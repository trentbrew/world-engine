import type { Entity } from '$lib/engine/ontology/schema';
import type { WorldPlane } from '$lib/engine/world/worldProfile';
import { clampPositionToPlane } from '$lib/scene/playPlane';
import { isGroundEntity } from '$lib/engine/render/access';

/** Ground planes must stay on the play plane — never below the editor grid. */
export function clampGroundTransformPosition(
	plane: WorldPlane,
	pos: [number, number, number]
): [number, number, number] {
	return clampPositionToPlane(plane, pos);
}

export function shouldClampGroundPosition(
	entity: Entity | undefined,
	component: string,
	field: string
): boolean {
	return component === 'Transform' && field === 'position' && !!entity && isGroundEntity(entity);
}

/** Axis index locked for ground `Transform.position` (Y on XZ worlds, Z on XY). */
export function groundPositionLockedAxis(plane: WorldPlane): number {
	return plane === 'xy' ? 2 : 1;
}

/** Fix authored ground heights in-place (e.g. accidental Y = −5). Returns true if any changed. */
export function sanitizeGroundEntities(entities: Entity[], plane: WorldPlane): boolean {
	let changed = false;
	for (const entity of entities) {
		if (!isGroundEntity(entity)) continue;
		const transform = entity.components.Transform as
			| { position?: [number, number, number] }
			| undefined;
		if (!transform?.position) continue;
		const clamped = clampGroundTransformPosition(plane, [
			transform.position[0] ?? 0,
			transform.position[1] ?? 0,
			transform.position[2] ?? 0
		]);
		if (
			clamped[0] !== transform.position[0] ||
			clamped[1] !== transform.position[1] ||
			clamped[2] !== transform.position[2]
		) {
			transform.position = clamped;
			changed = true;
		}
	}
	return changed;
}
