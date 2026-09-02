/** Renders glTF assets to a cached PNG data URL for the asset library grid. */

import { resolveAssetUrl } from '$lib/engine/render/meshRef';

const CACHE_VERSION = 2;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(url: string): string {
	return `${url}@v${CACHE_VERSION}`;
}

export function peekModelThumbnail(url: string): string | null {
	return cache.get(cacheKey(url)) ?? null;
}

export async function loadModelThumbnail(url: string, size = 96): Promise<string | null> {
	const key = cacheKey(url);
	const cached = cache.get(key);
	if (cached) return cached;

	let pending = inflight.get(key);
	if (!pending) {
		pending = renderThumbnail(url, size);
		inflight.set(key, pending);
	}

	const result = await pending;
	inflight.delete(key);
	if (result) cache.set(key, result);
	return result;
}

async function renderThumbnail(url: string, size: number): Promise<string | null> {
	if (typeof window === 'undefined') return null;

	try {
		const THREE = await import('three');
		const { createConfiguredGltfLoader } = await import('$lib/engine/render/configureGltfLoader');

		const scene = new THREE.Scene();
		scene.background = new THREE.Color('#1c1c1c');

		const ambient = new THREE.AmbientLight(0xffffff, 0.65);
		const key = new THREE.DirectionalLight(0xffffff, 1.4);
		key.position.set(2, 3, 4);
		const fill = new THREE.DirectionalLight(0xffffff, 0.45);
		fill.position.set(-2, 1, -1);
		scene.add(ambient, key, fill);

		const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
		renderer.setSize(size, size);
		renderer.setPixelRatio(1);

		const gltf = await createConfiguredGltfLoader().loadAsync(resolveAssetUrl(url));
		const box = new THREE.Box3().setFromObject(gltf.scene);
		const center = box.getCenter(new THREE.Vector3());
		const dimensions = box.getSize(new THREE.Vector3());
		gltf.scene.position.sub(center);
		scene.add(gltf.scene);

		const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
		const fovRad = (camera.fov * Math.PI) / 180;
		const fitDistance = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.35;
		const viewDir = new THREE.Vector3(0.85, 0.65, 1.1).normalize();
		camera.position.copy(viewDir.multiplyScalar(fitDistance));
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();

		renderer.render(scene, camera);
		const dataUrl = renderer.domElement.toDataURL('image/png');

		renderer.dispose();
		gltf.scene.traverse((object) => {
			if ('geometry' in object && object.geometry) {
				(object.geometry as { dispose?: () => void }).dispose?.();
			}
			if ('material' in object && object.material) {
				const material = object.material;
				if (Array.isArray(material)) material.forEach((entry) => entry.dispose?.());
				else (material as { dispose?: () => void }).dispose?.();
			}
		});

		return dataUrl;
	} catch {
		return null;
	}
}
