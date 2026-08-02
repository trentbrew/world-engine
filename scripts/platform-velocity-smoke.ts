import type { Entity } from '$lib/engine/ontology/schema';
import { bindPlayerCollisionContext, clipHorizontalVelocity } from '$lib/engine/player/playerCollision';
import {
	addPlatformVelocity,
	platformDisplacement,
	subtractPlatformVelocity
} from '$lib/engine/player/platformVelocityUtils';

type MockHit = {
	time_of_impact: number;
	normal2: { x: number; y: number; z: number };
	collider: { parent: () => null };
};

class MockBall {
	constructor(readonly radius: number) {}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function assertNear(actual: number, expected: number, message: string): void {
	if (Math.abs(actual - expected) > 1e-6) {
		throw new Error(`${message}: expected ${expected}, got ${actual}`);
	}
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

function bindMockCollision(timeOfImpact: number) {
	const mockWorld = {
		updateSceneQueries() {},
		castShape() {
			return staticWallHit(timeOfImpact);
		}
	};

	bindPlayerCollisionContext({
		world: mockWorld,
		rapier: { Ball: MockBall },
		rigidBody: {}
	} as Parameters<typeof bindPlayerCollisionContext>[0]);
}

function testLandingSubtraction() {
	const [vx, vz] = subtractPlatformVelocity([5, 0], [2, 0, 0]);
	assertNear(vx, 3, 'landing should subtract platform X velocity');
	assertNear(vz, 0, 'landing should preserve Z when platform Z is zero');
}

function testLeaveInheritance() {
	const [vx, vz] = addPlatformVelocity([3, 0], [2, 0, 0]);
	assertNear(vx, 5, 'leaving should add platform X velocity');
	assertNear(vz, 0, 'leaving should preserve Z when platform Z is zero');
}

function testGroundedCarryDisplacement() {
	const dt = 1 / 60;
	const [dx, dz] = platformDisplacement([2, 0, 0], dt);
	assertNear(dx, 2 * dt, 'grounded carry should displace by platform velocity * dt');
	assertNear(dz, 0, 'grounded carry should preserve Z when platform Z is zero');
}

function testPlatformClipping() {
	try {
		bindMockCollision(0.08);
		const dt = 1 / 60;
		const rawSpeed = 12;
		const [clippedVx, clippedVz] = clipHorizontalVelocity(makePlayer(), rawSpeed, 0, dt, 0.01);
		const [rawDx] = platformDisplacement([rawSpeed, 0, 0], dt);
		const [clippedDx, clippedDz] = platformDisplacement([clippedVx, 0, clippedVz], dt);
		assert(clippedVx < rawSpeed, `platform clip should reduce speed below ${rawSpeed}, got ${clippedVx}`);
		assert(clippedDx < rawDx, `platform clip should reduce displacement below ${rawDx}, got ${clippedDx}`);
		assertNear(clippedDz, 0, 'platform clip should preserve zero Z displacement');
	} finally {
		bindPlayerCollisionContext(null);
	}
}

testLandingSubtraction();
testLeaveInheritance();
testGroundedCarryDisplacement();
testPlatformClipping();

console.log('platform-velocity-smoke: PASS — landing, leave, carry, clipping');
