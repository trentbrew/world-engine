#!/usr/bin/env node
/**
 * Run a TypeScript module through Vite SSR so Svelte/runest imports resolve.
 * Usage: node scripts/run-with-vite.mjs scripts/agent-room.ts [-- args...]
 */
import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const entry = process.argv[2];

if (!entry) {
	console.error('Usage: node scripts/run-with-vite.mjs <entry.ts> [-- args...]');
	process.exit(1);
}

const dash = process.argv.indexOf('--');
if (dash !== -1) {
	process.argv = [process.argv[0], process.argv[1], ...process.argv.slice(dash + 1)];
}

const server = await createServer({
	root,
	configFile: resolve(root, 'vite.config.ts'),
	server: { middlewareMode: true },
	appType: 'custom',
	optimizeDeps: {
		entries: []
	}
});

try {
	const modPath = resolve(root, entry);
	const mod = await server.ssrLoadModule(pathToFileURL(modPath).href);
	if (typeof mod.default === 'function') {
		await mod.default();
	}
} finally {
	await server.close();
}
