export type GroundState = {
	grounded: boolean;
	normal: [number, number, number];
	/** World-space Y of the ground surface under the foot probe. */
	height: number;
	/** Rapier rigid-body handle of the supporting platform, if any. */
	platformRigidBodyHandle: number | null;
	/** Supporting platform linear velocity sampled by GroundSensor. */
	platformVelocity: [number, number, number];
};

export const groundStore = $state<GroundState>({
	grounded: false,
	normal: [0, 1, 0],
	height: 0,
	platformRigidBodyHandle: null,
	platformVelocity: [0, 0, 0]
});

/** Call on play exit / local player despawn. */
export function resetGroundStore(): void {
	groundStore.grounded = false;
	groundStore.normal = [0, 1, 0];
	groundStore.height = 0;
	groundStore.platformRigidBodyHandle = null;
	groundStore.platformVelocity = [0, 0, 0];
}
