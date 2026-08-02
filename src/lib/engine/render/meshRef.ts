/** Mesh-reference helpers: distinguish primitive refs from loadable glTF assets. */

/** Content-addressed Trellis relay blob — `trellis-blob:<sha256-hex>`. */
const TRELLIS_BLOB_REF = /^trellis-blob:([a-f0-9]{64})$/i;

/** True when mesh is a Trellis content-addressed blob ref. */
export function isTrellisBlobMesh(mesh?: string): boolean {
	if (!mesh) return false;
	return TRELLIS_BLOB_REF.test(mesh.trim());
}

/**
 * HTTP origin for relay blob GETs (no trailing slash).
 * Dev defaults to same-origin so Vite can proxy `/blob` → relay :8231.
 */
export function relayBlobHttpOrigin(): string {
	const fromEnv =
		(typeof import.meta !== 'undefined' &&
			(import.meta.env?.VITE_RELAY_HTTP as string | undefined)) ||
		undefined;
	if (fromEnv) return fromEnv.replace(/\/$/, '');

	const relayWs =
		(typeof import.meta !== 'undefined' &&
			(import.meta.env?.VITE_RELAY_URL as string | undefined)) ||
		undefined;
	if (relayWs) {
		return relayWs
			.replace(/^ws:/i, 'http:')
			.replace(/^wss:/i, 'https:')
			.replace(/\/rt\/?$/i, '')
			.replace(/\/$/, '');
	}

	if (
		typeof import.meta !== 'undefined' &&
		import.meta.env?.DEV &&
		typeof location !== 'undefined'
	) {
		return ''; // same-origin `/blob/...` via Vite proxy
	}

	return 'http://localhost:8231';
}

/** True for missing mesh, primitive:box, or any primitive:* ref. */
export function isPrimitiveMesh(mesh?: string): boolean {
	if (!mesh) return true;
	return mesh.startsWith('primitive:');
}

/** True for local/remote .glb/.gltf URLs or Trellis blob refs (assumed glTF). */
export function isGltfMesh(mesh?: string): boolean {
	if (!mesh || isPrimitiveMesh(mesh)) return false;
	if (isTrellisBlobMesh(mesh)) return true;
	const lower = mesh.toLowerCase();
	return lower.endsWith('.glb') || lower.endsWith('.gltf');
}

/**
 * Resolve a mesh ref to a fetchable URL.
 * `trellis-blob:<sha256>` → `{origin}/blob/<sha256>` (loaders fetch HTTP).
 */
export function resolveMeshUrl(mesh: string): string {
	const trimmed = mesh.trim();
	if (!trimmed) throw new Error('Mesh URL cannot be empty');

	const blob = trimmed.match(TRELLIS_BLOB_REF);
	if (blob) {
		const hash = blob[1]!.toLowerCase();
		const origin = relayBlobHttpOrigin();
		return origin ? `${origin}/blob/${hash}` : `/blob/${hash}`;
	}

	return trimmed;
}

/** Build a durable mesh ref from a content hash returned by blob PUT / upload. */
export function trellisBlobRef(hash: string): string {
	const h = hash.trim().toLowerCase();
	if (!/^[a-f0-9]{64}$/.test(h)) {
		throw new Error(`Invalid blob hash (want 64 hex chars): ${hash}`);
	}
	return `trellis-blob:${h}`;
}
