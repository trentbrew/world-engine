/**
 * Bind play-mode locomotion + jump phases to Mesh3DAnimator.clip for skinned players.
 * Clip ids come from the entity's Mesh3DAnimator.catalog `locomotion` map,
 * optionally overridden by Mesh3DAnimator.locomotion (type/entity Partial map).
 * Ground jumps use jump*; air / double jumps use doubleJump* (ninja suite by default).
 */
import {
	applyLocomotionOverride,
	getLocomotionBindings,
	M2M_HUMAN_LOCOMOTION,
	parseLocomotionOverride,
	type LocomotionBindingPack,
	type LocomotionBindings
} from '$lib/engine/animation/clipCatalog';
import type { Entity } from '$lib/engine/ontology/schema';
import type { LocomotionTier } from '$lib/engine/player/playInput';

/** Social loop while the room chat panel is open in play mode. */
export const CHAT_TALKING_CLIP = 'Idle_Talking_Loop';

/** Hold land clip briefly so it reads before locomotion resumes. */
const LAND_HOLD_MS = 280;
/** Play Jump_Start this long before settling into Jump_Loop while airborne. */
const JUMP_START_MS = 350;
/** Ignore sub-frame grounded flicker — don't treat as a real jump/land. */
const MIN_AIR_MS_FOR_LAND = 80;
/** Frames a new locomotion tier must persist before the clip upgrades/downgrades. */
const TIER_HOLD_FRAMES = 2;

const TIER_RANK: Record<LocomotionTier, number> = {
	idle: 0,
	walk: 1,
	jog: 2,
	run: 3,
	sprint: 4
};

const TIER_KEY: Record<LocomotionTier, keyof LocomotionBindings> = {
	idle: 'idle',
	walk: 'walk',
	jog: 'jog',
	run: 'run',
	sprint: 'sprint'
};

const FALLBACK_PACK: LocomotionBindingPack = {
	bindings: M2M_HUMAN_LOCOMOTION,
	clipLoop: (clipId) =>
		clipId !== M2M_HUMAN_LOCOMOTION.jumpStart &&
		clipId !== M2M_HUMAN_LOCOMOTION.jumpLand &&
		clipId !== M2M_HUMAN_LOCOMOTION.doubleJumpStart &&
		clipId !== M2M_HUMAN_LOCOMOTION.doubleJumpLand
};

/** Catalog-pure packs — never store type overrides here. */
const packByCatalog = new Map<string, LocomotionBindingPack>();
/** Per-entity packs after override merge. */
const packByEntity = new Map<string, LocomotionBindingPack>();

let landHoldMs = 0;
let jumpStartMs = 0;
let wasAirborne = false;
/** Accumulated air time while not grounded (resets on land). */
let airMs = 0;
/** True after an air / double jump until landing — selects doubleJump* clips. */
let airJumpActive = false;
let clipTier: LocomotionTier = 'idle';
let pendingTier: LocomotionTier | null = null;
let pendingFrames = 0;

function catalogRef(entity: Entity): string {
	const anim = entity.components.Mesh3DAnimator as { catalog?: string } | undefined;
	return anim?.catalog ?? 'catalog:mesh2motion-human';
}

function entityOverride(entity: Entity): Partial<LocomotionBindings> {
	const anim = entity.components.Mesh3DAnimator as { locomotion?: unknown } | undefined;
	return parseLocomotionOverride(anim?.locomotion);
}

function packWithOverride(
	base: LocomotionBindingPack,
	override: Partial<LocomotionBindings>
): LocomotionBindingPack {
	if (Object.keys(override).length === 0) return base;
	return {
		bindings: applyLocomotionOverride(base.bindings, override),
		clipLoop: base.clipLoop
	};
}

function locomotionPack(entity: Entity): LocomotionBindingPack {
	const cached = packByEntity.get(entity.id);
	if (cached) return cached;
	const ref = catalogRef(entity);
	const byRef = packByCatalog.get(ref);
	if (byRef) {
		const merged = packWithOverride(byRef, entityOverride(entity));
		packByEntity.set(entity.id, merged);
		return merged;
	}
	void warmLocomotionPack(entity);
	return packWithOverride(FALLBACK_PACK, entityOverride(entity));
}

/** Drop cached entity pack so the next tick re-merges catalog + override. */
export function invalidateEntityLocomotionPack(entityId: string): void {
	packByEntity.delete(entityId);
}

/** Preload catalog locomotion bindings (call on player spawn / catalog|locomotion change). */
export function warmLocomotionPack(entity: Entity): void {
	const ref = catalogRef(entity);
	const override = entityOverride(entity);
	const apply = (pack: LocomotionBindingPack) => {
		packByCatalog.set(ref, pack);
		packByEntity.set(entity.id, packWithOverride(pack, override));
	};
	if (packByCatalog.has(ref)) {
		apply(packByCatalog.get(ref)!);
		return;
	}
	void getLocomotionBindings(ref).then((pack) => apply(pack));
}

function setAnimClip(entity: Entity, clip: string): void {
	const anim = entity.components.Mesh3DAnimator as
		| { clip?: string; loop?: boolean }
		| undefined;
	if (!anim) return;
	const pack = locomotionPack(entity);
	const loop = pack.clipLoop(clip);
	if (anim.clip === clip && anim.loop === loop) return;
	anim.clip = clip;
	anim.loop = loop;
}

export function resetPlayerAnimClipState(): void {
	landHoldMs = 0;
	jumpStartMs = 0;
	airMs = 0;
	wasAirborne = false;
	airMs = 0;
	airJumpActive = false;
	clipTier = 'idle';
	pendingTier = null;
	pendingFrames = 0;
	packByEntity.clear();
}

/** Debug probe for movement jank HUD. */
export function peekJumpAnimDebug(): { landHoldMs: number; airMs: number; wasAirborne: boolean } {
	return { landHoldMs, airMs, wasAirborne };
}

function tierClip(entity: Entity, tier: LocomotionTier): string {
	const pack = locomotionPack(entity);
	const key = TIER_KEY[tier];
	return pack.bindings[key] ?? pack.bindings.idle;
}

/** Override locomotion/jump clips while the player is in an open room chat. */
export function applyChatTalkingClip(entity: Entity): void {
	if (!('Mesh3DAnimator' in entity.components)) return;
	setAnimClip(entity, CHAT_TALKING_CLIP);
}

/** Grounded locomotion tiers only — skip while airborne or landing hold. */
export function applyLocomotionClip(entity: Entity, tier: LocomotionTier): void {
	if (wasAirborne || landHoldMs > 0 || jumpStartMs > 0) return;

	if (tier === clipTier) {
		pendingTier = null;
		pendingFrames = 0;
		setAnimClip(entity, tierClip(entity, tier));
		return;
	}

	if (tier === 'idle') {
		pendingTier = null;
		pendingFrames = 0;
		clipTier = 'idle';
		setAnimClip(entity, tierClip(entity, 'idle'));
		return;
	}

	if (pendingTier === tier) {
		pendingFrames += 1;
	} else {
		pendingTier = tier;
		pendingFrames = 1;
	}

	if (pendingFrames < TIER_HOLD_FRAMES && Math.abs(TIER_RANK[tier] - TIER_RANK[clipTier]) <= 1) {
		setAnimClip(entity, tierClip(entity, clipTier));
		return;
	}

	pendingTier = null;
	pendingFrames = 0;
	clipTier = tier;
	setAnimClip(entity, tierClip(entity, tier));
}

/**
 * Jump phases. Call from jumpSystem after grounded/takeoff updates.
 * `airJump` selects doubleJump* clips (ninja suite) for mid-air jumps.
 */
export function applyJumpAnimClip(
	entity: Entity,
	opts: {
		grounded: boolean;
		tookOff: boolean;
		/** True when this takeoff is an air / double jump (not ground/coyote). */
		airJump?: boolean;
		dtMs: number;
		/** Hold Jump_Start for this long (defaults to JUMP_START_MS). */
		jumpStartMs?: number;
		anticipatory?: boolean;
	}
): void {
	if (!('Mesh3DAnimator' in entity.components)) return;
	const { bindings } = locomotionPack(entity);
	const startHoldMs = opts.jumpStartMs ?? JUMP_START_MS;
	const startClip = airJumpActive ? bindings.doubleJumpStart : bindings.jumpStart;
	const loopClip = airJumpActive ? bindings.doubleJumpLoop : bindings.jumpLoop;
	const landClip = airJumpActive ? bindings.doubleJumpLand : bindings.jumpLand;

	if (opts.anticipatory && opts.grounded && !opts.tookOff) {
		setAnimClip(entity, bindings.jumpStart);
		jumpStartMs = startHoldMs;
		return;
	}

	if (opts.tookOff) {
		landHoldMs = 0;
		wasAirborne = true;
		airMs = MIN_AIR_MS_FOR_LAND;
		airJumpActive = opts.airJump === true;
		jumpStartMs = startHoldMs;
		pendingTier = null;
		pendingFrames = 0;
		setAnimClip(
			entity,
			airJumpActive ? bindings.doubleJumpStart : bindings.jumpStart
		);
		return;
	}

	if (!opts.grounded) {
		airMs += opts.dtMs;
		// Brief sensor flicker: stay on locomotion; don't enter jump/land cycle.
		if (!wasAirborne && airMs < MIN_AIR_MS_FOR_LAND) {
			return;
		}
		wasAirborne = true;
		if (jumpStartMs > 0) {
			jumpStartMs = Math.max(0, jumpStartMs - opts.dtMs);
			if (jumpStartMs > 0) {
				setAnimClip(entity, startClip);
				return;
			}
		}
		setAnimClip(entity, loopClip);
		return;
	}

	airMs = 0;
	jumpStartMs = 0;

	if (wasAirborne) {
		wasAirborne = false;
		airMs = 0;
		landHoldMs = LAND_HOLD_MS;
		setAnimClip(entity, landClip);
		return;
	}

	if (landHoldMs > 0) {
		landHoldMs = Math.max(0, landHoldMs - opts.dtMs);
		setAnimClip(entity, landClip);
		if (landHoldMs <= 0) airJumpActive = false;
	}
}
