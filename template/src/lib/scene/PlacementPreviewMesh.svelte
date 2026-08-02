<script lang="ts">
	import { T } from '@threlte/core';
	import { GLTF, type ThrelteGltf, useMeshopt } from '@threlte/extras';
	import { Mesh, type Object3D } from 'three';
	import { meshAnchorOffset, type MeshAnchor } from '$lib/engine/render/meshAnchor';
	import { isGltfMesh, isPrimitiveMesh, resolveMeshUrl } from '$lib/engine/render/meshRef';
	import { boxSize, capsuleGeometryArgs, sphereRadius } from '$lib/scene/gridUnits';
	import { ui } from '$lib/ui/ui.svelte';

	const GLTF_TIMEOUT_MS = 3000;
	const meshoptDecoder = useMeshopt();

	let {
		mesh,
		anchor = 'origin' as MeshAnchor,
		position,
		color
	}: {
		mesh: string;
		anchor?: MeshAnchor;
		position: [number, number, number];
		color: string;
	} = $props();

	let gltfReady = $state(false);
	let useProxy = $state(false);
	let gltfOffset = $state<[number, number, number]>([0, 0, 0]);

	const cellSize = $derived(ui.grid.cellSize);
	const useGltf = $derived(isGltfMesh(mesh) && !useProxy);
	const usePrimitive = $derived(isPrimitiveMesh(mesh) || useProxy || !isGltfMesh(mesh));
	const meshUrl = $derived(mesh ? resolveMeshUrl(mesh) : '');

	const primitiveKind = $derived(
		mesh === 'primitive:capsule' ? 'capsule' : mesh === 'primitive:sphere' ? 'sphere' : 'box'
	);
	const boxExtent = $derived(boxSize(cellSize));
	const sphereR = $derived(sphereRadius(cellSize));
	const capsuleArgs = $derived(capsuleGeometryArgs(cellSize));

	$effect(() => {
		mesh;
		anchor;
		gltfReady = false;
		useProxy = false;
		gltfOffset = [0, 0, 0];
	});

	$effect(() => {
		if (!useGltf) return;
		const timer = setTimeout(() => {
			useProxy = true;
		}, GLTF_TIMEOUT_MS);
		return () => clearTimeout(timer);
	});

	function wireframeScene(root: Object3D, wireColor: string) {
		root.traverse((object) => {
			if (object instanceof Mesh && object.material) {
				const material = object.material;
				if (Array.isArray(material)) {
					for (const entry of material) {
						entry.wireframe = true;
						entry.transparent = true;
						entry.opacity = 0.72;
						entry.depthWrite = false;
						entry.color.set(wireColor);
					}
				} else {
					material.wireframe = true;
					material.transparent = true;
					material.opacity = 0.72;
					material.depthWrite = false;
					material.color.set(wireColor);
				}
			}
		});
	}

	function handleGltfLoad(gltf: ThrelteGltf) {
		gltfOffset = meshAnchorOffset(gltf.scene, anchor);
		wireframeScene(gltf.scene, color);
		gltfReady = true;
	}
</script>

{#if useGltf}
	<T.Group {position}>
		<GLTF url={meshUrl} position={gltfOffset} {meshoptDecoder} onload={handleGltfLoad} />
		{#if !gltfReady}
			<T.Mesh>
				<T.BoxGeometry args={[boxExtent, boxExtent, boxExtent]} />
				<T.MeshBasicMaterial
					{color}
					wireframe
					transparent
					opacity={0.72}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}
	</T.Group>
{:else if usePrimitive}
	<T.Mesh {position}>
		{#if primitiveKind === 'capsule'}
			<T.CapsuleGeometry args={capsuleArgs} />
		{:else if primitiveKind === 'sphere'}
			<T.SphereGeometry args={[sphereR, 24, 16]} />
		{:else}
			<T.BoxGeometry args={[boxExtent, boxExtent, boxExtent]} />
		{/if}
		<T.MeshBasicMaterial {color} wireframe transparent opacity={0.72} depthWrite={false} />
	</T.Mesh>
{/if}
