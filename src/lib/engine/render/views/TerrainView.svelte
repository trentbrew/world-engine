<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AutoColliders, RigidBody } from '@threlte/rapier';
	import type { DirectionalLight, Group, Mesh } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import {
		createTerrain,
		TERRAIN_DEFAULTS,
		type TerrainParams
	} from '$lib/engine/render/terrain/terrain';
	import { createTerrainGrass, type TerrainGrassHandle } from '$lib/engine/render/grass/terrainGrass';
	import {
		coerceGrassParams,
		resolveGrassParams,
		type GrassParams
	} from '$lib/engine/render/grass/params';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	type TerrainConfig = Partial<TerrainParams> & { grass?: TerrainGrassConfig };

	type TerrainGrassConfig = {
		enabled?: boolean;
		preset?: string;
		density?: number;
		maxCount?: number;
		bladeMinLength?: number;
		bladeMaxLength?: number;
		colorBottom?: string;
		colorTop?: string;
		windStrength?: number;
		windDirection?: number;
		windSpeed?: number;
		stillInEdit?: boolean;
		params?: Record<string, unknown>;
	};

	let transformRoot = $state<Group | undefined>();
	let handle = $state<ReturnType<typeof createTerrain> | undefined>();
	let terrainMesh = $state<Mesh | undefined>();
	let grassHandle = $state<TerrainGrassHandle | undefined>();

	const { scene } = useThrelte();

	const cfg = $derived(comp<TerrainConfig>(entity, 'Terrain') ?? {});
	const pos = $derived(position(entity));
	const scale = $derived(scaleVec(entity));
	const pick = $derived(pickHandlers(entity.id));

	const params = $derived.by<TerrainParams>(() => {
		const base: TerrainParams = { ...TERRAIN_DEFAULTS, ...cfg };
		// Sanity: a displaced plane needs an even, non-tiny grid.
		base.segments = Math.max(4, Math.floor(base.segments));
		return base;
	});

	const playing = $derived(ui.shellMode === 'play');
	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' && world.selection === entity.id && world.canTransformEntity(entity.id)
	);

	/**
	 * Terrain is static geometry — every param change bakes a new displaced mesh
	 * (and thus a new trimesh collider). Rebuild on any param change; there is no
	 * cheap live uniform path like grass. This is fine: terrain edits are rare in
	 * authoring, and the rebuild is a single geometry pass.
	 */
	$effect(() => {
		const built = createTerrain({ params });
		handle = built;
		terrainMesh = built.object3D;
		return () => {
			built.dispose();
			if (handle === built) handle = undefined;
			if (terrainMesh === built.object3D) terrainMesh = undefined;
		};
	});

	$effect(() => {
		if (!transformRoot) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		const r = rotationQuat(entity);
		transformRoot.quaternion.set(r[0], r[1], r[2], r[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});

	const grassCfg = $derived(cfg.grass ?? null);
	const grassEnabled = $derived(!!grassCfg?.enabled);
	const grassParams = $derived.by<GrassParams | null>(() => {
		if (!grassCfg) return null;
		const curated: Partial<GrassParams> = {};
		if (grassCfg.density !== undefined) curated.grDensity = grassCfg.density;
		if (grassCfg.maxCount !== undefined) curated.grMaxCount = grassCfg.maxCount;
		if (grassCfg.bladeMinLength !== undefined) curated.grMinLength = grassCfg.bladeMinLength;
		if (grassCfg.bladeMaxLength !== undefined) curated.grMaxLength = grassCfg.bladeMaxLength;
		if (grassCfg.colorBottom !== undefined) curated.grColorBottom = grassCfg.colorBottom;
		if (grassCfg.colorTop !== undefined) curated.grColorTop = grassCfg.colorTop;
		if (grassCfg.windStrength !== undefined) curated.grWindStrength = grassCfg.windStrength;
		if (grassCfg.windDirection !== undefined) curated.grWindDir = grassCfg.windDirection;
		if (grassCfg.windSpeed !== undefined) curated.grWindSpeed = grassCfg.windSpeed;
		return resolveGrassParams(grassCfg.preset ?? 'default', {
			...curated,
			...(coerceGrassParams(grassCfg.params ?? {}) as Partial<GrassParams>)
		});
	});

	// Wind runs in play by default; a world can opt in via `stillInEdit: false`.
	const grassWind = $derived(grassEnabled && (ui.shellMode === 'play' || grassCfg?.stillInEdit === false));

	// Blades scatter onto the terrain mesh in its local space, so rebuild whenever
	// the terrain geometry or grass params change. Cosmetic param edits (wind,
	// colors) only move uniforms — see setParams.
	$effect(() => {
		if (!grassEnabled || !terrainMesh || !grassParams) return;
		const built = createTerrainGrass(terrainMesh, { params: grassParams });
		grassHandle = built;
		return () => {
			built.dispose();
			if (grassHandle === built) grassHandle = undefined;
		};
	});

	let sun: DirectionalLight | null = null;
	function resolveSun(): DirectionalLight | null {
		if (sun && sun.parent) return sun;
		sun = null;
		scene.traverse((o) => {
			if (!sun && (o as DirectionalLight).isDirectionalLight) sun = o as DirectionalLight;
		});
		return sun;
	}

	useTask(
		(delta) => {
			grassHandle?.update(delta, resolveSun());
		},
		{ running: () => grassWind && grassHandle !== undefined }
	);
</script>

<T.Group bind:ref={transformRoot} {...pick}>
	{#if playing && terrainMesh}
		<RigidBody type="fixed">
			<AutoColliders shape="trimesh" friction={0.85} restitution={0.1}>
				<T is={terrainMesh} />
			</AutoColliders>
		</RigidBody>
	{:else if terrainMesh}
		<T is={terrainMesh} />
	{/if}
	{#if grassHandle}
		<T is={grassHandle.object3D} />
	{/if}
</T.Group>

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
