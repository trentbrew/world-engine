import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { museumGamesCatalogPlugin } from './src/lib/engine/gamesCatalogPlugin';

const root = path.dirname(fileURLToPath(import.meta.url));
const patchedInitRapier = path.resolve(root, 'src/lib/engine/physics/initRapier.svelte.ts');

/** Inject WebMCP origin-trial token at build when `VITE_WEBMCP_ORIGIN_TRIAL_TOKEN` is set. */
function webmcpOriginTrial(): Plugin {
	const token = process.env.VITE_WEBMCP_ORIGIN_TRIAL_TOKEN?.trim();
	return {
		name: 'webmcp-origin-trial',
		transformIndexHtml: {
			order: 'pre',
			handler(html) {
				if (!token) return html;
				const meta = `<meta http-equiv="origin-trial" content="${token}" />`;
				return html.replace('</head>', `\t\t${meta}\n\t</head>`);
			}
		}
	};
}

/** @threlte/rapier World imports initRapier via a relative path — alias alone misses it. */
function rapierInitPatch(): Plugin {
	return {
		name: 'rapier-init-patch',
		enforce: 'pre',
		resolveId(source, importer) {
			if (!source.endsWith('initRapier.svelte.js')) return;
			if (source.startsWith('@threlte/rapier') || importer?.includes('@threlte/rapier')) {
				return patchedInitRapier;
			}
		}
	};
}

export default defineConfig({
	plugins: [
		webmcpOriginTrial(),
		rapierInitPatch(),
		museumGamesCatalogPlugin(root),
		tailwindcss(),
		sveltekit()
	],
	optimizeDeps: {
		// Keep initRapier.svelte.js as a separate module so rapierInitPatch() can swap it.
		exclude: ['@threlte/rapier']
	},
	resolve: {
		alias: {
			'@threlte/rapier/dist/lib/initRapier.svelte.js': patchedInitRapier
		}
	},
	server: {
		port: Number(process.env.VITE_PORT ?? 9292),
		// Nuxt (and other Vite apps) default HMR to :24678 — when that port is taken,
		// SvelteKit SSR's fetchModule transport hangs until a 60s timeout (blank/500 load).
		hmr: { port: Number(process.env.VITE_HMR_PORT ?? 9293) },
		// Trellis writes ops/blobs here continuously; without this the dev watcher
		// (and the preview harness, which merges this config) full-reloads in a loop.
		watch: { ignored: ['**/.trellis/**'] },
		// Same-origin proxy to the Trellis durable server (default :8230). Routing
		// through Vite avoids CORS — the TrellisDb client sends an `x-trellis-transport`
		// header that the server's cross-origin allow-list rejects. ws:true carries the
		// /realtime subscription socket too.
		proxy: {
			'/trellis-db': {
				target: process.env.TRELLIS_DB_URL ?? 'http://localhost:8230',
				changeOrigin: true,
				ws: true,
				rewrite: (path) => path.replace(/^\/trellis-db/, '')
			},
			// Same-origin relay proxy — cross-browser/LAN clients use ws://<host>/relay
			// instead of ws://localhost:8231 (which only works on the dev machine).
			'/relay': {
				target: `http://localhost:${process.env.RELAY_PORT ?? '8231'}`,
				changeOrigin: true,
				ws: true,
				rewrite: (path) => path.replace(/^\/relay/, '/rt')
			},
			// Content-addressed mesh/asset bytes (trellis ≥ 3.2.5 blob surface).
			'/blob': {
				target: `http://localhost:${process.env.RELAY_PORT ?? '8231'}`,
				changeOrigin: true
			}
		}
	}
});
