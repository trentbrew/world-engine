/**
 * Local realtime relay for cross-client multiplayer dev — the Trellis fan-out
 * relay (`trellis/server`) on ws://localhost:8231/rt. Replaces PartyKit.
 *
 *   node scripts/relay.mjs      (or: pnpm dev:relay / just relay)
 *
 * Client connects via RelayTransport: ws://localhost:8231/rt/world:<room>.
 * Set VITE_RELAY_URL to a deployed sprite relay for production cross-device MP.
 *
 * Blob surface (trellis ≥ 3.2.5): content-addressed bytes at
 *   GET|HEAD|PUT http://localhost:8231/blob/:sha256
 * Vite proxies `/blob` same-origin in dev. Mesh refs: `trellis-blob:<sha256>`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRealtimeRelay } from 'trellis/server';
import { BlobStore } from 'trellis/vcs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blobDir = process.env.RELAY_BLOB_DIR ?? path.join(root, '.trellis-relay');
const port = Number(process.env.RELAY_PORT) || 8231;

const relay = await createRealtimeRelay({
	port,
	blobStore: () => new BlobStore(blobDir)
});

console.log(`Trellis realtime relay on ws://localhost:${relay.port}/rt`);
console.log(`Blob store on http://localhost:${relay.port}/blob  (${blobDir})`);

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, async () => {
		await relay.close();
		process.exit(0);
	});
}
