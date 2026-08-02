/**
 * Patched @threlte/rapier init — wasm-bindgen 0.2.93+ warns on the legacy call shape;
 * suppress that one-shot noise. Init state lives on globalThis so duplicate module
 * instances (Vite path aliases) and HMR module resets never call RAPIER.init() twice.
 */
import RAPIER from '@dimforge/rapier3d-compat';

const RAPIER_INIT_DEPRECATION =
	'using deprecated parameters for the initialization function; pass a single object instead';

const GLOBAL_KEY = '__trellisRapierInit__';

type RapierInitGlobal = typeof globalThis & {
	[GLOBAL_KEY]?: {
		initialized: boolean;
		promise?: Promise<void>;
	};
};

function rapierInitState() {
	const g = globalThis as RapierInitGlobal;
	if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { initialized: false };
	return g[GLOBAL_KEY];
}

async function initOnce(): Promise<void> {
	const warn = console.warn;
	console.warn = (...args: unknown[]) => {
		if (typeof args[0] === 'string' && args[0].includes(RAPIER_INIT_DEPRECATION)) return;
		warn(...args);
	};
	try {
		// Official 0.16 API — do not pass `{}`; wasm-bindgen treats that as a bad module spec.
		await RAPIER.init();
	} finally {
		console.warn = warn;
	}
}

/** Drop-in for @threlte/rapier/dist/lib/initRapier.svelte.js */
export const initRapier = (): true | Promise<void> => {
	const state = rapierInitState();
	if (state.initialized) return true;
	if (!state.promise) {
		state.promise = initOnce().then(() => {
			state.initialized = true;
		});
	}
	return state.promise;
};

/** Optional early init before <World> mounts (same singleton as initRapier). */
export function ensureRapier(): Promise<void> {
	const result = initRapier();
	return result === true ? Promise.resolve() : result;
}
