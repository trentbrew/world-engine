<script lang="ts">
	import { useTask } from '@threlte/core';
	import { usePhysicsTask, useRapier } from '@threlte/rapier';
	import type { RigidBody } from '@dimforge/rapier3d-compat';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { GAMEPLAY_PHYSICS_TICK } from '$lib/engine/physics/physicsTaskKeys';
	import { position, rotationQuat } from '$lib/engine/render/access';

	interface Props {
		entity: Entity;
		rigidBody: RigidBody | undefined;
		playing: boolean;
		isOwner: boolean;
	}

	let { entity, rigidBody, playing, isOwner }: Props = $props();

	const { simulationTask } = useRapier();

	const physicsBody = $derived(
		(entity.components.Physics as { body?: string } | undefined)?.body ?? 'dynamic'
	);
	const kinematicOwner = $derived(
		playing &&
			isOwner &&
			(physicsBody === 'kinematic' || physicsBody === 'kinematicPosition')
	);
	const dynamicOwner = $derived(playing && isOwner && !kinematicOwner && physicsBody !== 'fixed');

	function syncTransformToRigidBody() {
		if (!rigidBody) return;
		const pos = position(entity);
		const rot = rotationQuat(entity);
		rigidBody.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true);
		rigidBody.setRotation({ x: rot[0], y: rot[1], z: rot[2], w: rot[3] }, true);
	}

	// Always push Transform → Rapier (including fixed + edit mode). Debug
	// colliders read the physics world pose; parent Three groups alone leave
	// Rapier at the origin (parkour platforms stacked at 0,0,0).
	usePhysicsTask(
		() => {
			if (!rigidBody) return;
			if (!playing) {
				syncTransformToRigidBody();
				return;
			}
			if (physicsBody === 'fixed') {
				syncTransformToRigidBody();
				return;
			}
			if (isOwner) {
				if (kinematicOwner) syncTransformToRigidBody();
				return;
			}
			syncTransformToRigidBody();
		},
		{ after: GAMEPLAY_PHYSICS_TICK }
	);

	useTask(
		() => {
			if (dynamicOwner || !rigidBody) return;
			// Edit / fixed: keep physics pose on Transform changes even when the
			// physics stage isn't stepping the same way as play mode.
			if (!playing || physicsBody === 'fixed') {
				syncTransformToRigidBody();
			}
		},
		{ before: simulationTask }
	);

	useTask(
		() => {
			if (!dynamicOwner || !rigidBody) return;
			const t = rigidBody.translation();
			const r = rigidBody.rotation();
			const transform = entity.components.Transform as
				| {
						position?: [number, number, number];
						rotation?: [number, number, number, number];
				  }
				| undefined;
			if (!transform) return;
			transform.position = [t.x, t.y, t.z];
			transform.rotation = [r.x, r.y, r.z, r.w];
		},
		{ after: simulationTask }
	);
</script>
