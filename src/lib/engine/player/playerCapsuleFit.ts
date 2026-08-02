/**
 * Fit an upright analytic capsule to a SkinnedMesh AABB.
 * Motor / GroundSensor keep a capsule — sizing follows the model, not a fixed pill.
 */
import type { MeshBounds } from '$lib/engine/render/meshAnchor';
import type { Entity } from '$lib/engine/ontology/schema';

export type FittedCapsule = { halfHeight: number; radius: number };

export const DEFAULT_CAPSULE: FittedCapsule = { halfHeight: 0.25, radius: 0.32 };

/**
 * Keep capsule bottom slightly above the reported ground plane so foot casts
 * don't start in overlap (walk/run grounded flicker).
 */
export const VERTICAL_GROUND_SKIN = 0.03;

export type CapsuleFitScales = {
	radiusScale?: number;
	heightScale?: number;
};

const fitByEntity = new Map<string, FittedCapsule>();

/** Capsule center Y when resting on a floor slab top. */
export function capsuleRestCenterY(
	fit: FittedCapsule = DEFAULT_CAPSULE,
	floorTopY = 0.05,
	skin = VERTICAL_GROUND_SKIN
): number {
	return floorTopY + fit.radius + fit.halfHeight + skin;
}

/** Map mesh AABB → Rapier capsule halfHeight + radius (local, unscaled). */
export function capsuleFromBounds(
	bounds: MeshBounds | undefined,
	scales: CapsuleFitScales = {}
): FittedCapsule {
	if (!bounds) return DEFAULT_CAPSULE;
	const [sx, sy, sz] = bounds.size;
	if (!(sx > 0) || !(sy > 0) || !(sz > 0)) return DEFAULT_CAPSULE;
	const radiusScale = scales.radiusScale ?? 1;
	const heightScale = scales.heightScale ?? 1;
	const radius = Math.max(0.08, 0.5 * Math.max(sx, sz) * 0.45 * radiusScale);
	const halfHeight = Math.max(0.05, (0.5 * sy - radius) * heightScale);
	return { halfHeight, radius };
}

/** Representative mannequin AABB (+ meshAnchor padding) until SkinnedMesh bounds load. */
export const MANNEQUIN_BOUNDS: MeshBounds = {
	size: [0.75, 1.95, 0.55],
	center: [0, 0.975, 0]
};

/** Default Player spawn capsule — matches fitted mannequin, not the legacy pill. */
export const MANNEQUIN_CAPSULE_FIT = capsuleFromBounds(MANNEQUIN_BOUNDS);

export function rememberCapsuleFit(
	entityId: string,
	bounds: MeshBounds | undefined,
	scales: CapsuleFitScales = {}
): FittedCapsule {
	const fit = capsuleFromBounds(bounds, scales);
	fitByEntity.set(entityId, fit);
	return fit;
}

export function skinnedCapsuleScales(entity: Entity): CapsuleFitScales {
	const skin = entity.components.SkinnedMesh as
		| { capsuleRadiusScale?: number; capsuleHeightScale?: number }
		| undefined;
	return {
		radiusScale: skin?.capsuleRadiusScale,
		heightScale: skin?.capsuleHeightScale
	};
}

export function rememberPlayerCapsuleFit(
	entity: Entity,
	bounds: MeshBounds | undefined
): FittedCapsule {
	return rememberCapsuleFit(entity.id, bounds, skinnedCapsuleScales(entity));
}

export function forgetCapsuleFit(entityId: string): void {
	fitByEntity.delete(entityId);
}

export function capsuleFitFor(entityId: string): FittedCapsule | undefined {
	return fitByEntity.get(entityId);
}

/** Test helper. */
export function clearCapsuleFits(): void {
	fitByEntity.clear();
}
