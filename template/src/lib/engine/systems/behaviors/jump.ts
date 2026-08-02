/**
 * Jump behavior — vertical impulse + gravity for owned player avatars.
 * Space / south face button. Optional sfx refs on the Jump component bag.
 */
import { registerComponent } from '$lib/engine/ontology/registry';
import { resolveCollider } from '$lib/engine/physics/colliderShape';
import { world } from '$lib/engine/runtime/world.svelte';
import { playSfx } from '$lib/engine/audio/sfx';
import { input } from '$lib/engine/player/input';
import {
	applyJumpAnimClip,
	peekJumpAnimDebug,
	resetPlayerAnimClipState
} from '$lib/engine/player/playerLocomotionClips';
import {
	capsuleFitFor,
	rememberPlayerCapsuleFit,
	VERTICAL_GROUND_SKIN
} from '$lib/engine/player/playerCapsuleFit';
import { clipUpwardStepDeltaForEntity } from '$lib/engine/player/playerCollision';
import { groundStore, resetGroundStore } from '$lib/engine/player/groundStore.svelte';
import { resetMovementJank, sampleMovementJank } from '$lib/engine/player/movementJank.svelte';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import type { TickContext } from '$lib/engine/ontology/schema';

type JumpData = {
	height: number;
	/** Input buffer (ms) — press slightly before landing still jumps. */
	delay: number;
	/** Wind-up (ms) before ground jump impulse — Jump_Start plays during this window. */
	jumpDelay: number;
	cooldown: number;
	coyoteMs?: number;
	g: number;
	vy: number;
	/** Extra jumps allowed while airborne (1 = double jump). */
	airJumps: number;
	useJumpCurve?: boolean;
	jumpTime?: number;
	jumpCurveForce?: number;
	jumpCurve?: unknown;
	sfxJump?: string;
};

registerComponent({
	name: 'Jump',
	fields: {
		height: { t: 'number', default: 2 },
		/** Input buffer (ms) — press slightly before landing still jumps. */
		delay: { t: 'number', default: 120 },
		/** Wind-up (ms) before ground jump impulse — Jump_Start plays during this window. */
		jumpDelay: { t: 'number', default: 0 },
		cooldown: { t: 'number', default: 280 },
		coyoteMs: { t: 'number', default: 100 },
		g: { t: 'number', default: 9.8 },
		vy: { t: 'number', sync: 'realtime', default: 0 },
		airJumps: { t: 'number', default: 1 },
		useJumpCurve: { t: 'boolean', default: false },
		jumpTime: { t: 'number', default: 500 },
		jumpCurveForce: { t: 'number', default: 1 },
		jumpCurve: {
			t: 'json',
			default: [
				[0, 0],
				[0.35, 1],
				[1, 0]
			]
		},
		sfxJump: { t: 'ref' }
	}
});

const GROUND_Y_EPSILON = 0.015;
/** Keep per-frame settle under default visualsOffsetThreshold (0.1) at 60fps. */
const MAX_GROUND_Y_CORRECTION_SPEED = 5.5;
/** Continuous ungrounded time before treating the fall as void → play reset. */
const DEFAULT_FALL_RESET_MS = 5000;

let jumpBufferMs = 0;
let pendingGroundJumpMs = 0;
let cooldownMs = 0;
let coyoteRemainingMs = 0;
let jumpHoldMs = 0;
let holdJumpActive = false;
let airJumpsRemaining = 0;
/** Accumulated ms while not grounded (void-fall timer). */
let fallMs = 0;
/** False after requesting a fall reset until we land / play resets. */
let fallResetArmed = true;
let fallResetRequested = false;
let fallResetMs = DEFAULT_FALL_RESET_MS;

function impulseVelocity(height: number, g: number): number {
	return Math.sqrt(Math.max(0, 2 * g * height));
}

function numberOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function curveSample(curve: unknown, t: number): number {
	const points = Array.isArray(curve)
		? curve
			.map((point): [number, number] | null => {
				if (!Array.isArray(point) || point.length < 2) return null;
				const x = Number(point[0]);
				const y = Number(point[1]);
				if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
				return [Math.min(1, Math.max(0, x)), y];
			})
			.filter((point): point is [number, number] => point !== null)
			.sort((a, b) => a[0] - b[0])
		: [];

	if (points.length === 0) return 0;
	const clamped = Math.min(1, Math.max(0, t));
	if (clamped <= points[0][0]) return points[0][1];

	for (let i = 1; i < points.length; i += 1) {
		const [x1, y1] = points[i];
		if (clamped > x1) continue;
		const [x0, y0] = points[i - 1];
		const span = x1 - x0;
		if (span <= 0) return y1;
		const local = (clamped - x0) / span;
		return y0 + (y1 - y0) * local;
	}

	return points[points.length - 1][1];
}

function capsuleCenterYFromGround(entity: NonNullable<ReturnType<typeof world.getEntity>>): number {
	const render = entity.components.Render as { mesh?: string } | undefined;
	const physics = entity.components.Physics as { collider?: string } | undefined;
	const scale =
		(entity.components.Transform as { scale?: [number, number, number] } | undefined)?.scale ??
		[1, 1, 1];
	const fit =
		'Player' in entity.components && 'SkinnedMesh' in entity.components
			? rememberPlayerCapsuleFit(entity, renderBounds.get(entity.id)) ?? capsuleFitFor(entity.id)
			: undefined;
	const collider = resolveCollider(render?.mesh, physics?.collider ?? 'capsule', scale, fit);
	const [halfHeight, radius] = collider.shape === 'capsule' ? collider.args : [0.25, 0.32];
	return groundStore.height + halfHeight + radius + VERTICAL_GROUND_SKIN;
}

export function jumpSystem(ctx: TickContext) {
	const playerId = world.localPlayerId;
	if (!playerId || !world.isOwner(playerId)) return;

	const entity = world.getEntity(playerId);
	if (!entity || !('Jump' in entity.components)) return;

	const jump = entity.components.Jump as JumpData;
	const transform = entity.components.Transform as { position: [number, number, number] } | undefined;
	if (!transform) return;

	const dtMs = ctx.dt * 1000;
	if (cooldownMs > 0) cooldownMs = Math.max(0, cooldownMs - dtMs);

	const pressedJump = input.jumpPressed();
	if (pressedJump) jumpBufferMs = Math.max(numberOr(jump.delay, 120), dtMs);

	const coyoteMs = numberOr(jump.coyoteMs, 100);
	const jumpDelay = numberOr(jump.jumpDelay, 0);
	const jumpTime = numberOr(jump.jumpTime, 500);
	const jumpCurveForce = numberOr(jump.jumpCurveForce, 1);
	const grounded = groundStore.grounded && jump.vy <= 0.01;
	if (grounded) {
		airJumpsRemaining = jump.airJumps;
		coyoteRemainingMs = coyoteMs;
		fallMs = 0;
		fallResetArmed = true;
	} else {
		fallMs += dtMs;
		if (fallResetArmed && fallMs >= fallResetMs) {
			fallResetArmed = false;
			fallResetRequested = true;
		}
		if (coyoteRemainingMs > 0) {
			coyoteRemainingMs = Math.max(0, coyoteRemainingMs - dtMs);
		}
	}

	const canGroundJump = grounded || coyoteRemainingMs > 0;
	if (pendingGroundJumpMs > 0 && !canGroundJump) pendingGroundJumpMs = 0;
	const canJump = cooldownMs <= 0 && (canGroundJump || airJumpsRemaining > 0);
	let tookOff = false;
	let airJump = false;

	if (jumpBufferMs > 0) jumpBufferMs = Math.max(0, jumpBufferMs - dtMs);

	const jumpArmed = pressedJump || jumpBufferMs > 0 || pendingGroundJumpMs > 0;

	if (jumpArmed && canJump) {
		const groundJump = canGroundJump;
		if (groundJump && jumpDelay > 0) {
			if (pendingGroundJumpMs <= 0) pendingGroundJumpMs = jumpDelay;
			pendingGroundJumpMs = Math.max(0, pendingGroundJumpMs - dtMs);
			if (pendingGroundJumpMs <= 0) {
				jump.vy = impulseVelocity(jump.height, jump.g);
				cooldownMs = jump.cooldown;
				coyoteRemainingMs = 0;
				jumpBufferMs = 0;
				pendingGroundJumpMs = 0;
				jumpHoldMs = 0;
				holdJumpActive = jump.useJumpCurve === true && jumpTime > 0;
				tookOff = true;
				airJump = false;
				playSfx(jump.sfxJump);
			}
		} else {
			airJump = !groundJump;
			if (!groundJump) airJumpsRemaining = Math.max(0, airJumpsRemaining - 1);
			jump.vy = impulseVelocity(jump.height, jump.g);
			cooldownMs = jump.cooldown;
			coyoteRemainingMs = 0;
			jumpBufferMs = 0;
			pendingGroundJumpMs = 0;
			jumpHoldMs = 0;
			holdJumpActive = jump.useJumpCurve === true && jumpTime > 0;
			tookOff = true;
			playSfx(jump.sfxJump);
		}
	}

	if (holdJumpActive) {
		if (!input.jumpHeld() || jumpHoldMs >= jumpTime) {
			holdJumpActive = false;
			jumpHoldMs = 0;
		} else {
			jump.vy += curveSample(jump.jumpCurve, jumpHoldMs / jumpTime) * jumpCurveForce * ctx.dt;
			jumpHoldMs += dtMs;
			if (jumpHoldMs >= jumpTime) {
				holdJumpActive = false;
				jumpHoldMs = 0;
			}
		}
	}

	let vy = jump.vy;
	let y = transform.position[1];
	const restCenterY = grounded ? capsuleCenterYFromGround(entity) : y;

	if (grounded && jump.vy <= 0.01) {
		// Settled on ground: snap toward rest without a gravity dip first.
		// The old path applied g*dt then corrected — that alone bobbed ~2.7mm/frame.
		const deltaToRest = restCenterY - y;
		const maxCorrection = MAX_GROUND_Y_CORRECTION_SPEED * ctx.dt;
		if (Math.abs(deltaToRest) <= GROUND_Y_EPSILON) {
			y = restCenterY;
		} else {
			let delta = deltaToRest;
			if (delta > 0) delta = clipUpwardStepDeltaForEntity(entity, delta);
			if (Math.abs(delta) > GROUND_Y_EPSILON) {
				y += Math.sign(delta) * Math.min(Math.abs(delta), maxCorrection);
			}
		}
		vy = 0;
	} else {
		vy = jump.vy - jump.g * ctx.dt;
		y = y + vy * ctx.dt;
		if (grounded) {
			y = Math.max(y, restCenterY);
		}
	}

	jump.vy = vy;
	transform.position = [transform.position[0], y, transform.position[2]];

	applyJumpAnimClip(entity, {
		grounded,
		tookOff,
		airJump,
		dtMs,
		jumpStartMs: jumpDelay > 0 ? jumpDelay : undefined,
		anticipatory: pressedJump || jumpBufferMs > 0 || pendingGroundJumpMs > 0
	});

	const anim = peekJumpAnimDebug();
	sampleMovementJank({
		grounded,
		height: groundStore.height,
		bodyY: y,
		restY: grounded ? restCenterY : y,
		vy,
		landHoldMs: anim.landHoldMs,
		airMs: anim.airMs,
		dtMs
	});
}

/**
 * True once when continuous fall exceeds the void threshold.
 * UI should call `ui.resetPlay()` and this clears the latch.
 */
export function consumeFallResetRequest(): boolean {
	if (!fallResetRequested) return false;
	fallResetRequested = false;
	return true;
}

/** Test hook — shorten/lengthen void-fall reset threshold (ms). */
export function __testSetFallResetMs(ms: number): void {
	fallResetMs = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_FALL_RESET_MS;
}

/** Reset jump input state when leaving play mode. */
export function resetJumpInputState(): void {
	jumpBufferMs = 0;
	pendingGroundJumpMs = 0;
	cooldownMs = 0;
	coyoteRemainingMs = 0;
	jumpHoldMs = 0;
	holdJumpActive = false;
	airJumpsRemaining = 0;
	fallMs = 0;
	fallResetArmed = true;
	fallResetRequested = false;
	fallResetMs = DEFAULT_FALL_RESET_MS;
	resetPlayerAnimClipState();
	resetGroundStore();
	resetMovementJank();
}
