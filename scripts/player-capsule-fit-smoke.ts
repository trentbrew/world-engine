/** Deterministic smoke — AABB → capsule fit (TRL-153). */
import {
	capsuleFromBounds,
	capsuleRestCenterY,
	MANNEQUIN_CAPSULE_FIT
} from '../src/lib/engine/player/playerCapsuleFit.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const fitted = capsuleFromBounds({ size: [0.6, 1.8, 0.4], center: [0, 0.9, 0] });
assert(fitted.radius > 0.05 && fitted.radius < 0.4, `radius ${fitted.radius}`);
assert(fitted.halfHeight > 0.2 && fitted.halfHeight < 1, `halfHeight ${fitted.halfHeight}`);

const fallback = capsuleFromBounds(undefined);
assert(fallback.halfHeight === 0.25 && fallback.radius === 0.32, 'default capsule');

const spawnY = capsuleRestCenterY(MANNEQUIN_CAPSULE_FIT);
assert(spawnY > 0.95 && spawnY < 1.1, `mannequin spawn rest Y ${spawnY}`);

console.log('player-capsule-fit-smoke: PASS');
