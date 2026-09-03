/** Deterministic smoke — AABB → capsule fit (TRL-153). */
import {
	capsuleFromBounds,
	capsuleRestCenterY,
	DEFAULT_CAPSULE,
	MANNEQUIN_CAPSULE_FIT
} from '../src/lib/engine/player/playerCapsuleFit.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const fitted = capsuleFromBounds({ size: [0.6, 1.8, 0.4], center: [0, 0.9, 0] });
assert(fitted.radius > 0.05 && fitted.radius < 0.4, `radius ${fitted.radius}`);
assert(fitted.halfHeight > 0.2 && fitted.halfHeight < 1, `halfHeight ${fitted.halfHeight}`);

// Assert against the constant, not a copy of its numbers. This previously
// hardcoded the legacy pill (0.25 / 0.32) and silently rotted from e837acb
// (2026-08-11), where DEFAULT_CAPSULE became the fitted-mannequin capsule.
const fallback = capsuleFromBounds(undefined);
assert(
	fallback.halfHeight === DEFAULT_CAPSULE.halfHeight &&
		fallback.radius === DEFAULT_CAPSULE.radius,
	`no-bounds fit should be DEFAULT_CAPSULE, got ${JSON.stringify(fallback)}`
);

const spawnY = capsuleRestCenterY(MANNEQUIN_CAPSULE_FIT);
assert(spawnY > 0.95 && spawnY < 1.1, `mannequin spawn rest Y ${spawnY}`);

console.log('player-capsule-fit-smoke: PASS');
