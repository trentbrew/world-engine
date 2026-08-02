<script lang="ts">
	import { T } from '@threlte/core';
	import { GLTF, type ThrelteGltf, useMeshopt } from '@threlte/extras';
	import { Mesh, type Object3D } from 'three';
	import { meshAnchorOffset, type MeshAnchor } from '$lib/engine/render/meshAnchor';
	import { isGltfMesh, isPrimitiveMesh, resolveMeshUrl } from '$lib/engine/render/meshRef';
	import { draftAnchor, draftMesh } from '$lib/scene/placementSession';
	import { readAccentEntityColor } from '$lib/scene/placementAccent';
	import { ui } from '$lib/ui/ui.svelte';

	const GLTF_TIMEOUT_MS = 3000;
	const meshoptDecoder = useMeshopt();

	let gltfReady = $state(false);
	let useProxy = $state(false);
	let gltfOffset = $state<[number, number, number]>([0, 0, 0]);
	let accentColor = $state(readAccentEntityColor());

	const draft = $derived(ui.placementDraft);
	const pos = $derived<[number, number, number]>(ui.placementPosition ?? [0, 0, 0]);
	const visible = $derived(draft !== null && ui.placementPosition !== null && ui.placementTracking);
	const mesh = $derived(draft ? draftMesh(draft) : '');
	const anchor = $derived<MeshAnchor>(draft ? draftAnchor(draft) : 'origin');
	const useGltf = $derived(isGltfMesh(mesh) && !useProxy);
	const usePrimitive = $derived(isPrimitiveMesh(mesh) || useProxy || !isGltfMesh(mesh));
	const meshUrl = $derived(mesh ? resolveMeshUrl(mesh) : '');

	const primitiveKind = $derived(
		mesh === 'primitive:capsule' ? 'capsule' : mesh === 'primitive:sphere' ? 'sphere' : 'box'
	);

	$effect(() => {
		if (!visible) return;
		accentColor = readAccentEntityColor();
	});

	$effect(() => {
		mesh;
		anchor;
		gltfReady = false;
		useProxy = false;
		gltfOffset = [0, 0, 0];
	});

	$effect(() => {
		if (!useGltf || !visible) return;
		const timer = setTimeout(() => {
			useProxy = true;
		}, GLTF_TIMEOUT_MS);
		return () => clearTimeout(timer);
	});

	function wireframeScene(root: Object3D, color: string) {
		root.traverse((object) => {
			if (object instanceof Mesh && object.material) {
				const material = object.material;
				if (Array.isArray(material)) {
					for (const entry of material) {
						entry.wireframe = true;
						entry.transparent = true;
						entry.opacity = 0.72;
						entry.depthWrite = false;
						entry.color.set(color);
					}
				} else {
					material.wireframe = true;
					material.transparent = true;
					material.opacity = 0.72;
					material.depthWrite = false;
					material.color.set(color);
				}
			}
		});
	}

	function handleGltfLoad(gltf: ThrelteGltf) {
		gltfOffset = meshAnchorOffset(gltf.scene, anchor);
		wireframeScene(gltf.scene, accentColor);
		gltfReady = true;
	}
</script>

{#if visible && draft}
	{#if useGltf}
		<T.Group position={pos}>
			<GLTF url={meshUrl} position={gltfOffset} {meshoptDecoder} onload={handleGltfLoad} />
			{#if !gltfReady}
				<T.Mesh>
					<T.BoxGeometry args={[1, 1, 1]} />
					<T.MeshBasicMaterial
						color={accentColor}
						wireframe
						transparent
						opacity={0.72}
						depthWrite={false}
					/>
				</T.Mesh>
			{/if}
		</T.Group>
	{:else if usePrimitive}
		<T.Mesh position={pos}>
			{#if primitiveKind === 'capsule'}
				<T.CapsuleGeometry args={[0.32, 0.5, 4, 14]} />
			{:else if primitiveKind === 'sphere'}
				<T.SphereGeometry args={[0.5, 24, 16]} />
			{:else}
				<T.BoxGeometry args={[1, 1, 1]} />
			{/if}
			<T.MeshBasicMaterial
				color={accentColor}
				wireframe
				transparent
				opacity={0.72}
				depthWrite={false}
			/>
		</T.Mesh>
	{/if}
{/if}
