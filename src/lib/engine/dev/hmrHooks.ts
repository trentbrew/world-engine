import { ensureWebMcpRegistered } from '$lib/engine/agent/webmcp/register';
import { world } from '$lib/engine/runtime/world.svelte';
import { flushEditorSession, markHmrPending } from './editorSession';
import { prepareRuntimeForHmr, rehydrateRuntimeAfterHmr } from './hmrLifecycle';
import { hmrScene } from './hmrScene.svelte';
import { sceneLoading } from '$lib/ui/sceneLoading.svelte';

type ViteBeforeUpdatePayload = {
	updates?: Array<{ path: string }>;
};

/** Wire Vite HMR to session flush + soft reload UX. Call once from the shell mount. */
let hmrHooksInstalled =
	(import.meta.hot?.data.hmrHooksInstalled as boolean | undefined) ?? false;

export function installDevHmrHooks(): void {
	if (hmrHooksInstalled || !import.meta.hot || !import.meta.env.DEV) return;
	hmrHooksInstalled = true;
	if (import.meta.hot) import.meta.hot.data.hmrHooksInstalled = true;

	import.meta.hot.on('vite:beforeUpdate', (payload: ViteBeforeUpdatePayload) => {
		markHmrPending();
		flushEditorSession();
		prepareRuntimeForHmr();
		hmrScene.noteUpdates(payload.updates ?? []);
		sceneLoading.noteHmrUpdate();
	});

	import.meta.hot.on('vite:afterUpdate', () => {
		rehydrateRuntimeAfterHmr();
		if (world.status === 'ready') {
			void ensureWebMcpRegistered();
		}
	});

	import.meta.hot.dispose(() => {
		flushEditorSession();
		prepareRuntimeForHmr();
	});
}
