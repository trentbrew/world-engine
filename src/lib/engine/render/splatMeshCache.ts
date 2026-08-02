/**
 * Soft-cache for Spark SplatMesh instances so era swaps reuse decoded SPZs
 * instead of dispose + full reload. Disposed only when leaving a splat world.
 */
import { SplatMesh } from '@sparkjsdev/spark';

const cache = new Map<string, SplatMesh>();
const inflight = new Map<string, Promise<SplatMesh>>();

function loadSplatMesh(url: string, onLoad?: () => void): Promise<SplatMesh> {
	const pending = inflight.get(url);
	if (pending) return pending;

	const promise = new Promise<SplatMesh>((resolve, reject) => {
		const mesh = new SplatMesh({
			url,
			onLoad: () => onLoad?.()
		});
		mesh.initialized
			.then(() => {
				inflight.delete(url);
				cache.set(url, mesh);
				resolve(mesh);
			})
			.catch((err) => {
				inflight.delete(url);
				try {
					mesh.dispose();
				} catch {
					/* worker may already be gone */
				}
				reject(err);
			});
	});
	inflight.set(url, promise);
	return promise;
}

/** Return a cached mesh or start loading. Does not dispose on src change. */
export function acquireSplatMesh(url: string, onLoad?: () => void): Promise<SplatMesh> {
	const hit = cache.get(url);
	if (hit) {
		onLoad?.();
		return Promise.resolve(hit);
	}
	return loadSplatMesh(url, onLoad);
}

/** Warm the cache for sibling era SPZs after the primary hall is ready. */
export function prefetchSplatMeshes(urls: string[], onLoad?: () => void): void {
	for (const url of urls) {
		if (!url || cache.has(url) || inflight.has(url)) continue;
		const schedule =
			typeof requestIdleCallback === 'function'
				? (fn: () => void) => requestIdleCallback(() => fn(), { timeout: 4000 })
				: (fn: () => void) => setTimeout(fn, 500);
		schedule(() => {
			void loadSplatMesh(url, onLoad).catch((err) =>
				console.warn('[splatMeshCache] prefetch failed', url, err)
			);
		});
	}
}

/** Release every cached SplatMesh (call when leaving a GaussianSplat world). */
export function clearSplatMeshCache(): void {
	for (const mesh of cache.values()) {
		try {
			mesh.parent?.remove(mesh);
			mesh.dispose();
		} catch {
			/* HMR / teardown races */
		}
	}
	cache.clear();
	inflight.clear();
}
