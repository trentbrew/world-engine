import type { Entity } from '$lib/engine/ontology/schema';

/** Player capsule-ish radius for overlap tests (v1 constant). */
export const PLAYER_COLLIDE_RADIUS = 0.4;

export type CollisionOverlapMode = 'circle_xz' | 'sphere';

export function collisionRadius(entity: Entity): number | null {
	const collectible = entity.components.Collectible as { radius?: number } | undefined;
	if (collectible?.radius != null) return Number(collectible.radius);
	const collision = entity.components.Collision as { radius?: number } | undefined;
	if (collision?.radius != null) return Number(collision.radius);
	return entity.events?.collision ? 0.5 : null;
}

/** Collectibles are 3D pickups; Collision uses authored mask (default: XZ trigger slab). */
export function collisionOverlapMode(entity: Entity): CollisionOverlapMode {
	if (entity.components.Collectible) return 'sphere';
	const collision = entity.components.Collision as { mask?: string } | undefined;
	return collision?.mask === 'sphere' ? 'sphere' : 'circle_xz';
}

export function xzOverlaps(
	aPos: [number, number, number],
	aRadius: number,
	bPos: [number, number, number],
	bRadius: number
): boolean {
	const dx = aPos[0] - bPos[0];
	const dz = aPos[2] - bPos[2];
	const reach = aRadius + bRadius;
	return dx * dx + dz * dz <= reach * reach;
}

export function sphereOverlaps(
	aPos: [number, number, number],
	aRadius: number,
	bPos: [number, number, number],
	bRadius: number
): boolean {
	const dx = aPos[0] - bPos[0];
	const dy = aPos[1] - bPos[1];
	const dz = aPos[2] - bPos[2];
	const reach = aRadius + bRadius;
	return dx * dx + dy * dy + dz * dz <= reach * reach;
}

/** Use 3D sphere when either party is a Collectible (or explicit sphere mask). */
export function entitiesOverlap(
	a: Entity,
	aPos: [number, number, number],
	aRadius: number,
	b: Entity,
	bPos: [number, number, number],
	bRadius: number
): boolean {
	const useSphere =
		collisionOverlapMode(a) === 'sphere' || collisionOverlapMode(b) === 'sphere';
	if (useSphere) return sphereOverlaps(aPos, aRadius, bPos, bRadius);
	return xzOverlaps(aPos, aRadius, bPos, bRadius);
}
