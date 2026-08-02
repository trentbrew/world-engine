<script lang="ts">
	import { T } from '@threlte/core';
	import { AutoColliders, Collider, RigidBody, useRapier } from '@threlte/rapier';
	import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
	import type { Snippet } from 'svelte';
	import { setContext, tick } from 'svelte';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { resolveCollider } from '$lib/engine/physics/colliderShape';
	import { PHYSICS_LOCAL_KEY } from '$lib/engine/physics/context';
	import { comp, position, rotationQuat } from '$lib/engine/render/access';
	import { primitiveAnchorOffset, type MeshAnchor } from '$lib/engine/render/meshAnchor';
	import { isGltfMesh } from '$lib/engine/render/meshRef';
	import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
	import {
		registerEntityRigidBody,
		unregisterEntityRigidBody
	} from '$lib/engine/physics/entityRigidBodyProbe';
	import { rememberPlayerCapsuleFit } from '$lib/engine/player/playerCapsuleFit';
	import GroundSensor from '$lib/engine/render/GroundSensor.svelte';
	import PlayerVisualStepLag from '$lib/engine/render/PlayerVisualStepLag.svelte';
	import PhysicsBodySync from '$lib/engine/render/PhysicsBodySync.svelte';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import type { Group, Object3D } from 'three';

	interface Props {
		entity: Entity;
		children: Snippet;
	}

	let { entity, children }: Props = $props();

	const { rigidBodyObjects } = useRapier();

	setContext(PHYSICS_LOCAL_KEY, true);

	const UNIT_SCALE: [number, number, number] = [1, 1, 1];

	const physics = $derived(
		comp<{
			body?: string;
			collider?: string;
			mass?: number;
			restitution?: number;
			friction?: number;
			gravityScale?: number;
		}>(entity, 'Physics') ?? {}
	);
	const render = $derived(comp<{ mesh?: string; anchor?: MeshAnchor }>(entity, 'Render') ?? {});
	const hasSkinnedMesh = $derived('SkinnedMesh' in entity.components);
	const anchor = $derived(render.anchor ?? 'origin');
	const primitiveKind = $derived<'box' | 'sphere' | 'capsule'>(
		render.mesh === 'primitive:capsule' ||
			(!render.mesh && (physics.collider ?? 'box') === 'capsule')
			? 'capsule'
			: render.mesh === 'primitive:sphere' ||
				  (!render.mesh && (physics.collider ?? 'box') === 'ball')
				? 'sphere'
				: 'box'
	);
	const pos = $derived(position(entity));
	const rot = $derived(rotationQuat(entity));
	const playing = $derived(ui.shellMode === 'play');
	const isOwner = $derived(world.isOwner(entity.id));
	const isLocalPlayer = $derived(isOwner && 'Player' in entity.components);

	type RapierBodyType = 'fixed' | 'dynamic' | 'kinematicPosition' | 'kinematicVelocity';

	const bodyType = $derived.by((): RapierBodyType => {
		if (!playing) return 'fixed';
		const body = physics.body ?? 'dynamic';
		if (body === 'kinematic') return 'kinematicPosition';
		if (body === 'fixed' || body === 'dynamic' || body === 'kinematicPosition' || body === 'kinematicVelocity') {
			return body;
		}
		return 'dynamic';
	});
	const scale = $derived<[number, number, number]>(
		comp<{ scale?: [number, number, number] }>(entity, 'Transform')?.scale ?? [1, 1, 1]
	);
	const skinned = $derived(
		comp<{
			capsuleRadiusScale?: number;
			capsuleHeightScale?: number;
			forwardYaw?: number;
		}>(entity, 'SkinnedMesh') ?? {}
	);
	const colliderPref = $derived(physics.collider ?? 'box');
	const physicsLocalScale = $derived<[number, number, number]>(playing ? scale : UNIT_SCALE);
	const playerCapsuleFit = $derived.by(() => {
		if (!('Player' in entity.components) || !hasSkinnedMesh) return undefined;
		return rememberPlayerCapsuleFit(entity, renderBounds.get(entity.id));
	});
	// PhysicsBody carries scale through scene graph transforms, so analytic collider
	// args stay in primitive-local units to avoid double-scaling debug/gameplay shapes.
	const resolvedCollider = $derived(
		resolveCollider(render.mesh, colliderPref, UNIT_SCALE, playerCapsuleFit)
	);
	/** Place SkinnedMesh feet on capsule bottom (body origin is capsule center). */
	const skinnedCapsuleFootOffset = $derived.by((): [number, number, number] => {
		if (!hasSkinnedMesh || resolvedCollider.shape !== 'capsule') return [0, 0, 0];
		const [halfHeight, radius] = resolvedCollider.args;
		return [0, -(halfHeight + radius), 0];
	});

	// Mesh-accurate colliders: hull/trimesh derive geometry from the loaded glTF.
	// Primitives keep the analytic collider above (a hull of a box is just a box).
	const wantsMeshCollider = $derived(
		(colliderPref === 'hull' || colliderPref === 'trimesh') && isGltfMesh(render.mesh)
	);
	// Trimesh colliders are hollow (no volume) → invalid on dynamic bodies; convex
	// hull is the safe choice there. Trimesh is only kept for fixed/kinematic bodies.
	const autoShape = $derived<'convexHull' | 'trimesh'>(
		colliderPref === 'trimesh' && (physics.body ?? 'dynamic') !== 'dynamic'
			? 'trimesh'
			: 'convexHull'
	);
	const colliderOffset = $derived<[number, number, number]>(
		wantsMeshCollider ? [0, 0, 0] : primitiveAnchorOffset(primitiveKind, anchor)
	);

	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			world.selection === entity.id &&
			!playing
	);

	let rigidBody = $state<RapierRigidBody | undefined>();
	let transformRoot = $state<Group | undefined>();
	let fixedPlayRoot = $state<Group | undefined>();
	let visualRoot = $state<Group | undefined>();
	let autoColliders = $state<{ refresh: () => void } | undefined>();

	$effect(() => {
		const rb = rigidBody;
		if (!rb) return;
		registerEntityRigidBody(entity.id, rb);
		return () => unregisterEntityRigidBody(entity.id);
	});

	$effect(() => {
		if (!transformRoot || showTransformGizmo) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		transformRoot.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});

	$effect(() => {
		if (!fixedPlayRoot || !playing || bodyType !== 'fixed') return;
		const p = pos;
		fixedPlayRoot.position.set(p[0], p[1], p[2]);
		fixedPlayRoot.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
	});

	// AutoColliders builds its colliders once at mount — before the async glTF
	// geometry exists — so rebuild them once this entity's bounds appear (load done).
	$effect(() => {
		if (!wantsMeshCollider) return;
		const loaded = renderBounds.all.has(entity.id);
		const ac = autoColliders;
		if (!loaded || !ac) return;
		let cancelled = false;
		// defer a tick so the loaded scene graph is attached under AutoColliders' group
		tick().then(() => {
			if (!cancelled) ac.refresh();
		});
		return () => {
			cancelled = true;
		};
	});

	function syncRigidBodyUserData(rb: RapierRigidBody) {
		const object = rigidBodyObjects.get(rb.handle) as Object3D | undefined;
		const physics = object?.userData?.physics as
			| {
					currentPosition: { set: (x: number, y: number, z: number) => void };
					lastPosition: { set: (x: number, y: number, z: number) => void };
					currentQuaternion: { set: (x: number, y: number, z: number, w: number) => void };
					lastQuaternion: { set: (x: number, y: number, z: number, w: number) => void };
			  }
			| undefined;
		if (!physics) return;
		const p = position(entity);
		const r = rotationQuat(entity);
		physics.currentPosition.set(p[0], p[1], p[2]);
		physics.lastPosition.set(p[0], p[1], p[2]);
		physics.currentQuaternion.set(r[0], r[1], r[2], r[3]);
		physics.lastQuaternion.set(r[0], r[1], r[2], r[3]);
	}

	function seedRigidBodyFromTransform(rb: RapierRigidBody) {
		const p = position(entity);
		const r = rotationQuat(entity);
		rb.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
		rb.setRotation({ x: r[0], y: r[1], z: r[2], w: r[3] }, true);
		syncRigidBodyUserData(rb);
	}
</script>

{#snippet physicsCollider()}
	{#if resolvedCollider.shape === 'ball'}
		<Collider
			shape="ball"
			args={resolvedCollider.args}
			mass={physics.mass ?? 1}
			restitution={physics.restitution ?? 0.2}
			friction={physics.friction ?? 0.8}
		/>
	{:else if resolvedCollider.shape === 'capsule'}
		<Collider
			shape="capsule"
			args={resolvedCollider.args}
			mass={physics.mass ?? 1}
			restitution={physics.restitution ?? 0.2}
			friction={physics.friction ?? 0.8}
		/>
	{:else}
		<Collider
			shape="cuboid"
			args={resolvedCollider.args}
			mass={physics.mass ?? 1}
			restitution={physics.restitution ?? 0.2}
			friction={physics.friction ?? 0.8}
		/>
	{/if}
{/snippet}

{#snippet skinnedOrRaw()}
	{#if hasSkinnedMesh && resolvedCollider.shape === 'capsule'}
		<T.Group position={skinnedCapsuleFootOffset}>
			{@render children()}
		</T.Group>
	{:else}
		{@render children()}
	{/if}
{/snippet}

{#snippet playChildren()}
	{#if playing && isLocalPlayer}
		<T.Group bind:ref={visualRoot}>
			{@render skinnedOrRaw()}
		</T.Group>
	{:else}
		{@render skinnedOrRaw()}
	{/if}
{/snippet}

{#snippet body()}
	<RigidBody
		type={bodyType}
		gravityScale={physics.gravityScale ?? 1}
		bind:rigidBody
		oncreate={seedRigidBodyFromTransform}
	>
		{#if wantsMeshCollider}
			<AutoColliders
				bind:this={autoColliders}
				shape={autoShape}
				mass={physics.mass ?? 1}
				restitution={physics.restitution ?? 0.2}
				friction={physics.friction ?? 0.8}
			>
				<T.Group scale={physicsLocalScale}>
					{@render playChildren()}
				</T.Group>
			</AutoColliders>
		{:else}
			<T.Group scale={physicsLocalScale}>
				<T.Group position={colliderOffset}>
					{@render physicsCollider()}
				</T.Group>
				{@render playChildren()}
			</T.Group>
		{/if}
		<PhysicsBodySync {entity} {rigidBody} {playing} {isOwner} />
		{#if isLocalPlayer && rigidBody}
			<GroundSensor {entity} {rigidBody} {playing} />
			<PlayerVisualStepLag {entity} {visualRoot} {playing} />
		{/if}
	</RigidBody>
{/snippet}

{#snippet fixedPlayColliders()}
	{#if wantsMeshCollider}
		<AutoColliders
			bind:this={autoColliders}
			shape={autoShape}
			mass={physics.mass ?? 1}
			restitution={physics.restitution ?? 0.2}
			friction={physics.friction ?? 0.8}
		>
			<T.Group scale={scale}>
				{@render children()}
			</T.Group>
		</AutoColliders>
	{:else}
		<T.Group scale={scale}>
			<T.Group position={colliderOffset}>
				{@render physicsCollider()}
			</T.Group>
		</T.Group>
	{/if}
{/snippet}

{#if playing}
	{#key `play-${entity.id}`}
		{#if bodyType === 'fixed'}
			<T.Group bind:ref={fixedPlayRoot}>
				<RigidBody
					type="fixed"
					bind:rigidBody
					oncreate={seedRigidBodyFromTransform}
				>
					{@render fixedPlayColliders()}
					<PhysicsBodySync {entity} {rigidBody} {playing} {isOwner} />
				</RigidBody>
				{#if !wantsMeshCollider}
					<T.Group scale={scale}>
						{@render children()}
					</T.Group>
				{/if}
			</T.Group>
		{:else}
			{@render body()}
		{/if}
	{/key}
{:else}
	<T.Group bind:ref={transformRoot}>
		{@render body()}
	</T.Group>
	{#if showTransformGizmo && transformRoot}
		<EntityTransformControls {entity} object={transformRoot} />
	{/if}
{/if}
