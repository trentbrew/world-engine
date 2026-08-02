/**
 * Editor viewer session persistence — orbit pose, zoom, and selection survive
 * page reloads and (in dev) Vite HMR remounts.
 */
import { followCamera } from '$lib/engine/player/followCamera.svelte';
import { camera } from '$lib/engine/render/camera.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import {
	ui,
	type RailRoute,
	type RoomsPaneTab,
	type WorkbenchResource
} from '$lib/ui/ui.svelte';
import type { Entity } from '$lib/engine/ontology/schema';
import { playerClientId } from '$lib/engine/player/access';
import { flushWorldFilePatches } from '$lib/engine/authoring/worldFileAuthor';

const STORAGE_PREFIX = 'editor-session:';
const HMR_PENDING_KEY = 'editor-hmr-pending';
const SESSION_VERSION = 1;

export type OrbitCameraSnapshot = {
	position: [number, number, number];
	target: [number, number, number];
	zoom?: number;
};

export type TransformLayoutSnapshot = {
	position?: [number, number, number];
	rotation?: [number, number, number, number];
	scale?: [number, number, number];
};

type EditorNavigationSnapshot = {
	railRoute: RailRoute;
	roomsPaneTab: RoomsPaneTab;
	workbenchResource: WorkbenchResource;
	objectTarget: string | null;
	selectedObjectType: string | null;
	collectionsCollection: string | null;
	collectionsRecord: string | null;
};

type EditorSessionData = {
	v: typeof SESSION_VERSION;
	selection: string | null;
	cameraMode: 'orbit' | 'follow';
	projection: 'perspective' | 'orthographic';
	orbit: OrbitCameraSnapshot | null;
	entityTransforms: Record<string, TransformLayoutSnapshot>;
	playerLayouts: Record<string, TransformLayoutSnapshot>;
	followYaw: number;
	followPitch: number;
	navigation: EditorNavigationSnapshot;
};

type OrbitCapture = () => OrbitCameraSnapshot | null;

let currentWorldKey = 'lobby';
let softReload = false;
let cached: EditorSessionData | null = null;
let orbitCapture: OrbitCapture | null = null;
let removeSelectionListener: (() => void) | null = null;

export const LOCAL_PLAYER_LAYOUT_KEY = '__local__';

function captureNavigationState(): EditorNavigationSnapshot {
	return {
		railRoute: ui.railRoute,
		roomsPaneTab: ui.roomsPaneTab,
		workbenchResource: ui.workbenchResource,
		objectTarget: ui.objectTarget,
		selectedObjectType: ui.selectedObjectType,
		collectionsCollection: ui.collectionsCollection,
		collectionsRecord: ui.collectionsRecord
	};
}

function defaultNavigationState(): EditorNavigationSnapshot {
	return {
		railRoute: 'rooms',
		roomsPaneTab: 'instances',
		workbenchResource: 'objects',
		objectTarget: null,
		selectedObjectType: null,
		collectionsCollection: null,
		collectionsRecord: null
	};
}

function defaultSession(): EditorSessionData {
	return {
		v: SESSION_VERSION,
		selection: null,
		cameraMode: 'orbit',
		projection: 'perspective',
		orbit: null,
		entityTransforms: {},
		playerLayouts: {},
		followYaw: followCamera.yaw,
		followPitch: followCamera.pitch,
		navigation: defaultNavigationState()
	};
}

function storageKey(worldKey = currentWorldKey): string {
	return `${STORAGE_PREFIX}${worldKey}`;
}

function readSession(worldKey: string): EditorSessionData | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(storageKey(worldKey));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<EditorSessionData>;
		if (parsed.v !== SESSION_VERSION) return null;
		return { ...defaultSession(), ...parsed };
	} catch {
		return null;
	}
}

function canPersistSession(): boolean {
	return typeof sessionStorage !== 'undefined';
}

function writeSession(patch: Partial<EditorSessionData>, worldKey = currentWorldKey): void {
	if (!canPersistSession()) return;
	const next: EditorSessionData = {
		...(cached ?? readSession(worldKey) ?? defaultSession()),
		...patch,
		v: SESSION_VERSION
	};
	cached = next;
	sessionStorage.setItem(storageKey(worldKey), JSON.stringify(next));
}

export function isDevSessionEnabled(): boolean {
	return import.meta.env.DEV;
}

/** True for one mount cycle after a Vite HMR update (not a cold tab load). */
export function isSoftReload(): boolean {
	return softReload;
}

export function markHmrPending(): void {
	if (!isDevSessionEnabled() || typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(HMR_PENDING_KEY, '1');
}

/** True while a Vite HMR swap is in flight (before the next mount consumes the flag). */
export function isHmrTeardown(): boolean {
	if (!isDevSessionEnabled() || typeof sessionStorage === 'undefined') return false;
	return sessionStorage.getItem(HMR_PENDING_KEY) === '1';
}

function consumeSoftReloadFlag(): boolean {
	if (!isDevSessionEnabled() || typeof sessionStorage === 'undefined') return false;
	const pending = sessionStorage.getItem(HMR_PENDING_KEY) === '1';
	if (pending) sessionStorage.removeItem(HMR_PENDING_KEY);
	return pending;
}

export function initEditorSession(worldKey: string): void {
	if (!canPersistSession()) return;
	currentWorldKey = worldKey;
	softReload = consumeSoftReloadFlag();
	cached = readSession(worldKey);
}

export function registerOrbitCapture(capture: OrbitCapture | null): void {
	orbitCapture = capture;
}

export function flushEditorSession(): void {
	if (!canPersistSession()) return;
	const orbit =
		ui.shellMode === 'edit'
			? (orbitCapture?.() ?? cached?.orbit ?? null)
			: (cached?.orbit ?? null);
	writeSession({
		selection: world.selection,
		cameraMode: camera.mode,
		projection: camera.projection,
		orbit,
		followYaw: followCamera.yaw,
		followPitch: followCamera.pitch,
		navigation: captureNavigationState()
	});
}

export function saveSelection(selection: string | null): void {
	if (!canPersistSession()) return;
	writeSession({ selection });
}

export function saveOrbit(orbit: OrbitCameraSnapshot | null): void {
	if (!canPersistSession()) return;
	writeSession({ orbit });
}

export function savePlayerLayout(
	clientId: string,
	patch: TransformLayoutSnapshot
): void {
	if (!canPersistSession() || !clientId) return;
	const data = cached ?? readSession(currentWorldKey);
	const layouts = { ...(data?.playerLayouts ?? {}) };
	layouts[clientId] = { ...(layouts[clientId] ?? {}), ...patch };
	writeSession({ playerLayouts: layouts });
}

export function saveLocalPlayerLayout(patch: TransformLayoutSnapshot): void {
	savePlayerLayout(LOCAL_PLAYER_LAYOUT_KEY, patch);
}

export function saveEntityTransform(entityId: string, patch: TransformLayoutSnapshot): void {
	if (!canPersistSession() || !entityId) return;
	const data = cached ?? readSession(currentWorldKey);
	const transforms = { ...(data?.entityTransforms ?? {}) };
	transforms[entityId] = { ...(transforms[entityId] ?? {}), ...patch };
	writeSession({ entityTransforms: transforms });
}

export function peekPlayerLayout(clientId: string): TransformLayoutSnapshot | null {
	if (!canPersistSession() || !clientId) return null;
	return (cached ?? readSession(currentWorldKey))?.playerLayouts?.[clientId] ?? null;
}

function applyTransformSnapshot(entity: Entity, snapshot: TransformLayoutSnapshot | null): void {
	if (!snapshot) return;
	const bag = entity.components.Transform;
	if (!bag) return;
	if (snapshot.position) bag.position = [...snapshot.position];
	if (snapshot.rotation) bag.rotation = [...snapshot.rotation];
	if (snapshot.scale) bag.scale = [...snapshot.scale];
}

export function applyEntityTransformSnapshots(entities: Entity[]): void {
	if (!canPersistSession()) return;
	const snapshots = (cached ?? readSession(currentWorldKey))?.entityTransforms;
	if (!snapshots) return;

	for (const entity of entities) {
		applyTransformSnapshot(entity, snapshots[entity.id] ?? null);
	}
}

/** Apply a saved edit-mode layout to a freshly spawned player entity. */
export function applyPlayerLayout(entity: Entity, layoutKey?: string): void {
	const clientId = layoutKey ?? playerClientId(entity);
	if (!clientId) return;
	applyTransformSnapshot(entity, peekPlayerLayout(clientId));
}

/** Re-apply bottom-dock route + pane tabs after ui module resets (HMR). */
export function restoreEditorNavigation(): void {
	if (!canPersistSession() || ui.shellMode !== 'edit') return;
	const data = cached ?? readSession(currentWorldKey);
	if (!data) return;

	const nav = { ...defaultNavigationState(), ...data.navigation };
	ui.railRoute = nav.railRoute;
	const tab = nav.roomsPaneTab as string;
	ui.roomsPaneTab =
		tab === 'room' || tab === 'instances' || tab === 'objects' ? tab : 'instances';
	ui.workbenchResource = nav.workbenchResource;
	ui.selectedObjectType = nav.selectedObjectType;

	if (nav.collectionsCollection) {
		ui.collectionsCollection = nav.collectionsCollection;
		ui.collectionsRecord = nav.collectionsRecord;
	}

	if (nav.railRoute === 'object') {
		if (nav.objectTarget && world.getEntity(nav.objectTarget)) {
			ui.objectTarget = nav.objectTarget;
		} else {
			ui.objectTarget = null;
			ui.railRoute = 'rooms';
		}
	} else {
		ui.objectTarget = nav.objectTarget;
	}
}

export function restoreViewerState(): string | null {
	if (!canPersistSession()) return null;
	const data = cached ?? readSession(currentWorldKey);
	if (!data) return null;
	cached = data;

	if (!worldProfile.is2d) {
		camera.setMode(data.cameraMode);
		camera.projection = data.projection;
	}
	followCamera.yaw = data.followYaw;
	followCamera.pitch = data.followPitch;
	restoreEditorNavigation();

	return data.selection;
}

export function peekOrbitRestore(): OrbitCameraSnapshot | null {
	if (!canPersistSession()) return null;
	return (cached ?? readSession(currentWorldKey))?.orbit ?? null;
}

export function bindEditorSession(worldKey: string): () => void {
	if (!canPersistSession()) return () => {};

	initEditorSession(worldKey);
	removeSelectionListener?.();
	removeSelectionListener = world.onSelectionChange((selection) => {
		saveSelection(selection);
	});

	const onPageHide = () => {
		flushEditorSession();
		void flushWorldFilePatches();
	};
	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') onPageHide();
	};
	window.addEventListener('pagehide', onPageHide);
	document.addEventListener('visibilitychange', onVisibilityChange);

	return () => {
		removeSelectionListener?.();
		removeSelectionListener = null;
		window.removeEventListener('pagehide', onPageHide);
		document.removeEventListener('visibilitychange', onVisibilityChange);
		flushEditorSession();
		void flushWorldFilePatches();
		registerOrbitCapture(null);
	};
}
