<script lang="ts">
	import { T } from '@threlte/core';
	import { GLTF, type ThrelteGltf, useMeshopt } from '@threlte/extras';
	import { Mesh, Group, SRGBColorSpace, Texture, TextureLoader, type Object3D } from 'three';
	import { getContext } from 'svelte';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { peerColor } from '$lib/engine/collab/peerColor';
	import { isPlayerEntity, isRemotePlayerEntity, playerClientId } from '$lib/engine/player/access';
	import { comp, position, rotationQuat } from '$lib/engine/render/access';
	import { PHYSICS_LOCAL_KEY } from '$lib/engine/physics/context';
	import OutlineGltfMeshes from '$lib/engine/render/OutlineGltfMeshes.svelte';
	import StyledMeshMaterial from '$lib/engine/render/views/StyledMeshMaterial.svelte';
	import { applyToonToObject } from '$lib/engine/render/toonConvert';
	import {
		meshAnchorOffset,
		meshBoundsFromRoot,
		primitiveAnchorOffset,
		type MeshAnchor
	} from '$lib/engine/render/meshAnchor';
	import { isGltfMesh, isPrimitiveMesh, resolveMeshUrl } from '$lib/engine/render/meshRef';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';
	import { pickHandlers } from '$lib/engine/render/pointerPick';
	import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
	import EntityTransformControls from '$lib/scene/EntityTransformControls.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { splatReady } from '$lib/engine/render/splatReady.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const DEFAULT_COLOR = '#d4d4d4';
	const meshoptDecoder = useMeshopt();

	let { entity }: { entity: Entity } = $props();

	let loadFailed = $state(false);
	let gltfOffset = $state<[number, number, number]>([0, 0, 0]);
	let boxMesh = $state<Mesh | undefined>();
	let gltfRoot = $state<Object3D | undefined>();
	let transformRoot = $state<Group | undefined>();
	let mapTexture = $state<Texture | undefined>();

	const render = $derived(
		comp<{
			mesh?: string;
			color?: string;
			anchor?: MeshAnchor;
			map?: string;
			visible?: boolean;
			deferUntilSplat?: boolean;
		}>(entity, 'Render') ?? {}
	);
	/** Heavy props can wait for the hall splat before mounting GLTF / maps. */
	const waitForSplat = $derived(
		Boolean(render.deferUntilSplat) &&
			world.query('GaussianSplat').length > 0 &&
			!splatReady.ready
	);
	const meshVisible = $derived(render.visible !== false && !waitForSplat);
	/** Author visibility only — geometry may stay mounted for physics colliders. */
	const drawVisible = $derived(render.visible !== false);
	const physicsLocal = getContext<boolean>(PHYSICS_LOCAL_KEY) ?? false;
	const pos = $derived<[number, number, number]>(
		physicsLocal ? [0, 0, 0] : position(entity)
	);
	/** Parent RigidBody / PhysicsBody group already carries world rotation. */
	const rot = $derived<[number, number, number, number]>(
		physicsLocal ? [0, 0, 0, 1] : rotationQuat(entity)
	);
	const scale = $derived<[number, number, number]>(
		physicsLocal
			? [1, 1, 1]
			: (comp<{ scale?: [number, number, number] }>(entity, 'Transform')?.scale ?? [1, 1, 1])
	);
	const color = $derived(render.color ?? DEFAULT_COLOR);
	const mapUrl = $derived(typeof render.map === 'string' && render.map ? render.map : '');
	const anchor = $derived(render.anchor ?? 'origin');
	const meshUrl = $derived(render.mesh ? resolveMeshUrl(render.mesh) : '');
	const useGltf = $derived(isGltfMesh(render.mesh) && !loadFailed);
	const useBox = $derived(isPrimitiveMesh(render.mesh) || loadFailed || !isGltfMesh(render.mesh));
	const mountGltf = $derived(useGltf && !waitForSplat && (meshVisible || physicsLocal));
	const mountBox = $derived(useBox && !waitForSplat && (meshVisible || physicsLocal));
	const isPlayer = $derived(isPlayerEntity(entity));
	const isLocalPlayer = $derived(isPlayer && !isRemotePlayerEntity(entity));
	const showPeerGhost = $derived(isRemotePlayerEntity(entity));
	const hasMap = $derived(Boolean(mapUrl) && !showPeerGhost && !isLocalPlayer);
	const primitiveKind = $derived(
		render.mesh === 'primitive:capsule'
			? 'capsule'
			: render.mesh === 'primitive:sphere'
				? 'sphere'
				: 'box'
	);
	const primitiveOffset = $derived(primitiveAnchorOffset(primitiveKind, anchor));
	const ghostColor = $derived.by(() => {
		const clientId = playerClientId(entity);
		return clientId ? peerColor(clientId) : color;
	});
	const pick = $derived(
		isLocalPlayer && ui.shellMode !== 'edit' ? {} : pickHandlers(entity.id)
	);
	const showTransformGizmo = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			!physicsLocal &&
			world.selection === entity.id &&
			world.canTransformEntity(entity.id)
	);

	$effect(() => {
		render.mesh;
		anchor;
		loadFailed = false;
		gltfOffset = [0, 0, 0];

		return () => {
			renderBounds.clear(entity.id);
		};
	});

	$effect(() => {
		const url = mapUrl;
		// Skip texture fetch while the mesh is undrawn (invisible / waiting on splat).
		if (!url || !meshVisible) {
			mapTexture = undefined;
			return;
		}

		let cancelled = false;
		const loader = new TextureLoader();
		loader.load(
			url,
			(tex) => {
				if (cancelled) return;
				tex.colorSpace = SRGBColorSpace;
				mapTexture = tex;
			},
			undefined,
			() => {
				if (!cancelled) mapTexture = undefined;
			}
		);

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!boxMesh) return;
		return outlineRegistry.register(entity.id, boxMesh);
	});

	// Re-skin loaded glTF meshes when the art style's material mode changes.
	$effect(() => {
		if (!gltfRoot) return;
		applyToonToObject(gltfRoot, ui.scene.style.materialMode === 'toon');
	});

	// While the gizmo is inactive, drive the transform root from world state.
	// When the gizmo is active, EntityTransformControls owns the object.
	$effect(() => {
		if (!transformRoot || showTransformGizmo) return;
		const p = pos;
		transformRoot.position.set(p[0], p[1], p[2]);
		const r = rot;
		transformRoot.quaternion.set(r[0], r[1], r[2], r[3]);
		transformRoot.scale.set(scale[0], scale[1], scale[2]);
	});

	function publishRenderBounds() {
		if (!transformRoot || !gltfRoot) return;
		transformRoot.updateWorldMatrix(true, true);
		renderBounds.set(entity.id, meshBoundsFromRoot(transformRoot));
	}

	function handleGltfLoad(gltf: ThrelteGltf) {
		gltf.scene.traverse((object: Object3D) => {
			if (object instanceof Mesh) {
				object.castShadow = ui.scene.shadows;
				object.receiveShadow = ui.scene.shadows;
			}
		});
		const [ox, oy, oz] = meshAnchorOffset(gltf.scene, anchor);
		gltfOffset = [ox, oy, oz];
		// Apply immediately so root AABB includes the anchor (Threlte prop may lag one frame).
		gltf.scene.position.set(ox, oy, oz);
		gltfRoot = gltf.scene;
		if (transformRoot) {
			publishRenderBounds();
		} else {
			// Unparented fallback — offset already on scene.position.
			renderBounds.set(entity.id, meshBoundsFromRoot(gltf.scene));
		}
	}

	// Keep badge / focus AABBs aligned when Transform scale/position changes.
	$effect(() => {
		pos;
		scale;
		gltfRoot;
		transformRoot;
		publishRenderBounds();
	});

	function handleGltfError(error: Error) {
		loadFailed = true;
		renderBounds.clear(entity.id);
		console.warn(`[render] glTF load failed for ${entity.id}, using box fallback`, error);
	}
</script>

{#if mountGltf}
	<T.Group bind:ref={transformRoot} position={pos} {scale} visible={drawVisible}>
		<GLTF
			url={meshUrl}
			position={gltfOffset}
			{meshoptDecoder}
			onload={handleGltfLoad}
			onerror={handleGltfError}
			{...pick}
		>
			{#snippet children({ ref })}
				<OutlineGltfMeshes entityId={entity.id} root={ref} />
			{/snippet}
		</GLTF>
	</T.Group>
{:else if mountBox}
	<T.Group bind:ref={transformRoot} position={pos} {scale} visible={drawVisible}>
		<T.Mesh
			bind:ref={boxMesh}
			position={primitiveOffset}
			castShadow={!showPeerGhost && ui.scene.shadows}
			receiveShadow={!showPeerGhost && ui.scene.shadows}
			{...pick}
		>
			{#if primitiveKind === 'capsule'}
				<T.CapsuleGeometry args={[0.32, 0.5, 4, 14]} />
			{:else if primitiveKind === 'sphere'}
				<T.SphereGeometry args={[0.5, 24, 16]} />
			{:else}
				<T.BoxGeometry args={[1, 1, 1]} />
			{/if}
			{#if showPeerGhost}
				<T.MeshBasicMaterial
					color={ghostColor}
					wireframe
					transparent
					opacity={0.72}
					depthWrite={false}
				/>
			{:else if hasMap && mapTexture}
				<T.MeshStandardMaterial map={mapTexture} color="#ffffff" />
			{:else if isLocalPlayer}
				<StyledMeshMaterial {color} emissive={color} emissiveIntensity={0.4} />
			{:else}
				<StyledMeshMaterial {color} />
			{/if}
		</T.Mesh>
		{#if isPlayer && primitiveKind === 'capsule' && !showPeerGhost}
			<T.Mesh position={[0, 0, -0.4]} castShadow={ui.scene.shadows}>
				<T.BoxGeometry args={[0.14, 0.1, 0.14]} />
				<StyledMeshMaterial
					color={color}
					emissive={color}
					emissiveIntensity={isLocalPlayer ? 0.55 : 0.25}
				/>
			</T.Mesh>
		{/if}
	</T.Group>
{/if}

{#if showTransformGizmo && transformRoot}
	<EntityTransformControls {entity} object={transformRoot} />
{/if}
