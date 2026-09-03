import { registerComponent } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import { groundStore } from '$lib/engine/player/groundStore.svelte';
import { peekHorizontalVelocity } from '$lib/engine/player/playerSystem';
import { resolveSurfaceUnderFoot } from '$lib/engine/player/surface';
import { playSfx } from '$lib/engine/audio/sfx';
import type { TickContext } from '$lib/engine/ontology/schema';

type FootstepSide = 'left' | 'right';

registerComponent({
	name: 'Footstep',
	fields: {
		stepLength: { t: 'number', default: 0.9 },
		stepCadenceMul: { t: 'number', default: 1 },
		landSfx: { t: 'ref', default: '' }
	}
});

let footstepAccumulator = 0;
let footstepSide: FootstepSide = 'left';
let lastGrounded = false; // module-level latch for landing detection

function oppositeSide(side: FootstepSide): FootstepSide {
	return side === 'left' ? 'right' : 'left';
}

export function footstepsSystem(ctx: TickContext): void {
	if (!world.localPlayerId || !world.isOwner(world.localPlayerId)) return;

	const playerId = world.localPlayerId;
	const entity = world.getEntity(playerId);
	if (!entity) return;

	const jump = entity.components.Jump as { vy?: number } | undefined;
	const grounded = groundStore.grounded && (jump?.vy ?? 0) <= 0.01;

	// --- Landing step: ungrounded → grounded transition ---
	const justLanded = !lastGrounded && grounded;
	if (justLanded) {
		const surface = resolveSurfaceUnderFoot(groundStore);
		// Component bags are untyped at rest — coerce before handing to playSfx.
		const sfxRef = surface.sfxBase ?? String(entity.components.Footstep?.landSfx ?? '');
		if (sfxRef) playSfx(sfxRef);
	}
	lastGrounded = grounded;

	if (!grounded) {
		footstepAccumulator = 0;
		return;
	}

	// --- Stride cadence while walking ---
	// peekHorizontalVelocity returns a [vx, vz] tuple, not a vector object.
	const [vx, vz] = peekHorizontalVelocity();
	const speed = Math.hypot(vx, vz);
	const IDLE_SPEED = 0.3;

	if (speed < IDLE_SPEED) return;

	// Accumulate distance this frame toward the next step. The floor is not
	// cosmetic: the drain loop below subtracts stepLength each pass, so a world
	// authoring stepLength 0 (or a negative multiplier) would spin forever and
	// hang the frame.
	const stepLength = Math.max(
		0.05,
		Number(entity.components.Footstep?.stepLength ?? 0.9) *
			Number(entity.components.Footstep?.stepCadenceMul ?? 1)
	);
	const distanceThisFrame = speed * ctx.dt;

	footstepAccumulator = footstepAccumulator + distanceThisFrame;

	while (footstepAccumulator >= stepLength) {
		footstepAccumulator = footstepAccumulator - stepLength;

		// Play footstep sound with surface-aware kind.
		// These refs map to prototype switch sounds; replace paths with BotW pack WAVs.
		const surface = resolveSurfaceUnderFoot(groundStore);
		const kind = surface.kind;
		let sfxRef: string | undefined;

		const kindToRef: Record<string, string> = {
			grass: '/audio/switch/News.wav',
			dirt: '/audio/switch/collide.wav',
			sand: '/audio/switch/scroll.wav',
			stone: '/audio/switch/collide.wav',
			wood: '/audio/switch/News.wav',
			metal: '/audio/switch/controllerConnect.wav',
			snow: '/audio/switch/tick.wav',
			water: '/audio/switch/collect.wav',
			default: '/audio/switch/News.wav'
		};

		sfxRef = kindToRef[kind] ?? '/audio/switch/News.wav';

		const vol = Math.min(1, Math.max(0, 0.8));
		playSfx(sfxRef, vol);
	}
}