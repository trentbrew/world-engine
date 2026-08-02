<script lang="ts">
	import { T } from '@threlte/core';
	import {
		LinearFilter,
		Mesh,
		RepeatWrapping,
		SRGBColorSpace,
		Texture,
		TextureLoader
	} from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { scheduler } from '$lib/engine/systems/scheduler.svelte';
	import { comp, position, scaleVec } from '$lib/engine/render/access';
	import { PHYSICS_LOCAL_KEY } from '$lib/engine/physics/context';
	import { spriteAnchorOffset, spriteWorldSize } from '$lib/engine/render/spriteAnchor';
	import type { SpriteAnchor } from '$lib/engine/render/spriteAnchor';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { getContext } from 'svelte';

	type FrameRect = [number, number, number, number];

	let { entity }: { entity: Entity } = $props();

	let quadMesh = $state<Mesh | undefined>();
	let texture = $state<Texture | undefined>();
	let loadFailed = $state(false);

	const sprite = $derived(
		comp<{
			texture?: string;
			frame?: FrameRect;
			anchor?: SpriteAnchor;
			sortKey?: number;
			flipX?: boolean;
			color?: string;
		}>(entity, 'Sprite') ?? {}
	);
	const animator = $derived(
		comp<{
			fps?: number;
			frameCount?: number;
			columns?: number;
			frameWidth?: number;
			frameHeight?: number;
			frameIndex?: number;
		}>(entity, 'Animator')
	);
	const sort = $derived(comp<{ order?: number }>(entity, 'Sort'));
	const physicsLocal = getContext<boolean>(PHYSICS_LOCAL_KEY) ?? false;
	const pos = $derived<[number, number, number]>(
		physicsLocal ? [0, 0, 0] : position(entity)
	);
	const scale = $derived(scaleVec(entity));
	const anchor = $derived(sprite.anchor ?? 'bottom');
	const color = $derived(sprite.color ?? '#ffffff');
	const sortOrder = $derived(sort?.order ?? sprite.sortKey ?? 0);
	const ppu = $derived(worldProfile.profile.pixelsPerUnit);

	const animFrame = $derived.by(() => {
		if (!animator || (animator.frameCount ?? 1) <= 1) return 0;
		const idx = animator.frameIndex;
		if (typeof idx === 'number' && Number.isFinite(idx)) {
			return Math.floor(idx) % Math.max(1, animator.frameCount ?? 1);
		}
		const fps = animator.fps ?? 8;
		const count = animator.frameCount ?? 1;
		return Math.floor(scheduler.t * fps) % count;
	});

	const frameRect = $derived.by((): FrameRect => {
		if (animator && (animator.frameCount ?? 1) > 1) {
			const cols = Math.max(1, animator.columns ?? 1);
			const fw = animator.frameWidth ?? 64;
			const fh = animator.frameHeight ?? 64;
			const col = animFrame % cols;
			const row = Math.floor(animFrame / cols);
			return [col * fw, row * fh, fw, fh];
		}
		const f = sprite.frame;
		if (Array.isArray(f) && f.length >= 4) {
			return [Number(f[0]) || 0, Number(f[1]) || 0, Number(f[2]) || 64, Number(f[3]) || 64];
		}
		return [0, 0, 64, 64];
	});

	const [frameW, frameH] = $derived([frameRect[2], frameRect[3]]);
	const worldSize = $derived(spriteWorldSize(frameW, frameH, ppu));
	const anchorOffset = $derived(spriteAnchorOffset(worldSize[0], worldSize[1], anchor));

	const planeRotation = $derived(
		worldProfile.profile.plane === 'xy' ? [0, 0, 0] as [number, number, number] : [-Math.PI / 2, 0, 0] as [number, number, number]
	);

	const pick = $derived(pickHandlers(entity.id));
	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			!physicsLocal &&
			world.selection === entity.id &&
			world.canTransformEntity(entity.id)
	);

	$effect(() => {
		const url = sprite.texture ?? '/logo.png';
		loadFailed = false;

		const loader = new TextureLoader();
		let cancelled = false;
		let loadedTex: Texture | undefined;

		loader.load(
			url,
			(tex) => {
				if (cancelled) {
					tex.dispose();
					return;
				}
				loadedTex = tex;
				tex.colorSpace = SRGBColorSpace;
				tex.magFilter = LinearFilter;
				tex.minFilter = LinearFilter;
				tex.wrapS = RepeatWrapping;
				tex.wrapT = RepeatWrapping;
				texture = tex;
			},
			undefined,
			() => {
				if (!cancelled) loadFailed = true;
			}
		);

		return () => {
			cancelled = true;
			renderBounds.clear(entity.id);
			if (loadedTex) {
				loadedTex.dispose();
				loadedTex = undefined;
			}
			texture = undefined;
		};
	});

	$effect(() => {
		if (!texture) return;
		const [fx, fy, fw, fh] = frameRect;
		const img = texture.image as { width?: number; height?: number } | undefined;
		const tw = img?.width ?? fw;
		const th = img?.height ?? fh;
		texture.repeat.set(fw / tw, fh / th);
		texture.offset.set(fx / tw, 1 - (fy + fh) / th);
		texture.needsUpdate = true;
	});

	$effect(() => {
		if (!quadMesh) return;
		renderBounds.set(entity.id, {
			size: [worldSize[0] * scale[0] + 0.1, worldSize[1] * scale[1] + 0.1, 0.15],
			center: [0, anchorOffset[1] * scale[1], 0]
		});
		return outlineRegistry.register(entity.id, quadMesh);
	});
</script>

<T.Group position={pos} scale={scale}>
	<T.Mesh
		bind:ref={quadMesh}
		rotation={planeRotation}
		position={[anchorOffset[0], anchorOffset[1], sortOrder * 0.001]}
		scale.x={sprite.flipX ? -1 : 1}
		renderOrder={sortOrder}
		{...pick}
	>
		<T.PlaneGeometry args={worldSize} />
		{#if texture && !loadFailed}
			<T.MeshBasicMaterial map={texture} {color} transparent alphaTest={0.05} depthWrite />
		{:else}
			<T.MeshBasicMaterial {color} transparent opacity={0.85} />
		{/if}
	</T.Mesh>
</T.Group>

{#if showTransformGizmo && quadMesh}
	<EntityTransformControls {entity} object={quadMesh.parent ?? quadMesh} />
{/if}
