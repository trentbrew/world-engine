/**
 * Scene-tab settings — persisted in the world graph, localStorage, Trellis, and
 * broadcast to peers via the durable patch channel.
 */
import type { DurablePatch } from '$lib/engine/ontology/durableStore';
import { isFieldPatch } from '$lib/engine/ontology/durablePatch';
import {
	parseSceneDocument,
	SCENE_SETTINGS_COMPONENT,
	SCENE_SETTINGS_ENTITY_ID,
	SCENE_SETTINGS_FIELD,
	sceneDocumentFromEntity,
	serializeSceneDocument,
	storageKeyForWorld,
	type SceneDocument
} from '$lib/engine/scene/sceneDocument';
import { world } from '$lib/engine/runtime/world.svelte';
import { ui } from '$lib/ui/ui.svelte';

const PERSIST_MS = 250;

class SceneSettingsStore {
	#worldKey = 'lobby';
	#ready = false;
	#applyingRemote = false;
	#lastSerialized = '';
	#persistTimer = 0;

	init(worldKey: string, gameTitle?: string) {
		this.#worldKey = worldKey;
		const fromEntity = this.#readEntityDocument();
		const fromStorage = this.#readStorageDocument();
		const doc = parseSceneDocument(fromEntity ?? fromStorage, gameTitle);
		this.#applyToUi(doc);
		this.#ensureEntity(doc);
		this.#lastSerialized = serializeSceneDocument(doc);
		this.#ready = true;
		this.#writeStorage(doc);
	}

	isSceneSettingsPatch(patch: DurablePatch): boolean {
		return (
			isFieldPatch(patch) &&
			patch.entityId === SCENE_SETTINGS_ENTITY_ID &&
			patch.component === SCENE_SETTINGS_COMPONENT &&
			patch.field === SCENE_SETTINGS_FIELD
		);
	}

	applyRemotePatch(patch: DurablePatch) {
		if (!this.isSceneSettingsPatch(patch) || !isFieldPatch(patch)) return;
		const doc = parseSceneDocument(patch.value);
		this.#applyingRemote = true;
		try {
			this.#applyToUi(doc);
			this.#ensureEntity(doc);
			this.#lastSerialized = serializeSceneDocument(doc);
			this.#writeStorage(doc);
		} finally {
			this.#applyingRemote = false;
		}
	}

	captureFromUi(): SceneDocument {
		return {
			v: 1,
			scene: $state.snapshot(ui.scene),
			grid: $state.snapshot(ui.grid),
			chrome: $state.snapshot(ui.chrome),
			playCameraDefault: ui.playCameraDefault
		};
	}

	onLocalUiChange() {
		if (!this.#ready || this.#applyingRemote) return;
		const doc = this.captureFromUi();
		const serialized = serializeSceneDocument(doc);
		if (serialized === this.#lastSerialized) return;

		this.#lastSerialized = serialized;
		this.#schedulePersist(doc);
	}

	#schedulePersist(doc: SceneDocument) {
		if (typeof window === 'undefined') return;
		clearTimeout(this.#persistTimer);
		this.#persistTimer = window.setTimeout(() => this.#persist(doc), PERSIST_MS);
	}

	#persist(doc: SceneDocument) {
		this.#ensureEntity(doc);
		this.#writeStorage(doc);
		world.setField(SCENE_SETTINGS_ENTITY_ID, SCENE_SETTINGS_COMPONENT, SCENE_SETTINGS_FIELD, doc);
	}

	#readEntityDocument(): unknown {
		const entity = world.getEntity(SCENE_SETTINGS_ENTITY_ID);
		if (!entity) return null;
		return sceneDocumentFromEntity(entity);
	}

	#readStorageDocument(): unknown {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(storageKeyForWorld(this.#worldKey));
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	#writeStorage(doc: SceneDocument) {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(storageKeyForWorld(this.#worldKey), serializeSceneDocument(doc));
		} catch {
			// quota / private mode — graph + peer sync still apply
		}
	}

	#ensureEntity(doc: SceneDocument) {
		const existing = world.getEntity(SCENE_SETTINGS_ENTITY_ID);
		if (existing) {
			const bag = existing.components[SCENE_SETTINGS_COMPONENT] ?? {};
			bag[SCENE_SETTINGS_FIELD] = doc;
			existing.components[SCENE_SETTINGS_COMPONENT] = bag;
			return;
		}
		world.spawn({
			id: SCENE_SETTINGS_ENTITY_ID,
			components: {
				[SCENE_SETTINGS_COMPONENT]: {
					[SCENE_SETTINGS_FIELD]: doc
				}
			},
			raw: {}
		});
	}

	#applyToUi(doc: SceneDocument) {
		ui.scene = {
			...doc.scene,
			sky: { ...doc.scene.sky },
			groundGrid: { ...doc.scene.groundGrid },
			style: structuredClone(doc.scene.style)
		};
		ui.grid = { ...doc.grid };
		ui.chrome = { ...doc.chrome };
		ui.playCameraDefault = doc.playCameraDefault;
	}
}

export const sceneSettings = new SceneSettingsStore();
