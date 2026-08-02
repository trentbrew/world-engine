/**
 * Smoke: trellis 3.2.5 relay blob surface — PUT → GET round-trip + mesh ref resolve.
 *
 *   node scripts/relay-blob-smoke.mjs
 *
 * Spins an ephemeral relay (port 0); does not touch the long-lived :8231 process.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBlobClient } from 'trellis/realtime';
import { createRealtimeRelay } from 'trellis/server';
import { BlobStore } from 'trellis/vcs';

const blobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trellis-relay-blob-'));
const relay = await createRealtimeRelay({
	port: 0,
	hostname: '127.0.0.1',
	blobStore: () => new BlobStore(blobDir)
});

const baseUrl = `http://127.0.0.1:${relay.port}`;
const client = createBlobClient({ baseUrl, verify: true });

try {
	const payload = new TextEncoder().encode('trellis-blob-smoke-glb-bytes');
	const hash = await client.put(payload, {
		name: 'smoke.glb',
		contentType: 'model/gltf-binary'
	});
	assert.match(hash, /^[a-f0-9]{64}$/);

	assert.equal(await client.has(hash), true);
	const got = await client.get(hash);
	assert.ok(got);
	assert.equal(Buffer.from(got).equals(Buffer.from(payload)), true);

	// meshRef resolve (tsx-free: inline the same mapping the engine uses)
	const ref = `trellis-blob:${hash}`;
	const url = `${baseUrl}/blob/${hash}`;
	assert.equal(ref.replace(/^trellis-blob:/, `${baseUrl}/blob/`), url);

	const res = await fetch(url);
	assert.equal(res.status, 200);
	assert.equal(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(payload)), true);

	console.log(`ok relay-blob-smoke port=${relay.port} hash=${hash.slice(0, 12)}…`);
} finally {
	await relay.close();
	fs.rmSync(blobDir, { recursive: true, force: true });
}
