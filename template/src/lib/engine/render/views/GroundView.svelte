<script lang="ts">
	import { T } from '@threlte/core';
	import { Collider, RigidBody } from '@threlte/rapier';
	import type { Group, Mesh } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { parseColor } from '$lib/engine/render/colorParse';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { placementSurfaceProps } from '$lib/scene/placementSession';
	import EditorGrid from '$lib/scene/EditorGrid.svelte';
	import { BACKDROP_POLYGON_OFFSET } from '$lib/scene/backdropDepth';
	import { editorGridPlane, editorGridPosition, playPlaneMeshRotation } from '$lib/scene/playPlane';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	let groundMesh = $state<Mesh | undefined>();
	let transformRoot = $state<Group | undefined>();

	const ground = $derived(comp<{ size?: number; color?: string }>(entity, 'Ground') ?? {});
	const pos = $derived(position(entity));
	const scale = $derived(scaleVec(entity));
	const size = $derived(ground.size ?? 20);
	const colorRaw = $derived(ground.color ?? '#80808080');
	const material = $derived(parseColor(colorRaw));
	const pick = $derived(
		ui.placementDraft ? placementSurfaceProps() : pickHandlers(entity.id)
	);
	const groundGrid = $derived(ui.scene.groundGrid);
	const playPlane = $derived(worldProfile.profile.plane);
	const meshRotation = $derived(playPlaneMeshRotation(playPlane));
	const gridPosition = $derived(editorGridPosition(playPlane));
	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			world.selection === entity.id &&
			world.canTransformEntity(entity.id)
	);
	const playing = $derived(ui.shellMode === 'play');
	const colliderHalfX = $derived((size * scale[0]) / 2);
	const colliderHalfZ = $derived((size * scale[2]) / 2);
	// Plane mesh is rotated −90° on X; cuboid half-extents are local to the rigid body,
	// so thickness must be on local Z (maps to world Y), not local Y.
	const colliderHalfThickness = 0.05;

	$effect(() => {
		if (!transformRoot || showTransformGizmo) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		const r = rotationQuat(entity);
		transformRoot.quaternion.set(r[0], r[1], r[2], r[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});
</script>

<T.Group bind:ref={transformRoot}>
	<T.Group
		rotation.x={meshRotation[0]}
		rotation.y={meshRotation[1]}
		rotation.z={meshRotation[2]}
	>
		<T.Mesh bind:ref={groundMesh} receiveShadow={ui.scene.shadows} {...pick}>
			<T.PlaneGeometry args={[size, size]} />
			{#if worldProfile.is2d || material.opacity < 0.999}
				<T.MeshBasicMaterial
					color={material.hex}
					transparent={material.opacity < 0.999}
					opacity={material.opacity}
					depthWrite={material.opacity >= 0.999}
					{...BACKDROP_POLYGON_OFFSET}
				/>
			{:else}
				<T.MeshStandardMaterial
					color={material.hex}
					roughness={0.9}
					depthWrite
					{...BACKDROP_POLYGON_OFFSET}
				/>
			{/if}
		</T.Mesh>

		{#if playing}
			<RigidBody type="fixed">
				<Collider
					shape="cuboid"
					args={[colliderHalfX, colliderHalfZ, colliderHalfThickness]}
					friction={0.85}
					restitution={0.15}
				/>
			</RigidBody>
		{/if}
	</T.Group>

	{#if groundGrid.enabled && ui.shellMode === 'edit'}
		<EditorGrid
			position.x={gridPosition[0]}
			position.y={gridPosition[1]}
			position.z={gridPosition[2]}
			renderOrder={1}
			plane={editorGridPlane(playPlane)}
			gridSize={[size, size]}
			cellSize={groundGrid.cellSize}
			sectionSize={groundGrid.sectionSize}
			cellColor={groundGrid.cellColor}
			sectionColor={groundGrid.sectionColor}
			cellThickness={0.64}
			sectionThickness={1}
			fadeDistance={size * 2}
			infiniteGrid={false}
		/>
	{/if}
</T.Group>

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
