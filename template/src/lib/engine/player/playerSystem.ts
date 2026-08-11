/**
 * Moves owned player entities from keyboard input. Only the local owner integrates
 * its own player; remote players arrive via network patches. Ensures the Player
 * component is registered by importing spawnPlayer for its side effects.
 */
import './spawnPlayer';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';
import { groundStore } from '$lib/engine/player/groundStore.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { input, PLAYER_SPEED_BASELINE } from './input';
import {
	conformMovement,
	inhibitMovement,
	integrateAirVelocity,
	integrateGroundVelocity
} from './playerMovementUtils';
import { clipHorizontalVelocity, resolveHorizontalPlayerMove } from './playerCollision';
import { applyLocomotionClip } from './playerLocomotionClips';

/** Latest ground normal from GroundSensor — used by slope movement. */
export let lastGroundNormal: [number, number, number] = [0, 1, 0];

let velocityX = 0;
let velocityZ = 0;

type PlayerMotorData = {
	speed?: number;
	minSlope?: number;
	maxSlope?: number;
	groundAcc?: number;
	airAcc?: number;
	airDrag?: number;
	velocityClipThreshold?: number;
};

function numberOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Y-axis yaw quaternion (skinned mannequin +Z = forward). */
function quatFromYaw(yaw: number): [number, number, number, number] {
	const half = yaw * 0.5;
	return [0, Math.sin(half), 0, Math.cos(half)];
}

function yawFromQuat(rot: [number, number, number, number] | undefined): number {
	if (!rot) return 0;
	const [, y, , w] = rot;
	return Math.atan2(2 * (w * y), 1 - 2 * y * y);
}

function shortestAngleDelta(from: number, to: number): number {
	let d = to - from;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return d;
}

/** ~4° — ignore tiny stick-noise yaw changes (gamepad thrash). */
const YAW_DEADBAND = (4 * Math.PI) / 180;

/** rad/s — body yaw blends toward move facing instead of snapping. */
const YAW_TURN_RATE = 10;

function stepYaw(current: number, target: number, dt: number): number {
	const delta = shortestAngleDelta(current, target);
	if (Math.abs(delta) < 1e-5) return target;
	const maxStep = YAW_TURN_RATE * dt;
	if (Math.abs(delta) <= maxStep) return target;
	return current + Math.sign(delta) * maxStep;
}

export function resetPlayerMovementState(): void {
	velocityX = 0;
	velocityZ = 0;
}

/** Test probe — horizontal motor velocity (owner-local). */
export function peekHorizontalVelocity(): [number, number] {
	return [velocityX, velocityZ];
}

/** Test probe — set horizontal motor velocity (e2e). */
export function setHorizontalVelocity(vx: number, vz: number): void {
	velocityX = vx;
	velocityZ = vz;
}

function findNearestRemotePlayer(
	localPos: [number, number, number],
	localId: string,
	maxRadius = 4.0
): { position: [number, number, number]; id: string } | null {
	let nearest: { position: [number, number, number]; id: string } | null = null;
	let nearestDist = Infinity;

	for (const entity of world.query('Player')) {
		if (entity.id === localId) continue;
		const pos = entity.components.Transform?.position as [number, number, number] | undefined;
		if (!pos) continue;

		const dx = pos[0] - localPos[0];
		const dz = pos[2] - localPos[2];
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist <= maxRadius && dist < nearestDist) {
			nearestDist = dist;
			nearest = { position: pos, id: entity.id };
		}
	}
	return nearest;
}

export function playerSystem(ctx: TickContext) {
	for (const entity of world.query('Player')) {
		if (!world.isOwner(entity.id)) continue;
		const player = entity.components.Player as PlayerMotorData;
		const transform = entity.components.Transform as
			| {
				position: [number, number, number];
				rotation?: [number, number, number, number];
			}
			| undefined;
		if (!transform) continue;

		const groundNormal = groundStore.normal;
		lastGroundNormal = groundNormal;

		const jump = entity.components.Jump as { vy?: number } | undefined;
		const jumpVy = jump?.vy ?? 0;
		const motorGrounded = groundStore.grounded && jumpVy <= 0.01;

		const move = input.movement();
		applyLocomotionClip(entity, move.tier);
		const speedScale = (player.speed ?? PLAYER_SPEED_BASELINE) / PLAYER_SPEED_BASELINE;
		const maxSpeed = move.magnitude > 0.01 ? move.speed * speedScale : 0;

		const profile = worldProfile.profile;
		const is2dXy = profile.dimensions === '2d' && profile.plane === 'xy';

		let wishX = 0;
		let wishZ = 0;
		if (move.magnitude > 0.01) {
			if (is2dXy) {
				wishX = move.x;
				wishZ = 0;
			} else {
				wishX = move.x;
				wishZ = move.z;
			}
		}

		let wishDir: [number, number, number] = [wishX, 0, wishZ];
		const wishMag = Math.hypot(wishDir[0], wishDir[2]);

		if (!is2dXy && motorGrounded && wishMag > 0.01) {
			const minSlope = numberOr(player.minSlope, 30);
			const maxSlope = numberOr(player.maxSlope, 60);
			wishDir = inhibitMovement(wishDir, groundNormal, minSlope, maxSlope);
			wishDir = conformMovement(wishDir, groundNormal);
			wishX = wishDir[0];
			wishZ = wishDir[2];
		}

		const groundAcc = numberOr(player.groundAcc, 7);
		const airAcc = numberOr(player.airAcc, 2);
		const airDrag = numberOr(player.airDrag, 1);

		if (motorGrounded) {
			const targetVx = wishMag > 0.01 ? wishX * maxSpeed : 0;
			const targetVz = wishMag > 0.01 ? wishZ * maxSpeed : 0;
			[velocityX, velocityZ] = integrateGroundVelocity(
				velocityX,
				velocityZ,
				targetVx,
				targetVz,
				groundAcc,
				ctx.dt
			);
		} else {
			[velocityX, velocityZ] = integrateAirVelocity(
				velocityX,
				velocityZ,
				wishMag > 0.01 ? wishX : 0,
				wishMag > 0.01 ? wishZ : 0,
				move.magnitude,
				maxSpeed > 0 ? maxSpeed : move.speed * speedScale,
				airAcc,
				airDrag,
				ctx.dt
			);
		}

		if (is2dXy) velocityZ = 0;

		// 3D: one displacement resolve per frame. 2D: legacy velocity clip (no resolve pass).
		if (is2dXy) {
			const clipThreshold = numberOr(player.velocityClipThreshold, 0.1);
			[velocityX] = clipHorizontalVelocity(entity, velocityX, 0, ctx.dt, clipThreshold);
		}

		if (motorGrounded && Math.hypot(velocityX, velocityZ) < 0.01) {
			velocityX = 0;
			velocityZ = 0;
		}

		const dx = velocityX * ctx.dt;
		const dz = velocityZ * ctx.dt;

		if (is2dXy) {
			transform.position = [transform.position[0] + dx, transform.position[1], transform.position[2]];
			const faceX = wishMag > 0.01 ? wishX : velocityX;
			const targetYaw = faceX > 0 ? Math.PI / 2 : faceX < 0 ? -Math.PI / 2 : yawFromQuat(transform.rotation);
			if (Math.abs(faceX) > 0.01) {
				const currentYaw = yawFromQuat(transform.rotation);
				const nextYaw =
					move.source === 'keyboard'
						? stepYaw(currentYaw, targetYaw, ctx.dt)
						: targetYaw;
				transform.rotation = quatFromYaw(nextYaw);
			}
			continue;
		}

		const [resolvedDx, resolvedDz] = resolveHorizontalPlayerMove(entity, dx, dz);
		transform.position = [
			transform.position[0] + resolvedDx,
			transform.position[1],
			transform.position[2] + resolvedDz
		];

		const faceX = wishMag > 0.01 ? wishX : velocityX;
		const faceZ = wishMag > 0.01 ? wishZ : velocityZ;
		let targetYaw = Math.hypot(faceX, faceZ) > 0.01 ? Math.atan2(faceX, faceZ) : null;

		// Chatting auto-turn: turn toward nearest remote player while chatting
		const isChatting = ui.shellMode === 'play' && roomChat.open;
		if (isChatting && (!targetYaw || wishMag <= 0.01)) {
			const nearestRemote = findNearestRemotePlayer(transform.position, entity.id);
			if (nearestRemote) {
				const dx = nearestRemote.position[0] - transform.position[0];
				const dz = nearestRemote.position[2] - transform.position[2];
				if (Math.hypot(dx, dz) > 0.01) {
					targetYaw = Math.atan2(dx, dz);
				}
			}
		}

		if (targetYaw !== null) {
			const currentYaw = yawFromQuat(transform.rotation);
			const delta = shortestAngleDelta(currentYaw, targetYaw);
			if (Math.abs(delta) >= YAW_DEADBAND || move.source === 'keyboard' || isChatting) {
				const nextYaw =
					move.source === 'keyboard' || isChatting
						? stepYaw(currentYaw, targetYaw, ctx.dt)
						: targetYaw;
				transform.rotation = quatFromYaw(nextYaw);
			}
		}
	}
}
