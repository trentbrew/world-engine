export type RapierColliderShape = 'cuboid' | 'ball' | 'capsule';

export type ResolvedCollider =
	| { shape: 'cuboid'; args: [number, number, number] }
	| { shape: 'ball'; args: [number] }
	| { shape: 'capsule'; args: [number, number] };

type Vec3 = [number, number, number];

/**
 * Resolve a Rapier collider shape + args for an entity, baking in the entity's
 * `Transform.scale`. The collider lives on the (unscaled) RigidBody group, so
 * scale must be applied to the args here to match the visually-scaled mesh.
 *
 * Args mirror the unscaled primitive geometry authored in MeshView:
 *   box     → BoxGeometry [1,1,1]      → half-extents 0.5 each
 *   sphere  → SphereGeometry r=0.5     → radius 0.5
 *   capsule → CapsuleGeometry r=0.32, length=0.5 → halfHeight 0.25, radius 0.32
 */
export function resolveCollider(
	mesh: string | undefined,
	colliderPref: string,
	scale: Vec3 = [1, 1, 1],
	capsuleFit?: { halfHeight: number; radius: number }
): ResolvedCollider {
	const [sx, sy, sz] = scale;

	if (colliderPref === 'ball' || mesh === 'primitive:sphere') {
		// Rapier ball is a single radius — a non-uniformly scaled sphere is an
		// ellipsoid it can't represent, so enclose the visual with the largest axis.
		return { shape: 'ball', args: [0.5 * Math.max(sx, sy, sz)] };
	}
	if (colliderPref === 'capsule' || mesh === 'primitive:capsule') {
		const half = capsuleFit?.halfHeight ?? 0.25;
		const rad = capsuleFit?.radius ?? 0.32;
		// Y-aligned capsule: half-height follows Y; radius follows the larger of X/Z
		// when using defaults; fitted dims already encode mesh AABB.
		if (capsuleFit) {
			return { shape: 'capsule', args: [half * sy, rad * Math.max(sx, sz)] };
		}
		return { shape: 'capsule', args: [0.25 * sy, 0.32 * Math.max(sx, sz)] };
	}
	// box (and hull/trimesh fallback until mesh geometry is wired) → scaled cuboid.
	return { shape: 'cuboid', args: [0.5 * sx, 0.5 * sy, 0.5 * sz] };
}
