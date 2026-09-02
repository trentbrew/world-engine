/**
 * Moves owned player entities from keyboard input. Only the local owner integrates
 * its own player; remote players arrive via network patches. Ensures the Player
 * component is registered by importing spawnPlayer for its side effects.
 */
import './spawnPlayer';
import { isBotClientId } from '$lib/engine/agent/botPlayer';
import { roomChat } from '$lib/engine/collab/roomChat.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';
import { groundStore } from '$lib/engine/player/groundStore.svelte';
import { playerInteractPrompt } from '$lib/engine/room/playerInteractPrompt.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { input, PLAYER_SPEED_BASELINE } from './input';
import {
	conformMovement,
	inhibitMovement,
	integrateAirVelocity,
	integrateGroundVelocity
} from './playerMovementUtils';
import { clipHorizontalVelocity, resolveHorizontalPlayerMove } from './playerCollision';
import { applyChatSocialClip, applyLocomotionClip } from './playerLocomotionClips';
import { playerClientId } from './access';

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
/** rad/s — snap back toward conversation partner after releasing movement keys. */
const CHAT_YAW_TURN_RATE = 25;

function stepYaw(
	current: number,
	target: number,
	dt: number,
	rate = YAW_TURN_RATE
): number {
	const delta = shortestAngleDelta(current, target);
	if (Math.abs(delta) < 1e-5) return target;
	const maxStep = rate * dt;
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

/** Conversation partner to face while chatting — within this of the player. */
const CHAT_FACING_RADIUS = 6;

function playerPosition(entityId: string): [number, number, number] | undefined {
	const entity = world.getEntity(entityId);
	return entity?.components.Transform?.position as [number, number, number] | undefined;
}

/**
 * Who to look at during a conversation: the peer playerInteract is tracking
 * (the one the chat panel follows), else the closest player in earshot.
 */
function chatPartnerPosition(
	localId: string,
	localPos: [number, number, number]
): [number, number, number] | null {
	const tracked = playerInteractPrompt.prompt?.entityId;
	if (tracked && tracked !== localId) {
		const pos = playerPosition(tracked);
		if (pos) return pos;
	}

	let nearest: [number, number, number] | null = null;
	let nearestDist = CHAT_FACING_RADIUS;
	for (const entity of world.query('Player')) {
		if (entity.id === localId) continue;
		const pos = entity.components.Transform?.position as [number, number, number] | undefined;
		if (!pos) continue;
		const dist = Math.hypot(pos[0] - localPos[0], pos[2] - localPos[2]);
		if (dist < nearestDist) {
			nearestDist = dist;
			nearest = pos;
		}
	}
	return nearest;
}

export function playerSystem(ctx: TickContext) {
	for (const entity of world.query('Player')) {
		if (!world.isOwner(entity.id)) continue;
		const clientId = playerClientId(entity);
		if (clientId && isBotClientId(clientId)) continue;
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
		// Talking is an idle pose — walking or jumping out of a conversation hands
		// the clip back to locomotion (which no-ops mid-air, keeping jump clips).
		const chatting = ui.shellMode === 'play' && roomChat.open;
		if (chatting && move.tier === 'idle' && motorGrounded) {
			applyChatSocialClip(entity, roomChat.isComposing(session.clientId));
		} else {
			applyLocomotionClip(entity, move.tier);
		}
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

		// Not actively moving during a conversation: face the peer even while coasting.
		// Movement input still wins when wishMag > 0.01.
		const chatFacing = chatting && wishMag <= 0.01;
		if (chatFacing) {
			const partner = chatPartnerPosition(entity.id, transform.position);
			if (partner) {
				const pdx = partner[0] - transform.position[0];
				const pdz = partner[2] - transform.position[2];
				if (Math.hypot(pdx, pdz) > 0.01) targetYaw = Math.atan2(pdx, pdz);
			}
		}

		if (targetYaw !== null) {
			const currentYaw = yawFromQuat(transform.rotation);
			const delta = shortestAngleDelta(currentYaw, targetYaw);
			const yawRate = chatFacing ? CHAT_YAW_TURN_RATE : YAW_TURN_RATE;
			if (Math.abs(delta) >= YAW_DEADBAND || move.source === 'keyboard' || chatting) {
				const nextYaw =
					move.source === 'keyboard' || chatting
						? stepYaw(currentYaw, targetYaw, ctx.dt, yawRate)
						: targetYaw;
				transform.rotation = quatFromYaw(nextYaw);
			}
		}
	}
}
