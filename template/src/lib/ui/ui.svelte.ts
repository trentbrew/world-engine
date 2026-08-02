/** Ephemeral UI chrome state (dialogs, panels, play mode). */

import { camera } from '$lib/engine/render/camera.svelte';
import { followCamera } from '$lib/engine/player/followCamera.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { syncShellModeToUrl } from '$lib/engine/shellUrl';
import { primePlayMenuButtons } from '$lib/engine/player/gamepad.svelte';
import { reconcilePlayerSpawnPositions } from '$lib/engine/player/spawnPoints';
import { session } from '$lib/engine/net/session.svelte';
import {
	bootstrapFormulas,
	pauseSimulation,
	resumeSimulation,
	startSimulation,
	stopSimulation
} from '$lib/engine/systems';
import { scheduler } from '$lib/engine/systems/scheduler.svelte';
import { resetJumpInputState } from '$lib/engine/systems/behaviors/jump';
import { score } from '$lib/engine/game/score.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { warmAdjacentRoomAssets } from '$lib/engine/room/warmRoomAssets';
import type { SkyPresetId } from '$lib/scene/skyPresets';
import {
	cancelPlacement,
	clearPlacement,
	type PlacementDraft
} from '$lib/scene/placementSession';
import type { OrbitCameraSnapshot } from '$lib/engine/dev/editorSession';
import {
	captureEditCameraSnapshot,
	resetPlayCameraRig,
	restoreEditCameraSnapshot
} from '$lib/scene/playEditCamera';
import { playResetFx } from '$lib/ui/playResetFx.svelte';
import {
	defaultSceneStyle,
	sceneStyleFromPreset,
	type ArtStyleId,
	type SceneStyle
} from '$lib/scene/artStyles';
import { assetPreview } from '$lib/ui/assetPreview.svelte';
import {
	shellNavHistory,
	type ShellNavFrame
} from '$lib/ui/shellNavHistory.svelte';

export type { PlacementDraft } from '$lib/scene/placementSession';

export type { ArtStyleId, SceneStyle } from '$lib/scene/artStyles';

import type { AssetEntry, AssetKind } from '$lib/assets/catalog';
import type { ShapeEntry } from '$lib/assets/shapes';
import {
	assetRouteForSection,
	isAssetRoute,
	type AssetRoute
} from '$lib/ui/assetRoutes';

export type AssetsSection = 'shapes' | AssetKind;

/** Right-pane tabs on asset resource routes. */
export type AssetInspectorTab = 'inspector' | 'animations' | 'details';

/** Room-editor views in the left pane (Rooms world route only). */
export type RoomsPaneTab = 'room' | 'instances' | 'objects';
/** @deprecated use RoomsPaneTab */
export type LeftTab = RoomsPaneTab;
/** World-level routes in the bottom dock (+ instance editor). */
export type WorldRoute =
	| 'rooms'
	| 'objects'
	| 'models'
	| 'textures'
	| 'audio'
	| 'files'
	| 'collections'
	| 'graph'
	| 'controls'
	| 'config';
export type RailRoute = WorldRoute | 'object';
export type ObjectLeftTab = 'clips' | 'structure';
/** Objects-route right inspector tabs (type authoring). */
export type ObjectInspectorTab = 'properties' | 'events' | 'schedule' | 'clip';
export type WorkbenchResource =
	| 'rooms'
	| 'objects'
	| 'sprites'
	| 'events'
	| 'scripts'
	| 'assets'
	| 'settings';
export type RightInspectorTab = 'properties' | 'ops' | 'json';
export type ShellMode = 'edit' | 'play' | 'publish';
export type SettingsTab = 'input' | 'camera' | 'shell';

export type SkyConfig = {
	enabled: boolean;
	preset: SkyPresetId;
	setEnvironment: boolean;
};

export type GroundGridConfig = {
	enabled: boolean;
	cellSize: number;
	sectionSize: number;
	cellColor: string;
	sectionColor: string;
};

export type SceneSettings = {
	displayName: string;
	background: string;
	shadows: boolean;
	sky: SkyConfig;
	groundGrid: GroundGridConfig;
	style: SceneStyle;
};

export type AssetPickTarget =
	| {
		entityId: string;
		component: string;
		field: string;
	}
	| {
		typeName: string;
		component: string;
		field: string;
	};

export type ChromeToggles = {
	grid: boolean;
	selectionOutline: boolean;
	statsHud: boolean;
	/** Bottom-center Pause/Reset pill in play mode. Off by default — Esc/P/R + gamepad still work. */
	playToolbar: boolean;
};

/** Scene-level config for the editor reference grid (@threlte/extras <Grid>). */
export type GridConfig = {
	cellSize: number;
	sectionSize: number;
	fadeDistance: number;
	infinite: boolean;
	cellColor: string;
	sectionColor: string;
};

export const DEFAULT_GROUND_GRID: GroundGridConfig = {
	enabled: false,
	cellSize: 1,
	sectionSize: 5,
	cellColor: '#262626',
	sectionColor: '#404040'
};

export const DEFAULT_SCENE: SceneSettings = {
	displayName: 'Scene',
	background: '#0a0a0a',
	shadows: true,
	sky: {
		enabled: false,
		preset: 'afternoon',
		setEnvironment: true
	},
	groundGrid: { ...DEFAULT_GROUND_GRID },
	style: defaultSceneStyle()
};

export const DEFAULT_GRID: GridConfig = {
	cellSize: 1,
	sectionSize: 10,
	fadeDistance: 100,
	infinite: true,
	cellColor: '#1a1a1a',
	sectionColor: '#2a2a2a'
};

type ChromeSnapshot = {
	roomsPaneTab: RoomsPaneTab;
	workbenchResource: WorkbenchResource;
	chrome: ChromeToggles;
	cameraMode: 'orbit' | 'follow';
	settingsTab: SettingsTab;
	orbit: OrbitCameraSnapshot | null;
};

export type PreviewContext =
	| { kind: 'asset'; asset: AssetEntry }
	| { kind: 'shape'; shape: ShapeEntry };

function cloneChrome(chrome: ChromeToggles): ChromeToggles {
	return { ...chrome };
}

const PANEL_MIN_WIDTH = 240;
const PANEL_MAX_WIDTH = 560;
const BOTTOM_PANE_COLLAPSED = 48;
const BOTTOM_PANE_MIN_HEIGHT = 36;
const BOTTOM_PANE_MAX_HEIGHT = 400;
/** Matches `--float-inset` in app.css — viewport chrome padding from shell edges. */
export const VIEWPORT_FLOAT_INSET = 12;
export const CHROME_FLOAT_GAP = 6;
/** Inner rail card width (px). */
export const RAIL_CARD_WIDTH = 56;
/** Outer left rail column — docked flush to the left edge. */
export const RAIL_WIDTH = RAIL_CARD_WIDTH;
/** Bottom-docked rail band thickness (px) — matches card width. */
export const RAIL_HEIGHT = RAIL_CARD_WIDTH;

export type RailPosition = 'left' | 'bottom';

const RAIL_POSITION_KEY = 'playlab:rail-position';

function loadRailPosition(): RailPosition {
	if (typeof localStorage === 'undefined') return 'left';
	try {
		return localStorage.getItem(RAIL_POSITION_KEY) === 'bottom' ? 'bottom' : 'left';
	} catch {
		return 'left';
	}
}

function persistRailPosition(position: RailPosition): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(RAIL_POSITION_KEY, position);
}

function clampPanelWidth(width: number): number {
	return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width)));
}

function clampBottomHeight(height: number): number {
	return Math.min(BOTTOM_PANE_MAX_HEIGHT, Math.max(BOTTOM_PANE_MIN_HEIGHT, Math.round(height)));
}

class UIState {
	/** Skip history recording while applying back/forward or compound nav. */
	suppressNavRecord = false;
	addEntityOpen = $state(false);
	saveTypeOpen = $state(false);
	saveTypeEntityId = $state<string | null>(null);
	/** Selected object type in the Objects route (type authoring). */
	selectedObjectType = $state<string | null>(null);
	newObjectTypeOpen = $state(false);
	newObjectTypeCloneFrom = $state<string | null>(null);
	shellMode = $state<ShellMode>('edit');
	playPaused = $state(false);
	sidebarsVisible = $state(true);
	leftPanelWidth = $state(320);
	rightPanelWidth = $state(320);
	roomsPaneTab = $state<RoomsPaneTab>('instances');
	/** @deprecated use roomsPaneTab */
	get leftTab(): RoomsPaneTab {
		return this.roomsPaneTab;
	}
	set leftTab(tab: RoomsPaneTab) {
		this.roomsPaneTab = tab;
	}
	workbenchResource = $state<WorkbenchResource>('objects');
	/** Active world route (bottom dock). Default: room level editor. */
	railRoute = $state<RailRoute>('rooms');
	/** World navigation rail — vertical left edge or horizontal bottom dock. */
	railPosition = $state<RailPosition>(loadRailPosition());
	/** Bump to request focus on the object search field (LeftPanel). */
	objectSearchFocusRequest = $state(0);
	/** Bump to focus Rooms → Objects catalog search (Add object). */
	objectsCatalogSearchFocusRequest = $state(0);
	/** Entity the Object context edits in isolation (set via editObject). */
	objectTarget = $state<string | null>(null);
	objectLeftTab = $state<ObjectLeftTab>('clips');
	/** Objects-route right inspector: Properties / Events / Schedule / Clip. */
	objectInspectorTab = $state<ObjectInspectorTab>('properties');
	/** Local clip override for Objects/Object preview (builtins can't setTypeDefault). */
	previewAnimClip = $state<string | null>(null);
	/** Local preview playback on the Object / Objects stage (not written to world). */
	objectPreviewPlaying = $state(true);
	/** Preview mixer clock (seconds) — written by SkinnedMeshView on object stages. */
	previewAnimTime = $state(0);
	previewAnimDuration = $state(0);
	/** When set, SkinnedMeshView seeks the active action to this time (seconds). */
	previewAnimSeek = $state<number | null>(null);

	seekPreviewAnim(time: number) {
		this.previewAnimSeek = Math.max(0, time);
		this.previewAnimTime = this.previewAnimSeek;
	}

	clearPreviewAnimSeek() {
		this.previewAnimSeek = null;
	}
	/** Collections route selection — the active collection and record being edited. */
	collectionsCollection = $state<string | null>(null);
	collectionsRecord = $state<string | null>(null);
	selectCollection(collection: string | null) {
		this.collectionsCollection = collection;
		this.collectionsRecord = null;
	}
	selectRecord(recordId: string | null) {
		this.collectionsRecord = recordId;
	}
	/** Bumped when a schema field/component is added, so column views recompute.
	 * (Bridges a gap where world.componentRevision doesn't reliably re-trigger
	 * table `$derived` columns; ui state reactivity is proven in those views.) */
	schemaRevision = $state(0);
	bumpSchemaRevision() {
		this.schemaRevision += 1;
	}
	entityInspectorTab = $state<RightInspectorTab>('properties');
	/** When true, Rooms inspector shows Props / Ops / JSON tabs. Default off — props only. */
	inspectorTabsVisible = $state(false);
	/** Edit-mode decorative "drone" frame (DeviceHud). Flagged off by default — keep code mounted. */
	deviceHudVisible = $state(false);
	chrome = $state<ChromeToggles>({
		grid: true,
		selectionOutline: true,
		statsHud: true,
		playToolbar: false
	});
	scene = $state<SceneSettings>({
		...DEFAULT_SCENE,
		groundGrid: { ...DEFAULT_GROUND_GRID },
		style: defaultSceneStyle()
	});
	grid = $state<GridConfig>({ ...DEFAULT_GRID });
	settingsTab = $state<SettingsTab>('input');
	playCameraDefault = $state<'follow' | 'orbit'>('follow');
	assetPickTarget = $state<AssetPickTarget | null>(null);
	/** @deprecated Rail route is the section; use setRoute('models') etc. */
	assetsSection = $state<AssetsSection>('shapes');
	assetInspectorTab = $state<AssetInspectorTab>('animations');
	previewContext = $state<PreviewContext | null>(null);
	placementDraft = $state<PlacementDraft | null>(null);
	placementPosition = $state<[number, number, number] | null>(null);
	placementTracking = $state(false);
	transformGizmoMode = $state<'translate' | 'rotate' | 'scale'>('translate');
	/** Object-context Behavior drawer (bottom pane). Scene has no bottom shelf. */
	bottomPaneOpen = $state(false);
	/** Expanded height of the docked bottom action pane (px). */
	bottomHeight = $state(320);

	setTransformGizmoMode(mode: 'translate' | 'rotate' | 'scale') {
		this.transformGizmoMode = mode;
	}

	setRailPosition(position: RailPosition) {
		if (this.railPosition === position) return;
		this.railPosition = position;
		persistRailPosition(position);
	}

	toggleBottomPane(open?: boolean) {
		this.bottomPaneOpen = open ?? !this.bottomPaneOpen;
	}
	modeMessage = $state('');
	#playSnapshot: ChromeSnapshot | null = null;

	togglePlay() {
		if (this.shellMode === 'play') this.exitPlay();
		else this.enterPlay();
	}

	enterPlay() {
		if (this.shellMode === 'play') return;

		const orbit = captureEditCameraSnapshot();
		this.#playSnapshot = {
			roomsPaneTab: this.roomsPaneTab,
			workbenchResource: this.workbenchResource,
			chrome: cloneChrome(this.chrome),
			cameraMode: camera.mode,
			settingsTab: this.settingsTab,
			orbit
		};
		if (world.hasRoomCatalog()) world.filterToActiveRoom();
		world.roomHistory = [];
		world.snapshotPlayState();
		score.reset();
		this.playPaused = false;
		this.shellMode = 'play';
		this.assetPickTarget = null;
		this.closeAssetPreview();
		cancelPlacement();
		world.select(null);
		world.setHover(null);
		resetPlayCameraRig();
		if (world.localPlayerId) {
			followCamera.reset();
			camera.setMode(worldProfile.is2d ? 'orbit' : this.playCameraDefault);
		} else {
			camera.setMode('orbit');
		}
		worldProfile.apply2dViewerDefaults();
		primePlayMenuButtons();
		reconcilePlayerSpawnPositions(session.members);
		startSimulation();
		if (world.activeRoomId) warmAdjacentRoomAssets(world.activeRoomId);
		this.modeMessage = 'Play mode';
		syncShellModeToUrl('play');
	}

	exitPlay() {
		if (this.shellMode !== 'play') return;

		this.playPaused = false;
		stopSimulation();
		world.roomHistory = [];
		world.restorePlayState();
		world.restoreEditRoomView();
		bootstrapFormulas();
		const snap = this.#playSnapshot;
		if (snap) {
			this.roomsPaneTab = snap.roomsPaneTab;
			this.workbenchResource = snap.workbenchResource;
			this.chrome = cloneChrome(snap.chrome);
			camera.setMode(snap.cameraMode);
			this.settingsTab = snap.settingsTab;
			restoreEditCameraSnapshot(snap.orbit);
		}
		this.#playSnapshot = null;
		this.shellMode = 'edit';
		worldProfile.apply2dViewerDefaults();
		this.modeMessage = 'Edit mode';
		syncShellModeToUrl('edit');
	}

	enterPublish() {
		if (this.shellMode === 'publish') return;
		if (this.shellMode === 'play') this.exitPlay();
		this.assetPickTarget = null;
		this.closeAssetPreview();
		cancelPlacement();
		this.shellMode = 'publish';
		this.modeMessage = 'Publish';
		syncShellModeToUrl('publish');
	}

	exitPublish() {
		if (this.shellMode !== 'publish') return;
		this.shellMode = 'edit';
		this.modeMessage = 'Edit mode';
		syncShellModeToUrl('edit');
	}

	/** Leave play or publish and return to edit. */
	exitToEdit() {
		if (this.shellMode === 'play') this.exitPlay();
		else if (this.shellMode === 'publish') this.exitPublish();
	}

	togglePlayPause() {
		if (this.playPaused) this.resumePlay();
		else this.pausePlay();
	}

	pausePlay() {
		if (this.shellMode !== 'play' || this.playPaused) return;
		this.playPaused = true;
		pauseSimulation();
		this.modeMessage = 'Paused';
	}

	resumePlay() {
		if (this.shellMode !== 'play' || !this.playPaused) return;
		this.playPaused = false;
		resumeSimulation();
		this.modeMessage = 'Play mode';
	}

	resetPlay() {
		if (this.shellMode !== 'play') return;
		void playResetFx.run(() => this.#applyPlayReset());
	}

	#applyPlayReset() {
		if (this.playPaused) this.resumePlay();
		world.resetToPlaySnapshot();
		score.reset();
		scheduler.reset();
		resetJumpInputState();
		resetPlayCameraRig();
		if (world.localPlayerId) followCamera.reset();
		reconcilePlayerSpawnPositions(session.members);
		bootstrapFormulas();
		this.modeMessage = this.playPaused ? 'Paused' : 'Play mode';
	}

	setRoomsPaneTab(tab: RoomsPaneTab) {
		this.roomsPaneTab = tab;
		if (tab === 'room') this.workbenchResource = 'rooms';
		else if (tab === 'instances') this.workbenchResource = 'objects';
		else this.workbenchResource = 'objects';
	}

	/** @deprecated use setRoomsPaneTab */
	setLeftTab(tab: RoomsPaneTab) {
		this.setRoomsPaneTab(tab);
	}

	focusObjectSearch() {
		if (this.shellMode !== 'edit') return;
		this.setRoute('rooms');
		this.setRoomsPaneTab('instances');
		this.objectSearchFocusRequest += 1;
	}

	/** Open Rooms → Objects catalog and focus its search (Add object entry points). */
	focusObjectsCatalogSearch() {
		if (this.shellMode !== 'edit') return;
		this.setRoute('rooms');
		this.setRoomsPaneTab('objects');
		this.objectsCatalogSearchFocusRequest += 1;
	}

	openSceneTab(tab: SettingsTab = 'input') {
		this.setRoute('config');
		this.settingsTab = tab;
	}

	openWorkbenchResource(resource: WorkbenchResource) {
		this.workbenchResource = resource;
		if (resource === 'rooms') {
			this.setRoute('rooms');
			this.setRoomsPaneTab('room');
		} else if (resource === 'sprites') {
			this.setRoute('textures');
		} else if (resource === 'assets') {
			this.setRoute('models');
		} else if (resource === 'settings') {
			this.setRoute('config');
		} else {
			this.setRoute('objects');
		}
	}

	navFrame(): ShellNavFrame {
		return {
			railRoute: this.railRoute,
			selectedObjectType: this.selectedObjectType,
			objectTarget: this.objectTarget
		};
	}

	/** Record current shell route into the doc-bar back/forward stack. */
	recordNav(before?: ShellNavFrame) {
		if (this.shellMode !== 'edit' || this.suppressNavRecord) return;
		const after = this.navFrame();
		if (before) shellNavHistory.ensureSeed(before);
		else shellNavHistory.ensureSeed(after);
		shellNavHistory.record(after);
	}

	/** Restore a history frame without pushing a new entry. */
	applyNavFrame(frame: ShellNavFrame) {
		if (this.shellMode !== 'edit') return;
		this.suppressNavRecord = true;
		shellNavHistory.restoring = true;
		try {
			if (frame.railRoute === 'object' && frame.objectTarget) {
				if (this.isAnimatableEntity(frame.objectTarget)) {
					this.objectTarget = frame.objectTarget;
					this.railRoute = 'object';
					this.bottomPaneOpen = true;
					world.select(frame.objectTarget);
					this.modeMessage = 'Object editor';
					return;
				}
				this.railRoute = 'rooms';
				this.objectTarget = null;
				this.bottomPaneOpen = false;
				this.modeMessage = 'Room editor';
				return;
			}

			const route = frame.railRoute === 'object' ? 'rooms' : frame.railRoute;
			if (this.railRoute === 'rooms' && route !== 'rooms') {
				clearPlacement();
			}
			if (isAssetRoute(this.railRoute) && !isAssetRoute(route)) {
				this.closeAssetPreview();
				this.clearPreviewAnimSeek();
				this.previewAnimClip = null;
			}
			if (this.railRoute === 'objects' && route !== 'objects') {
				this.previewAnimClip = null;
			}

			this.railRoute = route;
			this.objectTarget = null;
			this.selectedObjectType = frame.selectedObjectType;
			this.previewAnimClip = null;

			if (route === 'rooms') {
				this.modeMessage = 'Room editor';
			} else if (route === 'objects') {
				this.modeMessage = 'Object types';
			} else if (isAssetRoute(route)) {
				this.modeMessage =
					route === 'models'
						? 'Models'
						: route === 'textures'
							? 'Textures'
							: route === 'audio'
								? 'Audio'
								: 'Files';
				this.syncAssetsSectionFromRoute(route);
			} else if (route === 'controls') {
				this.modeMessage = 'Controls';
			} else if (route === 'config') {
				this.modeMessage = 'Config';
			} else if (route === 'graph') {
				this.modeMessage = 'Graph';
			} else if (route === 'collections') {
				this.modeMessage = 'Collections';
			}
		} finally {
			shellNavHistory.restoring = false;
			this.suppressNavRecord = false;
		}
	}

	goNavBack() {
		const frame = shellNavHistory.back();
		if (frame) this.applyNavFrame(frame);
	}

	goNavForward() {
		const frame = shellNavHistory.forward();
		if (frame) this.applyNavFrame(frame);
	}

	/** Switch world route (bottom dock) or instance editor. */
	setRoute(route: RailRoute) {
		if (this.shellMode !== 'edit') return;
		const before = this.navFrame();
		if (this.railRoute === 'rooms' && route !== 'rooms') {
			clearPlacement();
		}
		if (isAssetRoute(this.railRoute) && !isAssetRoute(route)) {
			this.closeAssetPreview();
			this.clearPreviewAnimSeek();
			this.previewAnimClip = null;
		}
		if (this.railRoute === 'objects' && route !== 'objects') {
			this.previewAnimClip = null;
		}
		if (route === 'object') {
			this.railRoute = 'object';
			const sel = world.selection;
			if (sel && this.isAnimatableEntity(sel)) {
				this.objectTarget = sel;
				this.bottomPaneOpen = true;
				this.modeMessage = 'Object editor';
				this.recordNav(before);
				return;
			}
			if (
				this.objectTarget &&
				world.getEntity(this.objectTarget) &&
				this.isAnimatableEntity(this.objectTarget)
			) {
				if (sel !== this.objectTarget) world.select(this.objectTarget);
				this.bottomPaneOpen = true;
				this.modeMessage = 'Object editor';
				this.recordNav(before);
				return;
			}
			this.objectTarget = null;
			this.bottomPaneOpen = false;
			this.modeMessage = 'Select an animated character';
			this.recordNav(before);
			return;
		}
		this.railRoute = route;
		if (route === 'rooms') {
			this.modeMessage = 'Room editor';
		} else if (route === 'objects') {
			this.modeMessage = 'Object types';
		} else if (isAssetRoute(route)) {
			this.modeMessage = route === 'models'
				? 'Models'
				: route === 'textures'
					? 'Textures'
					: route === 'audio'
						? 'Audio'
						: 'Files';
			this.syncAssetsSectionFromRoute(route);
		} else if (route === 'controls') {
			this.modeMessage = 'Controls';
		}
		this.recordNav(before);
	}

	selectObjectType(typeName: string | null) {
		this.selectedObjectType = typeName;
		this.previewAnimClip = null;
	}

	/**
	 * Jump from a room instance to its type definition on the Objects route.
	 * Records a single history entry.
	 */
	openObjectTypeInObjects(typeName: string) {
		if (this.shellMode !== 'edit' || !typeName) return;
		const before = this.navFrame();
		this.suppressNavRecord = true;
		try {
			if (this.railRoute === 'rooms') clearPlacement();
			this.railRoute = 'objects';
			this.objectTarget = null;
			this.selectedObjectType = typeName;
			this.previewAnimClip = null;
			this.modeMessage = 'Object types';
		} finally {
			this.suppressNavRecord = false;
		}
		shellNavHistory.ensureSeed(before);
		shellNavHistory.record({
			railRoute: 'objects',
			selectedObjectType: typeName,
			objectTarget: null
		});
	}

	openNewObjectTypeDialog(cloneFrom: string | null = null) {
		this.newObjectTypeCloneFrom = cloneFrom;
		this.newObjectTypeOpen = true;
	}

	/** Create a new object type — Objects route + new-type dialog. */
	addNewObjectType() {
		if (this.shellMode !== 'edit') return;
		this.setRoute('objects');
		this.openNewObjectTypeDialog();
	}

	isAnimatableEntity(entityId: string): boolean {
		const entity = world.getEntity(entityId);
		return !!(entity && 'SkinnedMesh' in entity.components && 'Mesh3DAnimator' in entity.components);
	}

	/** Enter the Object context to edit one entity in isolation. */
	editObject(entityId: string) {
		if (!this.isAnimatableEntity(entityId)) {
			this.modeMessage = 'Only animated characters can open in Object editor';
			return;
		}
		const before = this.navFrame();
		this.objectTarget = entityId;
		this.railRoute = 'object';
		this.bottomPaneOpen = true;
		world.select(entityId);
		this.modeMessage = 'Object editor';
		this.recordNav(before);
	}

	exitObject() {
		const before = this.navFrame();
		this.railRoute = 'rooms';
		this.modeMessage = 'Room editor';
		this.recordNav(before);
	}

	setSceneDisplayName(name: string) {
		this.scene.displayName = name.trim() || 'Scene';
	}

	/** Apply an art-style preset, replacing the current shader config. */
	setArtStyle(id: ArtStyleId) {
		if (id === 'custom') {
			this.scene.style.artStyle = 'custom';
			return;
		}
		this.scene.style = sceneStyleFromPreset(id);
	}

	/** Flag the active style as edited (called when an individual knob changes). */
	touchStyleCustom() {
		this.scene.style.artStyle = 'custom';
	}

	toggleSidebars() {
		if (this.shellMode !== 'edit') return;
		this.sidebarsVisible = !this.sidebarsVisible;
		this.modeMessage = this.sidebarsVisible ? 'Sidebars shown' : 'Sidebars hidden';
	}

	resizeLeftPanel(delta: number) {
		this.leftPanelWidth = clampPanelWidth(this.leftPanelWidth + delta);
	}

	resizeRightPanel(delta: number) {
		this.rightPanelWidth = clampPanelWidth(this.rightPanelWidth + delta);
	}

	resizeBottomPane(delta: number) {
		this.bottomHeight = clampBottomHeight(this.bottomHeight + delta);
	}

	/** Edit chrome (side panels + dock) is visible and should inset viewport overlays. */
	get editChromeVisible(): boolean {
		return this.shellMode === 'edit' && this.sidebarsVisible;
	}

	/** Left chrome width covered by rail + left panel (px). Used for projection insets. */
	get viewportGizmoInsetLeft(): number {
		const rail =
			this.shellMode === 'edit' && this.railPosition === 'left' ? RAIL_WIDTH : 0;
		const panel = this.editChromeVisible ? this.leftPanelWidth : 0;
		return rail + panel;
	}

	/** Bottom band reserved for a horizontal navigation rail (px). */
	get viewportRailBottomInset(): number {
		if (this.shellMode !== 'edit' || this.railPosition !== 'bottom') return 0;
		return RAIL_HEIGHT + VIEWPORT_FLOAT_INSET;
	}

	/** Bottom chrome height above the dock float band (px). Matches `--chrome-bottom-outer` on `.app-shell`. */
	get viewportBottomChromeHeight(): number {
		if (!this.editChromeVisible || this.bottomPaneHeight <= 0) return 0;
		return this.bottomPaneHeight + CHROME_FLOAT_GAP;
	}

	/** Margin offset for the three-viewport-gizmo overlay — far bottom-left corner. */
	get viewportGizmoOffset(): { top: number; right: number; bottom: number; left: number } {
		return {
			top: 0,
			right: 0,
			bottom:
				VIEWPORT_FLOAT_INSET + this.viewportBottomChromeHeight + this.viewportRailBottomInset,
			left: VIEWPORT_FLOAT_INSET
		};
	}

	/** Right AppShell panel width when visible (px). */
	get viewportChromeInsetRight(): number {
		if (!this.editChromeVisible) return 0;
		if (
			this.railRoute === 'rooms' ||
			this.railRoute === 'object' ||
			this.railRoute === 'objects' ||
			isAssetRoute(this.railRoute)
		) {
			return this.rightPanelWidth;
		}
		return 0;
	}

	/**
	 * Floating chrome that obscures full-bleed preview canvases (px, viewport coords).
	 * Used to shift perspective projection so subjects sit in the visible gap center.
	 */
	get viewportChromeInsets(): { left: number; right: number; top: number; bottom: number } {
		if (!this.editChromeVisible) {
			return { left: 0, right: 0, top: 0, bottom: 0 };
		}
		const top = this.shellMode === 'edit' ? 48 : 0;
		// Objects/Object canvases already CSS-inset via --viewport-bottom-inset;
		// don't also shift projection for the bottom shelf (that squashes aspect).
		const bottom = 0;
		return {
			left: this.viewportGizmoInsetLeft,
			right: this.viewportChromeInsetRight,
			top,
			bottom
		};
	}

	/** Docked bottom pane height for the shell grid (0 when hidden). Object context only. */
	get bottomPaneHeight(): number {
		if (this.shellMode !== 'edit' || !this.sidebarsVisible) return 0;
		if (this.railRoute !== 'object') return 0;
		return this.bottomPaneOpen ? this.bottomHeight : BOTTOM_PANE_COLLAPSED;
	}

	/** Bottom shelf height (viewport / panel insets). */
	get bottomChromeHeight(): number {
		return this.bottomPaneHeight;
	}

	openAssetsSection(section: AssetsSection) {
		const route = assetRouteForSection(section);
		this.setRoute(route);
		this.workbenchResource = section === 'textures' ? 'sprites' : 'assets';
		this.assetsSection = section;
	}

	syncAssetsSectionFromRoute(route: AssetRoute) {
		this.assetsSection = route === 'models' ? 'models' : route;
	}

	openAssetPick(target: AssetPickTarget) {
		this.assetPickTarget = target;
		this.closeAssetPreview();
		const field = target.field;
		const fromObjects = this.railRoute === 'objects' || 'typeName' in target;
		if (field === 'mesh') {
			this.setRoute('models');
			this.assetsSection = 'models';
		} else if (field === 'sfx' || field.startsWith('sfx')) {
			this.setRoute('audio');
			this.assetsSection = 'audio';
		} else if (fromObjects) {
			this.setRoute('models');
			this.assetsSection = 'models';
		} else {
			this.openAssetsSection('models');
		}
	}

	openAssetPreview(asset: AssetEntry) {
		this.previewContext = { kind: 'asset', asset };
		this.assetInspectorTab = asset.kind === 'models' ? 'animations' : 'inspector';
	}

	openShapePreview(shape: ShapeEntry) {
		this.previewContext = { kind: 'shape', shape };
		this.assetInspectorTab = 'inspector';
	}

	closeAssetPreview() {
		this.previewContext = null;
		assetPreview.setInspection(null);
	}
}

export { isAssetRoute } from '$lib/ui/assetRoutes';

export const ui = new UIState();

