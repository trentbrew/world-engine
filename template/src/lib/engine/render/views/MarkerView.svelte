<script lang="ts">
	import { T } from '@threlte/core';
	import type { Mesh, Group } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const SPAWN_COLOR = '#a3a3a3';
	const MARKER_COLOR = '#737373';

	let { entity }: { entity: Entity } = $props();

	let cylinderMesh = $state<Mesh | undefined>();
	let torusMesh = $state<Mesh | undefined>();
	let transformRoot = $state<Group | undefined>();

	const marker = $derived(comp<{ kind?: string }>(entity, 'Marker') ?? {});
	const pos = $derived(position(entity));
	const scale = $derived(scaleVec(entity));
	const isSpawn = $derived(marker.kind === 'spawn' || marker.kind === undefined);
	const hideSpawnInPlay = $derived(isSpawn && ui.shellMode === 'play');
	const color = $derived(isSpawn ? SPAWN_COLOR : MARKER_COLOR);
	const pick = $derived(pickHandlers(entity.id));
	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			world.selection === entity.id &&
			world.canTransformEntity(entity.id)
	);

	$effect(() => {
		if (!cylinderMesh) return;
		return outlineRegistry.register(entity.id, cylinderMesh);
	});

	$effect(() => {
		if (!torusMesh) return;
		return outlineRegistry.register(entity.id, torusMesh);
	});

	$effect(() => {
		if (!transformRoot || showTransformGizmo) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		const r = rotationQuat(entity);
		transformRoot.quaternion.set(r[0], r[1], r[2], r[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});
</script>

{#if !hideSpawnInPlay}
<T.Group bind:ref={transformRoot}>
	<T.Mesh bind:ref={cylinderMesh} {...pick}>
		<T.CylinderGeometry args={[0.4, 0.4, 0.05, 24]} />
		<T.MeshStandardMaterial {color} transparent opacity={0.55} />
	</T.Mesh>
	<T.Mesh bind:ref={torusMesh} position.y={0.03} rotation.x={-Math.PI / 2} {...pick}>
		<T.TorusGeometry args={[0.6, 0.03, 8, 32]} />
		<T.MeshStandardMaterial {color} transparent opacity={0.55} />
	</T.Mesh>
</T.Group>

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
{/if}
