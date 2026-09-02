import type { DurablePatch, DurableStore } from '$lib/engine/ontology/durableStore';
import { isFieldPatch, patchKind } from '$lib/engine/ontology/durablePatch';
import {
	SCENE_SETTINGS_COMPONENT,
	SCENE_SETTINGS_ENTITY_ID,
	SCENE_SETTINGS_FIELD
} from '$lib/engine/scene/sceneConstants';
import { applyDurableMutation } from '$lib/engine/runtime/applyMutation';
import { world } from '$lib/engine/runtime/world.svelte';

const MAX_OPS = 50;
const DEDUPE_MS = 100;

export type DurableOpEntry = {
	id: string;
	kind: ReturnType<typeof patchKind>;
	entityId: string;
	component?: string;
	field?: string;
	value?: unknown;
	at: number;
};

class DurableSession {
	mode = $state<'static' | 'trellis'>('static');
	connected = $state(false);
	ops = $state<DurableOpEntry[]>([]);
}

export const durableSession = new DurableSession();

let unsubscribeSync: (() => void) | null = null;
let lastOfflineToastAt = 0;
const OFFLINE_TOAST_MS = 12_000;

/** Debounced user notice when Trellis is down but local + peer sync still work. */
export function notifyDurableOffline() {
	const now = Date.now();
	if (now - lastOfflineToastAt < OFFLINE_TOAST_MS) return;
	lastOfflineToastAt = now;
	durableSession.connected = false;
	import('svelte-sonner').then(({ toast }) => {
		toast.warning(
			'Trellis offline — edits apply locally and sync to peers, but will not persist until the server is running'
		);
	});
}

function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function isSceneSettingsPatch(patch: DurablePatch): boolean {
	return (
		isFieldPatch(patch) &&
		patch.entityId === SCENE_SETTINGS_ENTITY_ID &&
		patch.component === SCENE_SETTINGS_COMPONENT &&
		patch.field === SCENE_SETTINGS_FIELD
	);
}

type SceneSettingsStore = {
	isSceneSettingsPatch(patch: DurablePatch): boolean;
	applyRemotePatch(patch: DurablePatch): void;
};

let sceneSettingsStore: SceneSettingsStore | null = null;
if (typeof window !== 'undefined') {
	void import('$lib/engine/scene/sceneSettings.svelte').then(({ sceneSettings }) => {
		sceneSettingsStore = sceneSettings;
	});
}

/** Append a durable op to the in-memory ring buffer (newest first). */
export function recordDurableOp(patch: DurablePatch) {
	const kind = patchKind(patch);
	const head = durableSession.ops[0];
	const now = Date.now();
	if (
		kind === 'setField' &&
		isFieldPatch(patch) &&
		head &&
		head.kind === 'setField' &&
		head.entityId === patch.entityId &&
		head.component === patch.component &&
		head.field === patch.field &&
		sameValue(head.value, patch.value) &&
		now - head.at < DEDUPE_MS
	) {
		return;
	}

	const entry: DurableOpEntry = {
		id: crypto.randomUUID(),
		kind,
		entityId:
			'entityId' in patch
				? patch.entityId
				: kind === 'defineType' && 'applyToEntityId' in patch && patch.applyToEntityId
					? patch.applyToEntityId
					: kind === 'defineType' && 'name' in patch
						? `type:${patch.name}`
						: '',
		at: now
	};

	if (kind === 'setField' && isFieldPatch(patch)) {
		entry.component = patch.component;
		entry.field = patch.field;
		entry.value = patch.value;
	} else if (kind === 'setComponent' && 'bag' in patch) {
		entry.component = patch.component;
		entry.value = patch.bag;
	} else if (kind === 'removeComponent' && 'component' in patch) {
		entry.component = patch.component;
	} else if (patch.kind === 'defineType') {
		entry.value = { name: patch.name, components: patch.components.length };
	} else if (patch.kind === 'defineComponent') {
		entry.entityId = `component:${patch.name}`;
		entry.value = { name: patch.name, fields: Object.keys(patch.fields).length };
	}

	durableSession.ops = [entry, ...durableSession.ops].slice(0, MAX_OPS);
}

/** Apply a remote durable patch without writing back to Trellis. */
export function applyDurablePatch(patch: DurablePatch) {
	if (isSceneSettingsPatch(patch)) {
		if (sceneSettingsStore) {
			sceneSettingsStore.applyRemotePatch(patch);
		}
		return;
	}
	world.applyingRemoteDurable = true;
	try {
		applyDurableMutation(patch);
	} finally {
		world.applyingRemoteDurable = false;
	}
}

/** Apply a cross-peer player Transform edit from the wire. */
export function applyAuthoringPatch(patch: DurablePatch) {
	if (!isFieldPatch(patch)) return;
	world.applyingRemoteAuthoring = true;
	try {
		world.applyFieldLocal(patch.entityId, patch.component, patch.field, patch.value);
	} finally {
		world.applyingRemoteAuthoring = false;
	}
}

/** Subscribe to durable graph updates from Trellis. */
export function connectDurableSync(store: DurableStore, worldId: string) {
	disconnectDurableSync();
	if (!store.subscribe) return;
	unsubscribeSync = store.subscribe(worldId, (patches) => {
		for (const patch of patches) {
			applyDurablePatch(patch);
			recordDurableOp(patch);
		}
	});
}

export function disconnectDurableSync() {
	unsubscribeSync?.();
	unsubscribeSync = null;
	durableSession.connected = false;
}
