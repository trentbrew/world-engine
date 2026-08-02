<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { GLTF, interactivity, type ThrelteGltf, useMeshopt } from '@threlte/extras';
	import type CameraControlsImpl from 'camera-controls';
	import {
		Box3,
		CanvasTexture,
		Color,
		Mesh,
		MeshBasicMaterial,
		MeshStandardMaterial,
		RepeatWrapping,
		SkeletonHelper,
		SkinnedMesh,
		Vector3,
		type Material,
		type Object3D,
		type Texture
	} from 'three';
	import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';
	import { inspectGltf, type GltfInspection } from '$lib/assets/inspectGltf';
	import { meshAnchorOffset } from '$lib/engine/render/meshAnchor';
	import { isGltfMesh, isPrimitiveMesh, resolveMeshUrl } from '$lib/engine/render/meshRef';
	import type { MaterialChannel } from '$lib/ui/assetPreview.svelte';
	import { boxSize, capsuleGeometryArgs, sphereRadius } from '$lib/scene/gridUnits';
	import PreviewOrbitControls from '$lib/scene/PreviewOrbitControls.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const meshoptDecoder = useMeshopt();

	interface Props {
		mesh: string;
		wireframe: boolean;
		showBones: boolean;
		showNormals: boolean;
		materialChannel: MaterialChannel;
		onInspect?: (inspection: GltfInspection | null) => void;
		onZoomPercent?: (percent: number) => void;
	}

	let {
		mesh,
		wireframe,
		showBones,
		showNormals,
		materialChannel,
		onInspect,
		onZoomPercent
	}: Props = $props();

	const { scene, invalidate } = useThrelte();

	interactivity();

	let controls = $state<CameraControlsImpl | undefined>();
	let gltfRoot = $state<Object3D | undefined>();
	let gltfOffset = $state<[number, number, number]>([0, 0, 0]);
	let loadFailed = $state(false);
	/** Distance used as 100% after framing the mesh. */
	let frameDistance = $state(5.5);

	const cellSize = $derived(ui.grid.cellSize);
	const useGltf = $derived(isGltfMesh(mesh) && !loadFailed);
	const usePrimitive = $derived(isPrimitiveMesh(mesh) || loadFailed || !isGltfMesh(mesh));
	const meshUrl = $derived(mesh ? resolveMeshUrl(mesh) : '');

	const primitiveKind = $derived(
		mesh === 'primitive:capsule' ? 'capsule' : mesh === 'primitive:sphere' ? 'sphere' : 'box'
	);
	const boxExtent = $derived(boxSize(cellSize));
	const sphereR = $derived(sphereRadius(cellSize));
	const capsuleArgs = $derived(capsuleGeometryArgs(cellSize));

	const originalMaterials = new Map<Mesh, Material | Material[]>();
	let uvCheckerTexture: Texture | null = null;

	$effect(() => {
		mesh;
		loadFailed = false;
		gltfRoot = undefined;
		gltfOffset = [0, 0, 0];
		originalMaterials.clear();
		onInspect?.(null);
	});

	function checkerTexture(): Texture {
		if (uvCheckerTexture) return uvCheckerTexture;
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (ctx) {
			const cells = 8;
			const cell = size / cells;
			for (let y = 0; y < cells; y++) {
				for (let x = 0; x < cells; x++) {
					ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#888888';
					ctx.fillRect(x * cell, y * cell, cell, cell);
				}
			}
		}
		uvCheckerTexture = new CanvasTexture(canvas);
		uvCheckerTexture.wrapS = RepeatWrapping;
		uvCheckerTexture.wrapT = RepeatWrapping;
		uvCheckerTexture.repeat.set(4, 4);
		return uvCheckerTexture;
	}

	function storeOriginalMaterials(root: Object3D) {
		originalMaterials.clear();
		root.traverse((object) => {
			if (object instanceof Mesh && object.material) {
				originalMaterials.set(object, object.material);
			}
		});
	}

	function restoreMaterials(root: Object3D) {
		root.traverse((object) => {
			if (!(object instanceof Mesh)) return;
			const original = originalMaterials.get(object);
			if (original) object.material = original;
		});
	}

	function applyWireframe(root: Object3D, enabled: boolean) {
		root.traverse((object) => {
			if (!(object instanceof Mesh) || !object.material) return;
			const materials = Array.isArray(object.material) ? object.material : [object.material];
			for (const material of materials) {
				material.wireframe = enabled;
				material.needsUpdate = true;
			}
		});
	}

	function channelMaterial(
		source: Material,
		channel: MaterialChannel,
		checker: Texture
	): Material {
		const std = source as MeshStandardMaterial;
		if (channel === 'uvChecker') {
			return new MeshBasicMaterial({ map: checker, toneMapped: false });
		}
		if (channel === 'lit') return source;

		const basic = new MeshBasicMaterial({ toneMapped: false });
		switch (channel) {
			case 'baseColor':
				if (std.map) basic.map = std.map;
				else basic.color.copy(std.color ?? new Color('#cccccc'));
				break;
			case 'normals':
				if (std.normalMap) basic.map = std.normalMap;
				else basic.color.set('#8080ff');
				break;
			case 'emissive':
				if (std.emissiveMap) basic.map = std.emissiveMap;
				else basic.color.copy(std.emissive ?? new Color('#000000'));
				break;
			case 'roughness':
				if (std.roughnessMap) basic.map = std.roughnessMap;
				else basic.color.setScalar(std.roughness ?? 0.5);
				break;
			case 'metalness':
				if (std.metalnessMap) basic.map = std.metalnessMap;
				else basic.color.setScalar(std.metalness ?? 0);
				break;
		}
		return basic;
	}

	function applyMaterialChannel(root: Object3D, channel: MaterialChannel) {
		restoreMaterials(root);
		if (channel === 'lit') return;

		const checker = checkerTexture();
		root.traverse((object) => {
			if (!(object instanceof Mesh) || !object.material) return;
			const source = originalMaterials.get(object) ?? object.material;
			if (Array.isArray(source)) {
				object.material = source.map((entry) => channelMaterial(entry, channel, checker));
			} else {
				object.material = channelMaterial(source, channel, checker);
			}
		});
	}

	/** More zoomed-out than the old 1.4/1.6 framing so the full mesh reads at a glance. */
	function frameRoot(root: Object3D) {
		if (!controls) return;
		const box = new Box3().setFromObject(root);
		if (box.isEmpty()) return;
		const center = box.getCenter(new Vector3());
		const size = box.getSize(new Vector3());
		const maxDim = Math.max(size.x, size.y, size.z, 0.001);
		void controls.setLookAt(
			center.x + maxDim * 2.4,
			center.y + maxDim * 1.35,
			center.z + maxDim * 2.7,
			center.x,
			center.y + size.y * 0.35,
			center.z,
			false
		);
		frameDistance = controls.distance || maxDim * 4;
		onZoomPercent?.(100);
		invalidate();
	}

	function handleGltfLoad(gltf: ThrelteGltf) {
		gltf.scene.traverse((object: Object3D) => {
			if (object instanceof Mesh) {
				object.castShadow = true;
				object.receiveShadow = true;
			}
		});
		gltfOffset = meshAnchorOffset(gltf.scene, 'bottom');
		gltfRoot = gltf.scene;
		storeOriginalMaterials(gltf.scene);
		onInspect?.(inspectGltf(gltf));
		frameRoot(gltf.scene);
	}

	function handleGltfError(error: Error) {
		loadFailed = true;
		onInspect?.(null);
		console.warn('[asset-preview] glTF load failed', error);
	}

	$effect(() => {
		if (!gltfRoot) return;
		applyMaterialChannel(gltfRoot, materialChannel);
		applyWireframe(gltfRoot, wireframe);
		invalidate();
	});

	$effect(() => {
		if (!gltfRoot || !showBones) return;
		const helpers: SkeletonHelper[] = [];
		gltfRoot.traverse((object) => {
			if (object instanceof SkinnedMesh) {
				const helper = new SkeletonHelper(object);
				helper.visible = showBones;
				scene.add(helper);
				helpers.push(helper);
			}
		});
		invalidate();
		return () => {
			for (const helper of helpers) {
				scene.remove(helper);
				helper.dispose();
			}
		};
	});

	$effect(() => {
		if (!gltfRoot || !showNormals) return;
		const helpers: VertexNormalsHelper[] = [];
		gltfRoot.traverse((object) => {
			if (object instanceof Mesh) {
				const helper = new VertexNormalsHelper(object, 0.08, 0x66ccff);
				scene.add(helper);
				helpers.push(helper);
			}
		});
		invalidate();
		return () => {
			for (const helper of helpers) {
				scene.remove(helper);
				helper.dispose();
			}
		};
	});

	$effect(() => {
		if (!controls || !usePrimitive || useGltf) return;
		void controls.setLookAt(3.2, 2.1, 3.8, 0, boxExtent / 2, 0, false);
		frameDistance = controls.distance || 5.5;
		onZoomPercent?.(100);
		invalidate();
	});
</script>

<PreviewOrbitControls
	position={[3.6, 2.4, 4.2]}
	referenceDistance={frameDistance}
	onControls={(c) => (controls = c)}
	{onZoomPercent}
/>

<T.AmbientLight intensity={0.55} />
<T.DirectionalLight position={[4, 8, 3]} intensity={1.1} castShadow />

<T.Mesh rotation.x={-Math.PI / 2} position.y={0} receiveShadow>
	<T.CircleGeometry args={[6, 64]} />
	<T.MeshStandardMaterial color={new Color('#141414')} />
</T.Mesh>

{#if useGltf}
	<T.Group position={[0, 0, 0]}>
		<GLTF
			url={meshUrl}
			position={gltfOffset}
			{meshoptDecoder}
			onload={handleGltfLoad}
			onerror={handleGltfError}
		/>
	</T.Group>
{:else if usePrimitive}
	<T.Group position={[0, boxExtent / 2, 0]}>
		<T.Mesh castShadow receiveShadow>
			{#if primitiveKind === 'capsule'}
				<T.CapsuleGeometry args={capsuleArgs} />
			{:else if primitiveKind === 'sphere'}
				<T.SphereGeometry args={[sphereR, 32, 24]} />
			{:else}
				<T.BoxGeometry args={[boxExtent, boxExtent, boxExtent]} />
			{/if}
			<T.MeshStandardMaterial
				color={new Color('#d4d4d4')}
				{wireframe}
				metalness={0.05}
				roughness={0.65}
			/>
		</T.Mesh>
	</T.Group>
{/if}
