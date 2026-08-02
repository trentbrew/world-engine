/**
 * Shared GLTFLoader setup — meshopt so compressed authored GLBs load in
 * warmRoomAssets / clip catalogs / thumbnails (Threlte MeshView uses useMeshopt).
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Mutates `loader` in place; safe to call repeatedly. */
export function configureGltfLoader(loader: GLTFLoader): GLTFLoader {
	loader.setMeshoptDecoder(MeshoptDecoder);
	return loader;
}

export function createConfiguredGltfLoader(): GLTFLoader {
	return configureGltfLoader(new GLTFLoader());
}
