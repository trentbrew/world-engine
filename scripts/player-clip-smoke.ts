import { RigidBodyType } from '@dimforge/rapier3d-compat';
import type { Entity } from '$lib/engine/ontology/schema';
import {
	bindPlayerCollisionContext,
	clipHorizontalVelocity,
	clipUpwardStepDeltaForEntity,
	resolveHorizontalPlayerMove
} from '$lib/engine/player/playerCollision';

type CastRecord = {
	origin: { x: number; y: number; z: number };
	direction: { x: number; y: number; z: number };
	distance: number;
};

type MockHit = {
	time_of_impact: number;
	normal2: { x: number; y: number; z: number };
	collider: { parent: () => { bodyType: () => RigidBodyType } | null };
};

class MockBall {
	constructor(readonly radius: number) { }
}

function makePlayer(): Entity {
	return {
		id: 'entity:test/player',
		type: 'Player',
		components: {
			Transform: { position: [0, 0.57, 0], scale: [1, 1, 1] },
			SkinnedMesh: { mesh: '/models/characters/mannequin.glb' },
			Mesh3DAnimator: { clip: 'Idle_Loop' },
			Physics: { collider: 'capsule' },
			Player: {}
		},
		raw: {}
	};
}

function staticWallHit(timeOfImpact: number): MockHit {
	return {
		time_of_impact: timeOfImpact,
		normal2: { x: -1, y: 0, z: 0 },
		collider: { parent: () => null }
	};
}

function dynamicWallHit(timeOfImpact: number): MockHit {
	return {
		time_of_impact: timeOfImpact,
		normal2: { x: -1, y: 0, z: 0 },
		collider: { parent: () => ({ bodyType: () => RigidBodyType.Dynamic }) }
	};
}

function bindMockContext(hitForCast: (record: CastRecord, index: number) => MockHit | null) {
	const casts: CastRecord[] = [];
	const mockWorld = {
		updateSceneQueries() { },
		castShape(
			origin: CastRecord['origin'],
			_rotation: unknown,
			direction: CastRecord['direction'],
			_shape: unknown,
			_shapeRotation: number,
			distance: number
		) {
			const record = { origin, direction, distance };
			casts.push(record);
			return hitForCast(record, casts.length - 1);
		}
	};

	bindPlayerCollisionContext({
		world: mockWorld,
		rapier: { Ball: MockBall },
		rigidBody: {}
	} as Parameters<typeof bindPlayerCollisionContext>[0]);

	return casts;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function assertNear(actual: number, expected: number, message: string): void {
	if (Math.abs(actual - expected) > 1e-6) {
		throw new Error(`${message}: expected ${expected}, got ${actual}`);
	}
}

function testThresholdNoOp() {
	const casts = bindMockContext(() => staticWallHit(0.01));
	const [vx, vz] = clipHorizontalVelocity(makePlayer(), 1, 0, 1 / 60, 0.1);
	assertNear(vx, 1, 'threshold no-op vx');
	assertNear(vz, 0, 'threshold no-op vz');
	assert(casts.length === 0, `threshold no-op should not cast, cast ${casts.length} times`);
}

function testStaticWallClip() {
	const casts = bindMockContext(() => staticWallHit(0.08));
	const speed = 12;
	const dt = 1 / 60;
	const [vx, vz] = clipHorizontalVelocity(makePlayer(), speed, 0, dt, 0.01);
	assert(casts.length === 1, `static wall should cast 1 waist sample, cast ${casts.length} times`);
	assert(vx > 0 && vx < speed, `static wall should clip vx below ${speed}, got ${vx}`);
	assertNear(vz, 0, 'static wall should preserve zero vz');
	assert(casts.every((cast) => cast.direction.x === 1 && cast.direction.z === 0), 'casts should face +X');
}

function testDynamicHitSkip() {
	const casts = bindMockContext(() => dynamicWallHit(0.02));
	const speed = 12;
	const [vx, vz] = clipHorizontalVelocity(makePlayer(), speed, 0, 1 / 60, 0.01);
	assert(casts.length === 1, `dynamic hit should cast 1 waist sample, cast ${casts.length}`);
	assertNear(vx, speed, 'dynamic hit should not clip vx');
	assertNear(vz, 0, 'dynamic hit should preserve zero vz');
}

function testCloseContactHardStops() {
	// toi under contact threshold while moving into the wall → hard stop.
	bindMockContext(() => staticWallHit(0.02));
	const [vx, vz] = clipHorizontalVelocity(makePlayer(), 12, 0, 1 / 60, 0.01);
	assertNear(vx, 0, 'close wall contact should zero vx');
	assertNear(vz, 0, 'close wall contact should preserve zero vz');
}

function testSlopeBlocksWithoutStepOverride() {
	// Shallow hall slope (ny~0.31) used to slip through WALL_NORMAL_Y_MAX + step-up.
	bindMockContext((record) => {
		if (record.direction.y < 0) {
			return {
				time_of_impact: 0.4,
				normal2: { x: 0, y: 1, z: 0 },
				collider: { parent: () => null }
			};
		}
		return {
			time_of_impact: 0.05,
			normal2: { x: 0, y: 0.31, z: 0.95 },
			collider: { parent: () => null }
		};
	});
	const [dx, dz] = resolveHorizontalPlayerMove(makePlayer(), 0, 0.2);
	assert(Math.hypot(dx, dz) < 0.2 - 1e-3, `slope must clip step, got [${dx}, ${dz}]`);
}

function testResolveChestWallBlocksStepOverride() {
	// Waist+chest see a wall; downward step probe would claim a ledge — chest must win.
	bindMockContext((record) => {
		if (record.direction.y < 0) {
			return {
				time_of_impact: 0.4,
				normal2: { x: 0, y: 1, z: 0 },
				collider: { parent: () => null }
			};
		}
		return staticWallHit(0.04);
	});
	const [dx, dz] = resolveHorizontalPlayerMove(makePlayer(), 0.2, 0);
	// Contact + into wall → slide; normal (-1,0,0) with move +X → fully cancelled.
	assertNear(dx, 0, 'chest wall must block step-up override dx');
	assertNear(dz, 0, 'chest wall must block step-up override dz');
}

function testContactSlidesAlongWall() {
	// Sideways wall normal while moving +Z — should keep tangential motion.
	bindMockContext(() => ({
		time_of_impact: 0.01,
		normal2: { x: 1, y: 0, z: 0 },
		collider: { parent: () => null }
	}));
	const [dx, dz] = resolveHorizontalPlayerMove(makePlayer(), 0, 0.2);
	assertNear(dx, 0, 'slide should not push into sideways wall');
	assert(Math.abs(dz - 0.2) < 1e-6, `slide should keep +Z motion, got dz=${dz}`);
}

function testContactAllowsSeparating() {
	// Contact with wall facing -Z: walk-away (-Z) must not be zeroed.
	bindMockContext(() => ({
		time_of_impact: 0.01,
		normal2: { x: 0, y: 0, z: -1 },
		collider: { parent: () => null }
	}));
	const [awayX, awayZ] = resolveHorizontalPlayerMove(makePlayer(), 0, -0.2);
	assertNear(awayX, 0, 'separating should keep zero dx');
	assert(Math.abs(awayZ - -0.2) < 1e-6, `separating should keep -Z, got dz=${awayZ}`);

	bindMockContext(() => ({
		time_of_impact: 0.01,
		normal2: { x: 0, y: 0, z: -1 },
		collider: { parent: () => null }
	}));
	const [intoX, intoZ] = resolveHorizontalPlayerMove(makePlayer(), 0, 0.2);
	assertNear(intoX, 0, 'into-wall should cancel dx');
	assertNear(intoZ, 0, 'into-wall should cancel dz');
}

function testSlopeContactSlidesNotGlue() {
	// Slope facing the player (outward normal −Z). Into (+Z) zeros; diagonal keeps tangent.
	bindMockContext(() => ({
		time_of_impact: 0.01,
		normal2: { x: 0, y: 0.31, z: -0.95 },
		collider: { parent: () => null }
	}));
	const [dx, dz] = resolveHorizontalPlayerMove(makePlayer(), 0, 0.2);
	assertNear(dx, 0, 'into-slope +Z should cancel dx');
	assertNear(dz, 0, 'into-slope +Z should cancel dz');

	bindMockContext(() => ({
		time_of_impact: 0.01,
		normal2: { x: 0, y: 0.31, z: -0.95 },
		collider: { parent: () => null }
	}));
	const [sx, sz] = resolveHorizontalPlayerMove(makePlayer(), 0.2, 0.2);
	assert(sx > 0.05, `slope contact should allow slide sx, got ${sx}`);
	assert(Math.abs(sz) < 0.05, `slope slide should cancel into-normal sz, got ${sz}`);
}

function testWaistIgnoresChestGraze() {
	// Chest-height hall graze must not block when waist is clear.
	const player = makePlayer();
	const [halfHeight, radius] = [0.51853, 0.47125];
	const footBaseY = player.components.Transform.position[1] - halfHeight - radius;
	const waistY = footBaseY + halfHeight + radius + 0.04;
	const chestY = footBaseY + 2 * halfHeight + radius + 0.04;

	bindMockContext((record) => {
		if (Math.abs(record.origin.y - chestY) < 0.01) {
			return {
				time_of_impact: 0.01,
				normal2: { x: 0, y: 0.31, z: -0.95 },
				collider: { parent: () => null }
			};
		}
		if (Math.abs(record.origin.y - waistY) < 0.01) return null;
		return null;
	});
	const [dx, dz] = resolveHorizontalPlayerMove(player, 0, 0.2);
	assert(Math.abs(dz - 0.2) < 1e-6, `waist-only should ignore chest graze, got dz=${dz}`);
	assertNear(dx, 0, 'waist-only chest graze should preserve zero dx');
}

function staticCeilingHit(timeOfImpact: number): MockHit {
	return {
		time_of_impact: timeOfImpact,
		normal2: { x: 0, y: -1, z: 0 },
		collider: { parent: () => null }
	};
}

function dynamicCeilingHit(timeOfImpact: number): MockHit {
	return {
		time_of_impact: timeOfImpact,
		normal2: { x: 0, y: -1, z: 0 },
		collider: { parent: () => ({ bodyType: () => RigidBodyType.Dynamic }) }
	};
}

function testUpwardClipAllowsWhenClear() {
	bindMockContext(() => null);
	const delta = clipUpwardStepDeltaForEntity(makePlayer(), 0.3);
	assertNear(delta, 0.3, 'clear upward path should allow full delta');
}

function testUpwardClipBlocksCeiling() {
	bindMockContext((record) => {
		if (record.direction.y > 0) return staticCeilingHit(0.1);
		return null;
	});
	const delta = clipUpwardStepDeltaForEntity(makePlayer(), 0.3);
	assert(delta < 0.3 - 1e-6, `ceiling should clip upward delta below 0.3, got ${delta}`);
	assert(delta > 0, `ceiling should allow partial rise before hit, got ${delta}`);
}

function testUpwardClipIgnoresDynamic() {
	bindMockContext((record) => {
		if (record.direction.y > 0) return dynamicCeilingHit(0.05);
		return null;
	});
	const delta = clipUpwardStepDeltaForEntity(makePlayer(), 0.3);
	assertNear(delta, 0.3, 'dynamic ceiling should not clip upward delta');
}

try {
	testThresholdNoOp();
	testStaticWallClip();
	testDynamicHitSkip();
	testCloseContactHardStops();
	testSlopeBlocksWithoutStepOverride();
	testResolveChestWallBlocksStepOverride();
	testContactSlidesAlongWall();
	testContactAllowsSeparating();
	testSlopeContactSlidesNotGlue();
	testWaistIgnoresChestGraze();
	testUpwardClipAllowsWhenClear();
	testUpwardClipBlocksCeiling();
	testUpwardClipIgnoresDynamic();
} finally {
	bindPlayerCollisionContext(null);
}

console.log(
	'player-clip-smoke: PASS — threshold, static clip, dynamic skip, close contact, slope, chest vs step, slide, separate, unstick, upward clip'
);
