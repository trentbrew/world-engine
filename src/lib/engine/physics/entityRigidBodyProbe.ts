/**
 * E2E / dev probe — entity id → Rapier RigidBody translation.
 * Registered from PhysicsBody when a body mounts.
 */
import type { RigidBody } from '@dimforge/rapier3d-compat';

const byEntity = new Map<string, RigidBody>();

export function registerEntityRigidBody(entityId: string, rb: RigidBody): void {
	byEntity.set(entityId, rb);
}

export function unregisterEntityRigidBody(entityId: string): void {
	byEntity.delete(entityId);
}

export function getEntityRigidBody(entityId: string): RigidBody | null {
	return byEntity.get(entityId) ?? null;
}

export function getEntityRigidBodyTranslation(entityId: string): [number, number, number] | null {
	const rb = byEntity.get(entityId);
	if (!rb) return null;
	const t = rb.translation();
	return [t.x, t.y, t.z];
}

/** Number of Rapier colliders attached to the entity's rigid body (0 = AutoColliders empty). */
export function getEntityRigidBodyColliderCount(entityId: string): number {
	const rb = byEntity.get(entityId);
	if (!rb) return -1;
	return rb.numColliders();
}

/** Test helper. */
export function clearEntityRigidBodyProbe(): void {
	byEntity.clear();
}
