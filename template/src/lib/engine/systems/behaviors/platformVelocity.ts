import { groundStore } from '$lib/engine/player/groundStore.svelte';
import { peekHorizontalVelocity, setHorizontalVelocity } from '$lib/engine/player/playerSystem';
import {
	addPlatformVelocity,
	platformDisplacement,
	subtractPlatformVelocity,
	type PlatformVelocity
} from '$lib/engine/player/platformVelocityUtils';
import { world } from '$lib/engine/runtime/world.svelte';
import type { Entity, TickContext } from '$lib/engine/ontology/schema';
import { clipHorizontalVelocity } from '$lib/engine/player/playerCollision';

type PlayerPlatformData = {
	velocityClipThreshold?: number;
};

type TransformData = {
	position: [number, number, number];
};

let wasGrounded = false;
let lastPlatformHandle: number | null = null;
let lastPlatformVelocity: PlatformVelocity = [0, 0, 0];

function numberOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function resetPlatformVelocityState(): void {
	wasGrounded = false;
	lastPlatformHandle = null;
	lastPlatformVelocity = [0, 0, 0];
}

function localPlayer(): Entity | null {
	const playerId = world.localPlayerId;
	if (!playerId || !world.isOwner(playerId)) return null;
	const entity = world.getEntity(playerId);
	return entity && 'Player' in entity.components ? entity : null;
}

export function platformVelocitySystem(ctx: TickContext): void {
	const entity = localPlayer();
	if (!entity) {
		resetPlatformVelocityState();
		return;
	}

	const transform = entity.components.Transform as TransformData | undefined;
	if (!transform) {
		resetPlatformVelocityState();
		return;
	}

	const jump = entity.components.Jump as { vy?: number } | undefined;
	const player = entity.components.Player as PlayerPlatformData | undefined;
	const motorGrounded = groundStore.grounded && (jump?.vy ?? 0) <= 0.01;
	const platformHandle = groundStore.platformRigidBodyHandle;
	const platformVelocity = groundStore.platformVelocity;
	let motorVelocity = peekHorizontalVelocity();

	if (!wasGrounded && motorGrounded) {
		motorVelocity = subtractPlatformVelocity(motorVelocity, platformVelocity);
		setHorizontalVelocity(motorVelocity[0], motorVelocity[1]);
	}

	if (motorGrounded && platformHandle !== null) {
		const threshold = numberOr(player?.velocityClipThreshold, 0.1);
		const [clippedVx, clippedVz] = clipHorizontalVelocity(
			entity,
			platformVelocity[0],
			platformVelocity[2],
			ctx.dt,
			threshold
		);
		const [dx, dz] = platformDisplacement([clippedVx, 0, clippedVz], ctx.dt);
		if (dx !== 0 || dz !== 0) {
			const [x, y, z] = transform.position;
			transform.position = [x + dx, y, z + dz];
		}
	}

	if (wasGrounded && !motorGrounded && lastPlatformHandle !== null) {
		motorVelocity = addPlatformVelocity(motorVelocity, lastPlatformVelocity);
		setHorizontalVelocity(motorVelocity[0], motorVelocity[1]);
	}

	wasGrounded = motorGrounded;
	lastPlatformHandle = motorGrounded ? platformHandle : lastPlatformHandle;
	lastPlatformVelocity = motorGrounded ? platformVelocity : lastPlatformVelocity;
}
