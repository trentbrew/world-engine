/**
 * Smoke: trellis-blob mesh ref helpers (no relay required).
 *
 *   pnpm exec tsx scripts/mesh-ref-blob-smoke.ts
 */
import assert from 'node:assert/strict';
import {
	isGltfMesh,
	isPrimitiveMesh,
	isTrellisBlobMesh,
	relayBlobHttpOrigin,
	resolveMeshUrl,
	trellisBlobRef
} from '../src/lib/engine/render/meshRef.ts';

const hash = 'a'.repeat(64);
const ref = trellisBlobRef(hash);

assert.equal(ref, `trellis-blob:${hash}`);
assert.equal(isTrellisBlobMesh(ref), true);
assert.equal(isGltfMesh(ref), true);
assert.equal(isPrimitiveMesh(ref), false);

const url = resolveMeshUrl(ref);
assert.ok(url.endsWith(`/blob/${hash}`), url);
assert.equal(isGltfMesh('/models/characters/xbot.glb'), true);
assert.equal(resolveMeshUrl('/models/characters/xbot.glb'), '/models/characters/xbot.glb');
assert.equal(isPrimitiveMesh('primitive:box'), true);
assert.equal(isGltfMesh('primitive:box'), false);

assert.throws(() => trellisBlobRef('nope'));
assert.throws(() => resolveMeshUrl(''));

console.log(`ok mesh-ref-blob-smoke origin=${relayBlobHttpOrigin() || '(same-origin)'} url=${url}`);
