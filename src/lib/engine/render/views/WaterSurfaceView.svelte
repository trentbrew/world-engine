<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Collider, RigidBody } from '@threlte/rapier';
	import type { Group } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import {
		createWaterSurface,
		WATER_DEFAULTS,
		type WaterParams,
		type WaterSurfaceHandle
	} from '$lib/engine/render/water/waterSurface';
	import { drainWaterRipples } from '$lib/engine/render/water/rippleBus';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	const { camera, invalidate } = useThrelte();

	type WaterConfig = {
		size?: number;
		infinite?: boolean;
		stillInEdit?: boolean;
		params?: Record<string, unknown>;
	};

	let transformRoot = $state<Group | undefined>();
	let handle = $state<WaterSurfaceHandle | undefined>();

	const cfg = $derived(comp<WaterConfig>(entity, 'Water') ?? {});
	const pos = $derived(position(entity));
	const scale = $derived(scaleVec(entity));
	const pick = $derived(pickHandlers(entity.id));

	const size = $derived(cfg.size ?? 40);
	const infinite = $derived(cfg.infinite ?? false);

	/**
	 * 18 flat params, no curated-vs-escape-hatch split — a water surface is a
	 * single material, so every control just moves a uniform. `params` merges
	 * on top of the defaults.
	 */
	const params = $derived.by<WaterParams>(() => {
		const overrides = cfg.params ?? {};
		return { ...WATER_DEFAULTS, ...overrides } as WaterParams;
	});

	const playing = $derived(ui.shellMode === 'play');

	/**
	 * Same on-demand rule as the grass field: the 3D editor viewport repaints
	 * only on invalidate, so the flow animation runs in play by default. A world
	 * that wants to see water move in edit opts in via `stillInEdit: false`.
	 */
	const flowRunning = $derived(ui.shellMode === 'play' || cfg.stillInEdit === false);

	$effect(() => {
		const built = createWaterSurface({
			size,
			infinite,
			params
		});
		handle = built;
		invalidate();
		return () => {
			built.dispose();
			if (handle === built) handle = undefined;
		};
	});

	$effect(() => {
		const h = handle;
		if (!h) return;
		h.setParams(params);
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

	// The surface plane rotates −90° on X and lies in the XZ play plane. The
	// collider is a child of transformRoot (identity rotation), so its axes are
	// world-aligned: half-extents are [x, y=thickness, z] — a thin horizontal
	// slab at the water line, NOT a tall vertical wall.
	const colliderHalfX = $derived(size / 2);
	const colliderHalfZ = $derived(size / 2);
	const colliderHalfThickness = 0.05;

	useTask(
		(delta) => {
			const h = handle;
			if (!h) return;
			h.update(delta, camera.current ?? undefined);
			// After update, so the stamp equals the clock this frame renders at and a
			// new ripple starts at elapsed 0 — a ring of exactly zero radius.
			for (const impact of drainWaterRipples(entity.id)) h.emitRipple(impact.x, impact.z);
		},
		{ running: () => flowRunning && handle !== undefined }
	);
</script>

<T.Group bind:ref={transformRoot} {...pick}>
	{#if playing && !infinite}
		<RigidBody type="fixed">
			<Collider
				shape="cuboid"
				args={[colliderHalfX, colliderHalfThickness, colliderHalfZ]}
				friction={0.35}
				restitution={0.1}
			/>
		</RigidBody>
	{/if}
	{#if handle}
		<T is={handle.object3D} />
	{/if}
</T.Group>

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
