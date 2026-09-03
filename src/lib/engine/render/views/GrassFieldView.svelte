<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Collider, RigidBody } from '@threlte/rapier';
	import { DirectionalLight, Group, Matrix4, Quaternion, Vector3 } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import {
		createGrassField,
		type GrassFieldHandle
	} from '$lib/engine/render/grass/grassField';
	import {
		coerceGrassParams,
		resolveGrassParams,
		type GrassParams
	} from '$lib/engine/render/grass/params';
	import {
		createTerrainGrass,
		type TerrainGrassHandle
	} from '$lib/engine/render/grass/terrainGrass';
	import {
		resolveScatterSurface,
		scatterSurfaceRevision
	} from '$lib/engine/render/grass/surfaceRegistry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	const { scene, invalidate } = useThrelte();

	type GrassFieldConfig = {
		model?: string;
		size?: number;
		preset?: string;
		groundMesh?: string;
		/** Cross-entity scatter surface: entity id whose published mesh blades
		 *  scatter onto instead of this field's own ground. */
		surfaceEntity?: string;
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
	let handle = $state<GrassFieldHandle | undefined>();
	let foreignHandle = $state<TerrainGrassHandle | undefined>();
	let warnedMissing: string | null = null;

	const cfg = $derived(comp<GrassFieldConfig>(entity, 'GrassField') ?? {});
	const pos = $derived(position(entity));
	const scale = $derived(scaleVec(entity));
	const pick = $derived(pickHandlers(entity.id));

	/**
	 * The 14 curated fields map onto the underlying ~100-param object; `params`
	 * is the escape hatch and is applied last, so a world can reach anything the
	 * shader exposes without the schema having to name it.
	 */
	const params = $derived.by<GrassParams>(() => {
		const curated: Partial<GrassParams> = {};
		if (cfg.density !== undefined) curated.grDensity = cfg.density;
		if (cfg.maxCount !== undefined) curated.grMaxCount = cfg.maxCount;
		if (cfg.bladeMinLength !== undefined) curated.grMinLength = cfg.bladeMinLength;
		if (cfg.bladeMaxLength !== undefined) curated.grMaxLength = cfg.bladeMaxLength;
		if (cfg.colorBottom !== undefined) curated.grColorBottom = cfg.colorBottom;
		if (cfg.colorTop !== undefined) curated.grColorTop = cfg.colorTop;
		if (cfg.windStrength !== undefined) curated.grWindStrength = cfg.windStrength;
		if (cfg.windDirection !== undefined) curated.grWindDir = cfg.windDirection;
		if (cfg.windSpeed !== undefined) curated.grWindSpeed = cfg.windSpeed;
		return resolveGrassParams(cfg.preset ?? 'default', {
			...curated,
			...coerceGrassParams(cfg.params ?? {})
		});
	});

	const groundSize = $derived(cfg.size ?? 20);
	const groundMesh = $derived(cfg.groundMesh ?? 'grass-floor');
	const playing = $derived(ui.shellMode === 'play');
	// The grass floor is a flat plane lying in the XZ play plane at the field's
	// origin, so the collider is a world-axis-aligned cuboid under transformRoot
	// (which already applies Transform.position/rotation/scale — do not bake
	// scale here or it double-counts). Thickness is on local Y → world Y.
	const colliderHalfX = $derived(groundSize / 2);
	const colliderHalfZ = $derived(groundSize / 2);
	const colliderHalfThickness = 0.05;

	/**
	 * Wind is frozen in edit by default, and this is not cosmetic.
	 *
	 * The 3D editor viewport renders ON DEMAND (see WorldViewport's renderMode) —
	 * it repaints only when something invalidates it. An always-running wind task
	 * would convert edit mode into a permanent 60fps loop and quietly undo that
	 * design. So the task only runs in play mode unless the author opts in.
	 */
	const windRunning = $derived(ui.shellMode === 'play' || cfg.stillInEdit === false);

	const surfaceId = $derived(cfg.surfaceEntity ?? null);
	const foreignSurface = $derived(surfaceId ? resolveScatterSurface(surfaceId) : null);
	const foreignRev = $derived(surfaceId ? scatterSurfaceRevision(surfaceId) : 0);

	// Build once per structural input. Params that only move uniforms never
	// land here — see REBUILD_KEYS.
	$effect(() => {
		if (surfaceId) return; // foreign-surface mode owns grass below
		const size = groundSize;
		const mesh = groundMesh;
		const initial = params;
		const built = createGrassField({
			groundSize: size,
			groundMesh: mesh,
			params: initial,
			onWarn: (m) => console.warn(m)
		});
		handle = built;
		invalidate();
		return () => {
			built.dispose();
			if (handle === built) handle = undefined;
		};
	});

	// Foreign-surface mode: scatter onto another entity's published mesh. The
	// foreign mesh is sampled read-only (never repainted or remounted); blades
	// are rebased into this field's local space via mountMatrix so they align
	// under ANY pair of entity transforms. Rebuilds on params, surface
	// replacement, or surface revision bumps.
	$effect(() => {
		if (!surfaceId) return;
		const surface = foreignSurface;
		void foreignRev;
		const initial = params;
		if (!surface) {
			if (warnedMissing !== surfaceId) {
				warnedMissing = surfaceId;
				console.warn(
					`[GrassField] surface entity "${surfaceId}" has no published mesh — no grass spawned.`
				);
			}
			if (foreignHandle) {
				foreignHandle.dispose();
				foreignHandle = undefined;
			}
			invalidate();
			return;
		}
		warnedMissing = null;
		surface.updateWorldMatrix(true, false);
		const surfaceWorld = surface.matrixWorld.clone();
		const r = rotationQuat(entity);
		const consumerWorld = new Matrix4().compose(
			new Vector3(pos[0], pos[1], pos[2]),
			new Quaternion(r[0], r[1], r[2], r[3]),
			new Vector3(scale[0], scale[1], scale[2])
		);
		const mountMatrix = consumerWorld.invert().multiply(surfaceWorld);
		const built = createTerrainGrass(surface, {
			params: initial,
			mountMatrix,
			onWarn: (m) => console.warn(m)
		});
		foreignHandle = built;
		invalidate();
		return () => {
			built.dispose();
			if (foreignHandle === built) foreignHandle = undefined;
		};
	});

	// Live params. Rebuild only when instance geometry actually changed.
	$effect(() => {
		const h = handle;
		const next = params;
		if (!h) return;
		if (h.wouldRebuild(next)) h.rebuild(next);
		else h.setParams(next);
		invalidate();
	});

	$effect(() => {
		if (!transformRoot) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		const r = rotationQuat(entity);
		transformRoot.quaternion.set(r[0], r[1], r[2], r[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
		invalidate();
	});

	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' && world.selection === entity.id && world.canTransformEntity(entity.id)
	);

	/**
	 * The blade shader needs the sun mirrored into uSunDir/uSunColor — injected
	 * GLSL cannot reach Lambert's own light uniforms.
	 *
	 * Cached, but re-resolved whenever the cached light leaves the scene graph.
	 * Upstream cached the first directional light it ever saw and never looked
	 * again, which goes stale here: lights are entities, and a room switch
	 * replaces them wholesale.
	 */
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
			const sunNow = resolveSun();
			handle?.update(delta, sunNow);
			foreignHandle?.update(delta, sunNow);
		},
		{ running: () => windRunning && (handle !== undefined || foreignHandle !== undefined) }
	);
</script>

<T.Group bind:ref={transformRoot} {...pick}>
	{#if playing}
		<RigidBody type="fixed">
			<Collider
				shape="cuboid"
				args={[colliderHalfX, colliderHalfThickness, colliderHalfZ]}
				friction={0.85}
				restitution={0.15}
			/>
		</RigidBody>
	{/if}
	{#if handle}
		<T is={handle.object3D} />
	{/if}
	{#if foreignHandle}
		<T is={foreignHandle.object3D} />
	{/if}
</T.Group>

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
