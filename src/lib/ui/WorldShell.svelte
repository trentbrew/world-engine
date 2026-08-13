<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { currentGame, ensureGameInUrl, gameUrl } from '$lib/engine/games';
	import { loadOntology } from '$lib/engine/ontology/loadOntology';
	import { staticSource, type WorldSource } from '$lib/engine/ontology/source';
	import {
		clearRoomCatalog,
		installRoomCatalog,
		parseRoomCatalog
	} from '$lib/engine/ontology/roomCatalog';
	import {
		clearScriptCatalog,
		installScriptCatalog,
		parseScriptCatalog
	} from '$lib/engine/ontology/scriptCatalog';
	import { createDurableStore, DurableOfflineError } from '$lib/engine/ontology/durableStore';
	import type { DurableStore } from '$lib/engine/ontology/durableStore';
	import {
		connectDurableSync,
		disconnectDurableSync,
		durableSession
	} from '$lib/engine/durable/session.svelte';
	import { resolveTransport } from '$lib/engine/net/createTransport';
	import { ensureRoomInUrl, resolveRoomId } from '$lib/engine/net/roomUrl';
	import { ensureShellModeInUrl } from '$lib/engine/shellUrl';
	import { initEditingPolicy } from '$lib/engine/collab/editingPolicy';
	import { session } from '$lib/engine/net/session.svelte';
	import { collab } from '$lib/engine/collab/collab.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { sceneSettings } from '$lib/engine/scene/sceneSettings.svelte';
	import { startSystems, stopSystems } from '$lib/engine/systems';
	import AppShell from '$lib/ui/AppShell.svelte';
	import BottomPane from '$lib/ui/BottomPane.svelte';
	import DocBar from '$lib/ui/DocBar.svelte';
	import PublishPanel from '$lib/ui/PublishPanel.svelte';
	import LeftPanel from '$lib/ui/LeftPanel.svelte';
	import ObjectBehaviorDrawer from '$lib/ui/ObjectBehaviorDrawer.svelte';
	import ObjectClipLibrary from '$lib/ui/ObjectClipLibrary.svelte';
	import ObjectInspectorPanel from '$lib/ui/ObjectInspectorPanel.svelte';
	import ObjectPlaybackInspector from '$lib/ui/ObjectPlaybackInspector.svelte';
	import ObjectsResourcePanel from '$lib/ui/ObjectsResourcePanel.svelte';
	import CollectionsPanel from '$lib/ui/CollectionsPanel.svelte';
	import CollectionTable from '$lib/ui/CollectionTable.svelte';
	import ControlsPanel from '$lib/ui/ControlsPanel.svelte';
	import ControlsPreview from '$lib/ui/ControlsPreview.svelte';
	import RoomChat from '$lib/ui/RoomChat.svelte';
	import RightPanel from '$lib/ui/RightPanel.svelte';
	import GraphInspectorPanel from '$lib/ui/GraphInspectorPanel.svelte';
	import GraphNavigatorPanel from '$lib/ui/GraphNavigatorPanel.svelte';
	import GraphViewport from '$lib/ui/GraphViewport.svelte';
	import DeviceHud from '$lib/ui/DeviceHud.svelte';
	import PreviewTray from '$lib/ui/PreviewTray.svelte';
	import SettingsPanel from '$lib/ui/SettingsPanel.svelte';
	import ObjectStageViewport from '$lib/scene/ObjectStageViewport.svelte';
	import ObjectTypePreviewViewport from '$lib/scene/ObjectTypePreviewViewport.svelte';
	import WorldViewport from '$lib/scene/WorldViewport.svelte';
	import AddEntityDialog from '$lib/ui/AddEntityDialog.svelte';
	import SaveTypeDialog from '$lib/ui/SaveTypeDialog.svelte';
	import NewObjectTypeDialog from '$lib/ui/NewObjectTypeDialog.svelte';
	import UsernameDialog from '$lib/ui/UsernameDialog.svelte';
	import IdentityDialog from '$lib/ui/IdentityDialog.svelte';
	import DestroyEntityDialog from '$lib/ui/DestroyEntityDialog.svelte';
	import AssetPreviewOverlay from '$lib/ui/AssetPreviewOverlay.svelte';
	import AssetPreviewViewport from '$lib/ui/AssetPreviewViewport.svelte';
	import AssetInspectorPanel from '$lib/ui/AssetInspectorPanel.svelte';
	import ModelsCatalogPanel from '$lib/ui/ModelsCatalogPanel.svelte';
	import KindCatalogPanel from '$lib/ui/KindCatalogPanel.svelte';
	import { isAssetRoute } from '$lib/ui/assetRoutes';
	import ShellRouteStub from '$lib/ui/ShellRouteStub.svelte';
	import LoadingOverlay from '$lib/ui/LoadingOverlay.svelte';
	import { debugLog } from '$lib/ui/debug/debugLog.svelte';
	import { sceneLoading } from '$lib/ui/sceneLoading.svelte';
	import {
		applyEntityTransformSnapshots,
		bindEditorSession,
		isHmrTeardown,
		isSoftReload,
		restoreViewerState
	} from '$lib/engine/dev/editorSession';
	import { bindWorldFileAuthor } from '$lib/engine/authoring/worldFileAuthor';
	import { rehydrateRuntimeAfterHmr } from '$lib/engine/dev/hmrLifecycle';
	import { installDevHmrHooks } from '$lib/engine/dev/hmrHooks';
	import SceneSettingsSync from '$lib/scene/SceneSettingsSync.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { handlePlayKeydown } from '$lib/ui/playKeyboard';
	import { handleShellKeydown, handleShellKeydownCapture } from '$lib/ui/shellKeyboard';

	let releaseEditorSession: (() => void) | null = null;

	onMount(async () => {
		debugLog.install();
		installDevHmrHooks();
		collab.maybeOpenUsernamePrompt();

		const softReload = isSoftReload();
		if (!softReload) {
			sceneLoading.suspended = true;
			sceneLoading.setPhase('Starting up');
			world.status = 'loading';
		} else if (world.entities.length > 0) {
			// Stale-while-revalidate — keep the last scene visible during HMR.
			world.status = 'ready';
			sceneLoading.suspended = false;
		}

		ensureGameInUrl();
		ensureRoomInUrl();
		const params = new URLSearchParams(location.search);
		if (params.get('inspectorTabs') === '1') {
			ui.inspectorTabsVisible = true;
		}
		initEditingPolicy(params);
		const shellMode = ensureShellModeInUrl('edit');
		const game = params.get('game') ?? currentGame().param;
		const url = gameUrl(game ?? undefined);
		const gameTitle = currentGame().title;
		const durableMode = params.get('durable') === 'trellis' ? 'trellis' : 'static';
		const worldId = resolveRoomId(params);
		releaseEditorSession = bindEditorSession(worldId);
		bindWorldFileAuthor(game);

		if (softReload && world.status === 'ready') {
			const room = resolveRoomId(params);
			if (!session.connected) {
				const { transport, kind } = await resolveTransport(room);
				session.connect(room, transport, kind);
			}
			startSystems();
			rehydrateRuntimeAfterHmr();
			const savedSelection = restoreViewerState();
			if (savedSelection && world.getEntity(savedSelection)) {
				world.select(savedSelection);
			}
			return;
		}

		// Default to the same-origin Vite proxy (see vite.config.ts) to avoid CORS;
		// override with ?trellis=<absolute-url> for a directly-reachable server.
		const trellisUrl = params.get('trellis') ?? `${location.origin}/trellis-db`;

		try {
			let source: WorldSource;
			let durableStore: DurableStore | null = null;

			if (durableMode === 'trellis') {
				durableSession.mode = 'trellis';
				sceneLoading.setPhase('Connecting to Trellis', worldId);
				try {
					const store = await createDurableStore('trellis', {
						url: trellisUrl,
						tenantId: worldId,
						canWrite: () => true,
						onConnectionChange: (connected) => {
							durableSession.connected = connected;
						}
					});
					durableStore = store;
					world.bindDurable(store, worldId);
					sceneLoading.setPhase('Loading world from Trellis', gameTitle);
					const doc = await store.load(worldId, url);
					source = () => Promise.resolve(doc);
					connectDurableSync(store, worldId);
				} catch (error) {
					if (error instanceof DurableOfflineError) {
						console.warn(
							'[durable] Trellis unavailable — loading static world; peer sync still active. Start Trellis with `trellis db serve` or `just run`.'
						);
						durableSession.connected = false;
						world.bindDurable(null, null);
						sceneLoading.setPhase('Loading world file', `${gameTitle} (Trellis offline)`);
						source = staticSource(url);
					} else {
						throw error;
					}
				}
			} else {
				durableSession.mode = 'static';
				world.bindDurable(null, null);
				sceneLoading.setPhase('Loading world file', gameTitle);
				source = staticSource(url);
			}

			sceneLoading.setPhase('Parsing world graph');
			const doc = await source();
			const entities = await loadOntology(() => Promise.resolve(doc));
			const catalog = parseRoomCatalog(doc, entities);
			if (catalog) {
				installRoomCatalog(catalog);
				world.bindRoomCatalog(catalog, entities);
			} else {
				clearRoomCatalog();
				world.clearRoomCatalog();
			}
			const scripts = parseScriptCatalog(doc);
			if (scripts) installScriptCatalog(scripts);
			else clearScriptCatalog();
			applyEntityTransformSnapshots(entities);
			sceneLoading.setPhase('Applying world profile', `${entities.length} entities`);
			worldProfile.hydrate(entities);
			const savedSelection = restoreViewerState();
			worldProfile.apply2dViewerDefaults();
			world.setReady(entities, {
				skipAutoSelect: savedSelection !== null
			});
			sceneLoading.setPhase('Building scene');
			sceneSettings.init(worldId, gameTitle);
			const room = resolveRoomId(params);
			collab.initRoom(room, gameTitle);
			sceneLoading.setPhase('Connecting to room', room);
			const { transport, kind } = await resolveTransport(room);
			const transportLabel = kind === 'relay' ? 'relay' : 'local tabs';
			sceneLoading.setPhase('Joining multiplayer session', transportLabel);
			session.connect(room, transport, kind);
			if (savedSelection && world.getEntity(savedSelection)) {
				world.select(savedSelection);
			}
			sceneLoading.setPhase('Starting game systems');
			startSystems();
			// `params` predates ensureShellModeInUrl's rewrite — use its resolved mode.
			if (shellMode === 'play' && ui.shellMode !== 'play') {
				sceneLoading.setPhase('Entering play mode');
				await tick();
				ui.enterPlay();
			} else if (shellMode === 'publish' && ui.shellMode !== 'publish') {
				sceneLoading.setPhase('Opening publish');
				await tick();
				ui.enterPublish();
			} else {
				rehydrateRuntimeAfterHmr();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error loading world';
			world.setError(`${url}: ${message}`);
		}
	});

	onDestroy(() => {
		releaseEditorSession?.();
		releaseEditorSession = null;

		if (isHmrTeardown()) {
			return;
		}

		debugLog.uninstall();
		stopSystems();
		session.disconnect();
		disconnectDurableSync();
		world.bindDurable(null, null);
	});

	const showLoadingOverlay = $derived(
		(world.status === 'loading' && !isSoftReload()) || sceneLoading.showBlockingOverlay
	);

	function onKeydown(event: KeyboardEvent) {
		if (handlePlayKeydown(event)) return;

		if (event.key === 'Escape' && ui.shellMode === 'play') {
			ui.exitToEdit();
			event.preventDefault();
			return;
		}

		if (event.key === 'Escape' && ui.shellMode === 'publish') {
			ui.exitPublish();
			event.preventDefault();
			return;
		}

		handleShellKeydown(event);
	}
	const showInspectorPanel = $derived(
		ui.railRoute === 'rooms' ||
			ui.railRoute === 'object' ||
			ui.railRoute === 'objects' ||
			ui.railRoute === 'graph' ||
			isAssetRoute(ui.railRoute)
	);
</script>

<svelte:window onkeydowncapture={handleShellKeydownCapture} onkeydown={onKeydown} />

<a class="skip-link" href="#entity-list">Skip to entity list</a>

<AppShell
	rightPanelVisible={showInspectorPanel}
>
	{#snippet docBar()}
		<DocBar />
	{/snippet}

	{#snippet leftPanel()}
		{#if ui.railRoute === 'rooms'}
			<LeftPanel />
		{:else if ui.railRoute === 'object'}
			<ObjectClipLibrary />
		{:else if ui.railRoute === 'objects'}
			<ObjectsResourcePanel />
		{:else if ui.railRoute === 'models'}
			<ModelsCatalogPanel />
		{:else if ui.railRoute === 'textures'}
			<KindCatalogPanel kind="textures" />
		{:else if ui.railRoute === 'audio'}
			<KindCatalogPanel kind="audio" />
		{:else if ui.railRoute === 'files'}
			<KindCatalogPanel kind="files" />
		{:else if ui.railRoute === 'collections'}
			<CollectionsPanel />
		{:else if ui.railRoute === 'graph'}
			<GraphNavigatorPanel />
		{:else if ui.railRoute === 'controls'}
			<ControlsPanel />
		{:else if ui.railRoute === 'config'}
			<SettingsPanel />
		{:else}
			<ShellRouteStub title="Config" hint="World configuration — coming soon." />
		{/if}
	{/snippet}

	{#snippet main()}
		{@const isViewportRoute =
			world.status !== 'error' &&
			(ui.railRoute === 'rooms' ||
				ui.railRoute === 'object' ||
				ui.railRoute === 'objects' ||
				isAssetRoute(ui.railRoute))}
		<div class="main-route" data-viewport={isViewportRoute ? '' : undefined}>
			{#if world.status === 'error'}
				<div class="error-overlay" role="alert">
					<h1>Failed to load world</h1>
					<p>{world.error}</p>
					<p class="hint">Check <code>static/world.jsonld</code> and reload.</p>
				</div>
			{:else if ui.railRoute === 'object'}
				<ObjectStageViewport />
			{:else if ui.railRoute === 'objects'}
				<ObjectTypePreviewViewport />
			{:else if isAssetRoute(ui.railRoute)}
				<AssetPreviewViewport />
			{:else if ui.railRoute === 'collections'}
				<CollectionTable />
			{:else if ui.railRoute === 'graph'}
				<GraphViewport />
			{:else if ui.railRoute === 'controls'}
				<ControlsPreview />
			{:else if ui.railRoute === 'config'}
				<ShellRouteStub title="Config" hint="World settings and configuration — coming soon." />
			{:else}
				<WorldViewport />
				{#if ui.shellMode === 'edit' && ui.deviceHudVisible}
					<DeviceHud />
				{/if}
			{/if}
		</div>
	{/snippet}

	{#snippet rightPanel()}
		{#if ui.railRoute === 'rooms'}
			<RightPanel inspectorTabsVisible={ui.inspectorTabsVisible} />
		{:else if ui.railRoute === 'object'}
			<ObjectPlaybackInspector />
		{:else if ui.railRoute === 'objects'}
			<ObjectInspectorPanel />
		{:else if isAssetRoute(ui.railRoute)}
			<AssetInspectorPanel />
		{:else if ui.railRoute === 'graph'}
			<GraphInspectorPanel />
		{/if}
	{/snippet}

	{#snippet bottom()}
		{#if ui.railRoute === 'object'}
			<BottomPane
				ariaLabel="Object behavior"
				title="Behavior"
				hint="clips + event lanes"
				shortcut="/"
			>
				<ObjectBehaviorDrawer />
			</BottomPane>
		{/if}
	{/snippet}
</AppShell>

{#if showLoadingOverlay}
	<LoadingOverlay label={sceneLoading.overlayLabel} detail={sceneLoading.overlayDetail} />
{/if}

{#if false}
	<!-- Gated off: Rooms placement uses Objects tab (TRL-165). Keep mounted path for revive. -->
	<AddEntityDialog />
{/if}
<SaveTypeDialog />
<NewObjectTypeDialog />
<UsernameDialog />
<IdentityDialog />
<DestroyEntityDialog />
<AssetPreviewOverlay />
<PreviewTray />
<SceneSettingsSync />

{#if ui.shellMode === 'edit'}
	<RoomChat showFab={false} />
{/if}

{#if ui.shellMode === 'publish'}
	<PublishPanel />
{/if}

<div id="world-status" role="status" aria-live="polite" class="sr-only">
	{world.statusMessage}
	{#if ui.modeMessage}
		{ui.modeMessage}
	{/if}
</div>

<style>
	.main-route {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/* Data-editor routes sit between floating chrome; 3D viewports stay full-bleed. */
	.main-route:not([data-viewport]) {
		position: absolute;
		top: var(--chrome-top-outer);
		left: var(--main-inset-left, 0px);
		right: var(--main-inset-right, 0px);
		bottom: calc(var(--bottom-chrome-height, var(--bottom-pane-height, 0px)) + var(--chrome-bottom-outer));
		width: auto;
		height: auto;
		background: var(--viewport);
		overflow: hidden;
	}

	.error-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--spacing-lg);
		text-align: center;
		background: var(--viewport);
	}

	.error-overlay h1 {
		font-size: 18px;
		margin-bottom: var(--spacing-sm);
	}

	.error-overlay p {
		color: var(--muted-foreground);
		max-width: 40ch;
	}

	.hint {
		margin-top: var(--spacing-md);
		font-size: 12px;
	}

	code {
		font-family: var(--font-mono);
		color: var(--muted-foreground);
	}

	.skip-link {
		position: absolute;
		left: -9999px;
		z-index: 100;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--card);
		color: var(--foreground);
	}

	.skip-link:focus {
		left: var(--spacing-md);
		top: var(--float-inset);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
</style>
