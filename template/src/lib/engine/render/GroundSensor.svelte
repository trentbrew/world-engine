<script lang="ts">
	import { usePhysicsTask, useRapier } from '@threlte/rapier';
	import type { RigidBody } from '@dimforge/rapier3d-compat';
	import { RigidBodyType } from '@dimforge/rapier3d-compat';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { bindPlayerCollisionContext, clipUpwardStepDeltaForEntity } from '$lib/engine/player/playerCollision';
	import { GAMEPLAY_PHYSICS_TICK } from '$lib/engine/physics/physicsTaskKeys';
	import { registerRapierWorldProbe } from '$lib/engine/physics/rapierWorldProbe';
	import { resolveCollider } from '$lib/engine/physics/colliderShape';
	import { capsuleFitFor, rememberPlayerCapsuleFit } from '$lib/engine/player/playerCapsuleFit';
	import { comp, position } from '$lib/engine/render/access';
	import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
	import { groundStore } from '$lib/engine/player/groundStore.svelte';
	import {
		noteGroundedEdge,
		noteUngroundReason
	} from '$lib/engine/player/movementJank.svelte';
	import {
		CAST_DISTANCE,
		estimateGroundNormal,
		FLOOR_FUDGE,
		isWalkableHit,
		PROBE_RADIUS,
		SAMPLE_OFFSETS,
		slopeNormalFromHit,
		STEP_HEIGHT,
		type GroundSampleHit
	} from '$lib/engine/render/groundSensorUtils';

	/** Lift the foot probe slightly so casts start above the floor, not inside it. */
	const FOOT_CAST_LIFT = 0.03;
	/** Ignore sub-cm height flicker from mesh/collider ray hits (walk jitter). */
	const HEIGHT_DEADBAND = 0.03;
	/** Require this many consecutive bad casts before clearing grounded. */
	const UNGROUND_FRAMES = 3;

	interface Props {
		entity: Entity;
		rigidBody: RigidBody;
		playing: boolean;
	}

	let { entity, rigidBody, playing }: Props = $props();

	const { world, rapier } = useRapier();
	const identityRot = { w: 1, x: 0, y: 0, z: 0 };
	const castVel = { x: 0, y: -1, z: 0 };
	const INITIAL_OVERLAP_EPSILON = 1e-4;
	let probeShape: InstanceType<typeof rapier.Ball> | undefined;
	let missFrames = 0;

	// Bind the collision context to the live rigid body. The player's PhysicsBody is
	// recreated on edit → play (see PhysicsBody `{#key play-${entity.id}}`), so the
	// body can be undefined at mount and the old body freed on remount — binding once
	// in onMount would hand the collision casts a stale body and they'd hit the
	// player's own capsule (movement blocked). Re-bind whenever `rigidBody` changes.
	$effect(() => {
		const rb = rigidBody;
		if (!rb) return;
		bindPlayerCollisionContext({ world, rapier, rigidBody: rb });
		registerRapierWorldProbe(world, rapier);
		return () => {
			bindPlayerCollisionContext(null);
			registerRapierWorldProbe(null, null);
		};
	});

	function footY(transformY: number): number {
		const render = comp<{ mesh?: string }>(entity, 'Render') ?? {};
		const physics = comp<{ collider?: string }>(entity, 'Physics') ?? {};
		const scale =
			(comp<{ scale?: [number, number, number] }>(entity, 'Transform')?.scale as
				| [number, number, number]
				| undefined) ?? [1, 1, 1];
		const fit =
			'Player' in entity.components && 'SkinnedMesh' in entity.components
				? rememberPlayerCapsuleFit(entity, renderBounds.get(entity.id)) ??
					capsuleFitFor(entity.id)
				: undefined;
		const collider = resolveCollider(render.mesh, physics.collider ?? 'capsule', scale, fit);
		const [halfHeight, radius] = collider.shape === 'capsule' ? collider.args : [0.25, 0.32];
		return transformY - halfHeight - radius;
	}

	function castSample(
		originX: number,
		footBaseY: number,
		originZ: number,
		castDistance: number
	): GroundSampleHit | null {
		if (!probeShape) return null;
		const originY = footBaseY + PROBE_RADIUS + FOOT_CAST_LIFT;
		const hit = world.castShape(
			{ x: originX, y: originY, z: originZ },
			identityRot,
			castVel,
			probeShape,
			0,
			castDistance,
			true,
			undefined,
			undefined,
			undefined,
			rigidBody
		);
		if (!hit || !isWalkableHit(hit)) return null;

		const toi = hit.time_of_impact;
		const point: [number, number, number] = [
			originX,
			originY - toi - PROBE_RADIUS,
			originZ
		];
		const parent = hit.collider.parent();
		return {
			point,
			normal: slopeNormalFromHit(hit),
			toi,
			bodyHandle: parent?.handle ?? null
		};
	}

	function resetPlatformSample() {
		groundStore.platformRigidBodyHandle = null;
		groundStore.platformVelocity = [0, 0, 0];
	}

	function samplePlatformVelocity(handle: number | null): [number, number, number] {
		if (handle === null) return [0, 0, 0];
		const body = world.getRigidBody(handle);
		if (!body || body.bodyType() === RigidBodyType.Fixed) return [0, 0, 0];
		const velocity = body.linvel();
		return [velocity.x, velocity.y, velocity.z];
	}

	function tryUnground(reason: 'miss' | 'stepUp' | 'overlap'): void {
		noteUngroundReason(reason);
		missFrames += 1;
		// Sticky grounded: keep last good contact for a few frames so walk casts
		// don't flicker airborne → land clip → snap every step.
		if (missFrames < UNGROUND_FRAMES && groundStore.grounded) return;
		if (groundStore.grounded) noteGroundedEdge(false, reason);
		groundStore.grounded = false;
		groundStore.normal = [0, 1, 0];
		resetPlatformSample();
	}

	usePhysicsTask(
		() => {
			if (!playing) return;
			if (!probeShape) probeShape = new rapier.Ball(PROBE_RADIUS);
			world.updateSceneQueries();

			const pos = position(entity);
			const baseFootY = footY(pos[1]);
			const castDistance = CAST_DISTANCE;
			const hits: (GroundSampleHit | null)[] = [];

			for (const [ox, oz] of SAMPLE_OFFSETS) {
				hits.push(castSample(pos[0] + ox, baseFootY, pos[2] + oz, castDistance));
			}

			const centerHit = hits[0];
			if (!centerHit || centerHit.toi > castDistance) {
				tryUnground('miss');
				return;
			}

			const stepUp = centerHit.point[1] - baseFootY;
			if (stepUp > STEP_HEIGHT) {
				tryUnground('stepUp');
				return;
			}
			if (stepUp > FLOOR_FUDGE) {
				const maxAllowed = clipUpwardStepDeltaForEntity(entity, stepUp);
				if (maxAllowed < stepUp - FLOOR_FUDGE) {
					tryUnground('stepUp');
					return;
				}
			}
			if (centerHit.toi <= INITIAL_OVERLAP_EPSILON && stepUp > FLOOR_FUDGE) {
				tryUnground('overlap');
				return;
			}

			missFrames = 0;
			const hy = centerHit.point[1];
			const wasGrounded = groundStore.grounded;
			if (!wasGrounded) noteGroundedEdge(true);
			groundStore.grounded = true;
			if (!wasGrounded || Math.abs(hy - groundStore.height) > HEIGHT_DEADBAND) {
				groundStore.height = hy;
			}
			groundStore.normal = estimateGroundNormal(hits, centerHit);
			groundStore.platformRigidBodyHandle = centerHit.bodyHandle;
			groundStore.platformVelocity = samplePlatformVelocity(centerHit.bodyHandle);
		},
		{ after: GAMEPLAY_PHYSICS_TICK }
	);
</script>
