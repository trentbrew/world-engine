import type { ColliderShapeCastHit, RigidBody, Shape, World } from '@dimforge/rapier3d-compat';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import type { Entity } from '$lib/engine/ontology/schema';
import { resolveCollider } from '$lib/engine/physics/colliderShape';
import { capsuleFitFor } from '$lib/engine/player/playerCapsuleFit';
import { comp, position, scaleVec } from '$lib/engine/render/access';
import {
	CAST_DISTANCE,
	FLOOR_FUDGE,
	isWalkableHit,
	PROBE_RADIUS
} from '$lib/engine/render/groundSensorUtils';

function playerCapsuleFit(entity: Entity) {
	if (!('Player' in entity.components) || !('SkinnedMesh' in entity.components)) return undefined;
	return capsuleFitFor(entity.id);
}

type RapierShapeFactory = {
	Ball: new (radius: number) => Shape;
};

type PlayerCollisionContext = {
	world: World;
	rapier: RapierShapeFactory;
	rigidBody: RigidBody;
};

const IDENTITY_ROT = { w: 1, x: 0, y: 0, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };
/**
 * Stair/curb risers are nearly vertical. Only these may be stepped onto —
 * sloped hall mesh (ny ~ 0.3) must stay a hard wall or the player nests in.
 */
const STEP_RISER_NORMAL_Y_MAX = 0.25;
/**
 * Horizontal block when |ny| is below this. Above it (but below walkable 0.5)
 * are floor grazes from ornate trimeshes — treating those as walls glues the
 * player in place. The hall walkthrough slope was ~0.31, so stay above that.
 */
const WALL_BLOCK_NORMAL_Y_MAX = 0.4;
/** Shrink casts slightly so probes don't kiss the floor every step. */
const COLLISION_SKIN = 0.015;
const HORIZONTAL_CAST_LIFT = 0.04;
const UPWARD_CAST_LIFT = 0.04;
/** Overhead faces point down — ignore shallow trimesh noise above the player. */
const CEILING_NORMAL_Y_MAX = -0.5;
const UP = { x: 0, y: 1, z: 0 };
/**
 * Near-contact threshold. Moving into the surface hard-stops; sliding/separating
 * is allowed so spawn micro-overlaps don't glue the player in place.
 */
const HORIZONTAL_CONTACT_TOI = 0.05;
/** Ignore clip only when the wall eats less than this fraction of the step (probe noise). */
const HORIZONTAL_MIN_CLIP_FRACTION = 0.08;
const HORIZONTAL_PROBE_SCALE = 0.75;
const EPSILON = 1e-6;

let collisionContext: PlayerCollisionContext | null = null;
let clipProbeShape: Shape | null = null;
let clipProbeRadius: number | null = null;
let stepProbeShape: Shape | null = null;

export function bindPlayerCollisionContext(context: PlayerCollisionContext | null): void {
	collisionContext = context;
	clipProbeShape = null;
	clipProbeRadius = null;
	stepProbeShape = null;
}

function getStepProbeShape(context: PlayerCollisionContext): Shape {
	if (!stepProbeShape) stepProbeShape = new context.rapier.Ball(PROBE_RADIUS);
	return stepProbeShape;
}

function canStepOntoTarget(
	context: PlayerCollisionContext,
	center: [number, number, number],
	targetX: number,
	targetZ: number,
	centerToFoot: number
): boolean {
	const probeShape = getStepProbeShape(context);
	const castDistance = Math.max(0, centerToFoot + CAST_DISTANCE - PROBE_RADIUS);
	const hit = context.world.castShape(
		{ x: targetX, y: center[1], z: targetZ },
		IDENTITY_ROT,
		DOWN,
		probeShape,
		0,
		castDistance,
		true,
		undefined,
		undefined,
		undefined,
		context.rigidBody
	);
	if (!hit || !isWalkableHit(hit)) return false;

	const baseFootY = center[1] - centerToFoot;
	const surfaceY = center[1] - hit.time_of_impact - PROBE_RADIUS;
	const stepUp = surfaceY - baseFootY;
	return stepUp > FLOOR_FUDGE && stepUp <= centerToFoot;
}

/** True when the hit is a near-vertical riser (stair/curb), not a hall slope. */
function isSteepRiserHit(hit: ColliderShapeCastHit): boolean {
	return Math.abs(hit.normal2.y) < STEP_RISER_NORMAL_Y_MAX;
}

function getClipProbeShape(context: PlayerCollisionContext, radius: number): Shape | null {
	const probeRadius = radius * HORIZONTAL_PROBE_SCALE;
	if (!clipProbeShape || clipProbeRadius === null || clipProbeRadius !== probeRadius) {
		clipProbeShape = new context.rapier.Ball(probeRadius);
		clipProbeRadius = probeRadius;
	}
	return clipProbeShape;
}

/** Waist height — primary wall resolve sample. Chest is step-up gate only; at chest
 * height hall trimesh grazes (toi≈0, shallow ny) and glues movement everywhere. */
function waistSampleOffset(halfHeight: number, radius: number): number {
	return halfHeight + radius;
}

function horizontalSampleFootOffsets(halfHeight: number, radius: number): number[] {
	return [waistSampleOffset(halfHeight, radius)];
}

function chestSampleOffset(halfHeight: number, radius: number): number {
	return 2 * halfHeight + radius;
}

/**
 * Block non-walkable hits that are wall-like. Floor grazes (ny in ~0.4–0.5)
 * are ignored so ornate hall tris don't glue the capsule; shallower slopes
 * (~0.31) still block so the player can't nest into the trimesh.
 */
function shouldBlockHorizontalHit(hit: ColliderShapeCastHit): boolean {
	if (isWalkableHit(hit)) return false;
	return Math.abs(hit.normal2.y) < WALL_BLOCK_NORMAL_Y_MAX;
}

/**
 * Map a wall cast hit to remaining travel along `direction`.
 * Near-contact returns 0 so the resolve path can slide / separate instead of
 * scaling the whole step to zero (which glues the player to the wall).
 */
function wallTravelFromHit(hit: ColliderShapeCastHit): number {
	if (hit.time_of_impact < HORIZONTAL_CONTACT_TOI) return 0;
	return Math.max(0, hit.time_of_impact - COLLISION_SKIN);
}

type WallCastResult = {
	distance: number | null;
	/** Closest blocking hit, if any — used to gate stair step-up. */
	hit: ColliderShapeCastHit | null;
};

function castHorizontalWall(
	context: PlayerCollisionContext,
	center: [number, number, number],
	halfHeight: number,
	radius: number,
	direction: { x: number; y: number; z: number },
	distance: number,
	sampleOffsets: number[] = horizontalSampleFootOffsets(halfHeight, radius)
): WallCastResult {
	const shape = getClipProbeShape(context, radius);
	if (!shape) return { distance: null, hit: null };

	const footBaseY = center[1] - halfHeight - radius;
	let closest = Number.POSITIVE_INFINITY;
	let closestHit: ColliderShapeCastHit | null = null;
	for (const offset of sampleOffsets) {
		const hit = context.world.castShape(
			{ x: center[0], y: footBaseY + offset + HORIZONTAL_CAST_LIFT, z: center[2] },
			IDENTITY_ROT,
			direction,
			shape,
			0,
			distance,
			true,
			undefined,
			undefined,
			undefined,
			context.rigidBody
		);
		if (!hit || !shouldBlockHorizontalHit(hit)) continue;
		const toi = wallTravelFromHit(hit);
		if (toi < closest) {
			closest = toi;
			closestHit = hit;
		}
	}
	if (!Number.isFinite(closest)) return { distance: null, hit: null };
	return { distance: closest, hit: closestHit };
}

function wallBlocksStep(wallDistance: number | null, stepDistance: number): boolean {
	if (wallDistance === null) return false;
	return wallDistance < stepDistance * (1 - HORIZONTAL_MIN_CLIP_FRACTION);
}

/**
 * Horizontal outward normal: face the player so trimesh winding can't flip
 * "into" vs "away". Uses witness2 when present, else raw normal2.
 */
function outwardHorizontalNormal(
	hit: ColliderShapeCastHit,
	center: [number, number, number]
): { x: number; z: number } | null {
	let nx = hit.normal2.x;
	let nz = hit.normal2.z;
	const len = Math.hypot(nx, nz);
	if (len < EPSILON) return null;
	nx /= len;
	nz /= len;
	const witness = hit.witness2;
	if (witness) {
		const toPlayerX = center[0] - witness.x;
		const toPlayerZ = center[2] - witness.z;
		if (nx * toPlayerX + nz * toPlayerZ < 0) {
			nx = -nx;
			nz = -nz;
		}
	}
	return { x: nx, z: nz };
}

/**
 * Contact response: keep separating / tangent motion; strip only the inward
 * component. Removing both signs (old slide) glued the player — walk-away
 * was cancelled the same as walk-into.
 */
function resolveContactMotion(
	dx: number,
	dz: number,
	hit: ColliderShapeCastHit,
	center: [number, number, number]
): [number, number] {
	const n = outwardHorizontalNormal(hit, center);
	if (!n) return [0, 0];
	const inward = dx * n.x + dz * n.z;
	if (inward >= 0) return [dx, dz];
	return [dx - n.x * inward, dz - n.z * inward];
}

function isDynamicHit(hit: ColliderShapeCastHit): boolean {
	const parent = hit.collider.parent();
	return parent !== null && parent.bodyType() === RigidBodyType.Dynamic;
}

function shouldClipHit(hit: ColliderShapeCastHit): boolean {
	if (isDynamicHit(hit)) return false;
	return shouldBlockHorizontalHit(hit);
}

function shouldBlockCeilingHit(hit: ColliderShapeCastHit): boolean {
	if (isDynamicHit(hit)) return false;
	if (hit.normal2.y > 0) return false;
	return hit.normal2.y <= CEILING_NORMAL_Y_MAX;
}

function resolvePlayerCapsule(entity: Entity): {
	center: [number, number, number];
	halfHeight: number;
	radius: number;
} | null {
	const render = comp<{ mesh?: string }>(entity, 'Render') ?? {};
	const physics = comp<{ collider?: string }>(entity, 'Physics') ?? {};
	const collider = resolveCollider(
		render.mesh,
		physics.collider ?? 'capsule',
		scaleVec(entity),
		playerCapsuleFit(entity)
	);
	if (collider.shape !== 'capsule') return null;
	const [halfHeight, radius] = collider.args;
	if (halfHeight <= 0 || radius <= 0) return null;
	return { center: position(entity), halfHeight, radius };
}

/**
 * Clip an upward delta so the capsule inner column does not intersect overhead
 * trimesh (character-controller CheckGround upward sphere cast parity).
 */
export function clipUpwardStepDelta(
	desiredUp: number,
	center: [number, number, number],
	halfHeight: number,
	radius: number
): number {
	const context = collisionContext;
	if (!context || desiredUp <= EPSILON) return desiredUp;

	const shape = getClipProbeShape(context, radius);
	if (!shape) return desiredUp;

	const footBaseY = center[1] - halfHeight - radius;
	const originY = footBaseY + waistSampleOffset(halfHeight, radius) + UPWARD_CAST_LIFT;
	const castDistance = desiredUp + 2 * halfHeight + COLLISION_SKIN;

	context.world.updateSceneQueries();

	const hit = context.world.castShape(
		{ x: center[0], y: originY, z: center[2] },
		IDENTITY_ROT,
		UP,
		shape,
		0,
		castDistance,
		true,
		undefined,
		undefined,
		undefined,
		context.rigidBody
	);
	if (!hit || !shouldBlockCeilingHit(hit)) return desiredUp;

	const allowedUp = Math.max(0, hit.time_of_impact - COLLISION_SKIN);
	return Math.min(desiredUp, allowedUp);
}

/** Entity wrapper — uses bound Rapier context + player capsule dims. */
export function clipUpwardStepDeltaForEntity(entity: Entity, desiredUp: number): number {
	if (desiredUp <= EPSILON) return desiredUp;
	const capsule = resolvePlayerCapsule(entity);
	if (!capsule) return desiredUp;
	return clipUpwardStepDelta(desiredUp, capsule.center, capsule.halfHeight, capsule.radius);
}

export function clipHorizontalVelocity(
	entity: Entity,
	vx: number,
	vz: number,
	dt: number,
	threshold: number
): [number, number] {
	const context = collisionContext;
	const speed = Math.hypot(vx, vz);
	const travel = speed * dt;
	if (!context || travel < threshold) return [vx, vz];

	const render = comp<{ mesh?: string }>(entity, 'Render') ?? {};
	const physics = comp<{ collider?: string }>(entity, 'Physics') ?? {};
	const collider = resolveCollider(
		render.mesh,
		physics.collider ?? 'capsule',
		scaleVec(entity),
		playerCapsuleFit(entity)
	);
	if (collider.shape !== 'capsule') return [vx, vz];

	const [halfHeight, radius] = collider.args;
	if (halfHeight <= 0 || radius <= 0) return [vx, vz];

	const shape = getClipProbeShape(context, radius);
	if (!shape) return [vx, vz];

	const center = position(entity);
	const footBaseY = center[1] - halfHeight - radius;
	const sampleOffsets = horizontalSampleFootOffsets(halfHeight, radius);
	const direction = { x: vx / speed, y: 0, z: vz / speed };
	const castDistance = travel + COLLISION_SKIN;
	let closest = travel;

	context.world.updateSceneQueries();

	for (const offset of sampleOffsets) {
		const originY = footBaseY + offset;
		const hit = context.world.castShape(
			{ x: center[0], y: originY + HORIZONTAL_CAST_LIFT, z: center[2] },
			IDENTITY_ROT,
			direction,
			shape,
			0,
			castDistance,
			true,
			undefined,
			undefined,
			undefined,
			context.rigidBody
		);
		if (!hit || !shouldClipHit(hit)) continue;
		closest = Math.min(closest, wallTravelFromHit(hit));
	}

	if (closest >= travel - EPSILON) return [vx, vz];

	const scale = Math.max(0, closest / travel);
	return [vx * scale, vz * scale];
}

export function resolveHorizontalPlayerMove(
	entity: Entity,
	dx: number,
	dz: number
): [number, number] {
	const context = collisionContext;
	const distance = Math.hypot(dx, dz);
	if (!context || distance <= EPSILON) return [dx, dz];

	const render = comp<{ mesh?: string }>(entity, 'Render') ?? {};
	const physics = comp<{ collider?: string }>(entity, 'Physics') ?? {};
	const collider = resolveCollider(
		render.mesh,
		physics.collider ?? 'capsule',
		scaleVec(entity),
		playerCapsuleFit(entity)
	);
	if (collider.shape !== 'capsule') return [dx, dz];

	const [halfHeight, radius] = collider.args;
	if (halfHeight <= 0 || radius <= 0) return [dx, dz];

	const center = position(entity);
	const direction = { x: dx / distance, y: 0, z: dz / distance };
	context.world.updateSceneQueries();

	const wall = castHorizontalWall(context, center, halfHeight, radius, direction, distance);
	if (!wallBlocksStep(wall.distance, distance)) return [dx, dz];

	const centerToFoot = halfHeight + radius;
	// Step-up only for steep risers with a clear chest path — never for sloped
	// hall geometry or pillar plinths (those nest the capsule into the trimesh).
	const chest = castHorizontalWall(
		context,
		center,
		halfHeight,
		radius,
		direction,
		distance,
		[chestSampleOffset(halfHeight, radius)]
	);
	const steepRiser = wall.hit !== null && isSteepRiserHit(wall.hit);
	if (
		steepRiser &&
		!wallBlocksStep(chest.distance, distance) &&
		canStepOntoTarget(context, center, center[0] + dx, center[2] + dz, centerToFoot)
	) {
		return [dx, dz];
	}

	const allowedDistance = Math.max(0, wall.distance as number);
	if (allowedDistance > EPSILON) {
		return [direction.x * allowedDistance, direction.z * allowedDistance];
	}

	// Contact: strip inward only (walk-away / strafe survive). Re-clip only
	// against a distant hit — another toi≈0 contact is the same surface.
	if (!wall.hit) return [0, 0];
	const [sx, sz] = resolveContactMotion(dx, dz, wall.hit, center);
	const slideDist = Math.hypot(sx, sz);
	if (slideDist <= EPSILON) return [0, 0];

	const slideDir = { x: sx / slideDist, y: 0, z: sz / slideDist };
	const slidWall = castHorizontalWall(
		context,
		center,
		halfHeight,
		radius,
		slideDir,
		slideDist
	);
	if (
		slidWall.distance !== null &&
		slidWall.distance > EPSILON &&
		wallBlocksStep(slidWall.distance, slideDist)
	) {
		return [slideDir.x * slidWall.distance, slideDir.z * slidWall.distance];
	}
	return [sx, sz];
}
