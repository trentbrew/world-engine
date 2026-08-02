import type { DurablePatch, DurableStore } from '$lib/engine/ontology/durableStore';
import { isFieldPatch } from '$lib/engine/ontology/durablePatch';
import { applyDurableMutation } from '$lib/engine/runtime/applyMutation';
import { world } from '$lib/engine/runtime/world.svelte';

class DurableSession {
	mode = $state<'static' | 'trellis'>('static');
	connected = $state(false);
}

export const durableSession = new DurableSession();

let unsubscribeSync: (() => void) | null = null;

/** Apply a remote durable patch without writing back to Trellis. */
export function applyDurablePatch(patch: DurablePatch) {
	world.applyingRemoteDurable = true;
	try {
		applyDurableMutation(patch);
	} finally {
		world.applyingRemoteDurable = false;
	}
}

/** Subscribe to durable graph updates from Trellis. */
export function connectDurableSync(store: DurableStore, worldId: string) {
	disconnectDurableSync();
	if (!store.subscribe) return;
	unsubscribeSync = store.subscribe(worldId, (patches) => {
		for (const patch of patches) applyDurablePatch(patch);
	});
}

export function disconnectDurableSync() {
	unsubscribeSync?.();
	unsubscribeSync = null;
	durableSession.connected = false;
}
