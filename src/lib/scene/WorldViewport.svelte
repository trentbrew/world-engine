<script lang="ts">
	import { Canvas } from '@threlte/core';
	import WorldScene from '$lib/scene/WorldScene.svelte';
	import PlacementBanner from '$lib/scene/PlacementBanner.svelte';
	import PlacementSession from '$lib/scene/PlacementSession.svelte';
	import { PLACEMENT_DRAG_MIME, readPlacementDrag } from '$lib/scene/placementDrag';
	import { groundPointFromClient } from '$lib/scene/placementRaycast';
	import {
		canStartPlacement,
		cancelPlacement,
		commitPlacement,
		onViewportEnter,
		onViewportLeave,
		startPlacement,
		updatePlacementFromXZ
	} from '$lib/scene/placementSession';
	import PeerSelectionLabelOverlay from '$lib/ui/PeerSelectionLabelOverlay.svelte';
	import RoomPortalPromptOverlay from '$lib/ui/RoomPortalPromptOverlay.svelte';
	import PlayerInteractPromptOverlay from '$lib/ui/PlayerInteractPromptOverlay.svelte';
	import RoomTransitionOverlay from '$lib/ui/RoomTransitionOverlay.svelte';
	import ViewControls from '$lib/ui/ViewControls.svelte';
	import PlayModeToolbar from '$lib/ui/PlayModeToolbar.svelte';
	import PlayPauseMenu from '$lib/ui/PlayPauseMenu.svelte';
	import PlayResetOverlay from '$lib/ui/PlayResetOverlay.svelte';
	import ViewportTopRight from '$lib/ui/ViewportTopRight.svelte';
	import ViewportSelectionBar from '$lib/ui/ViewportSelectionBar.svelte';
	import RoomChat from '$lib/ui/RoomChat.svelte';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { formatBinding, primaryBinding } from '$lib/engine/input/shortcutBinding';
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import { hasEntityClipboard } from '$lib/engine/runtime/entityClipboard.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { entityDestroy } from '$lib/ui/entityDestroy.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { camera } from '$lib/engine/render/camera.svelte';
	import { hmrScene } from '$lib/engine/dev/hmrScene.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { cn } from '$lib/utils.js';

	const renderMode = $derived(
		worldProfile.is2d || ui.shellMode === 'play' || camera.projection === 'orthographic'
			? 'always'
			: 'on-demand'
	);

	const editMode = $derived(ui.shellMode === 'edit');
	const selectedId = $derived(world.selectedEntity?.id ?? null);
	const canCopy = $derived(editMode && selectedId !== null);
	const canPaste = $derived(editMode && hasEntityClipboard());
	const canDuplicate = $derived(editMode && selectedId !== null);
	const canDelete = $derived(editMode && entityDestroy.canRequest());
	const canFocus = $derived(editMode && selectedId !== null);
	const canEditObject = $derived(
		editMode && selectedId !== null && ui.isAnimatableEntity(selectedId)
	);
	const shortcutLabels = $derived({
		copy: formatBinding(primaryBinding('copy', inputPrefs.shortcuts)),
		paste: formatBinding(primaryBinding('paste', inputPrefs.shortcuts)),
		duplicate: formatBinding(primaryBinding('duplicate', inputPrefs.shortcuts)),
		delete: formatBinding(primaryBinding('delete', inputPrefs.shortcuts))
	});

	function placementPointFromDrag(event: DragEvent): [number, number] | null {
		return groundPointFromClient(event.clientX, event.clientY);
	}

	function onViewportDragOver(event: DragEvent) {
		if (ui.shellMode !== 'edit') return;
		if (!event.dataTransfer?.types.includes(PLACEMENT_DRAG_MIME)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		const pt = placementPointFromDrag(event);
		if (pt) updatePlacementFromXZ(pt[0], pt[1]);
	}

	function onViewportDrop(event: DragEvent) {
		if (ui.shellMode !== 'edit' || !event.dataTransfer) return;
		event.preventDefault();

		const draft = readPlacementDrag(event.dataTransfer);
		if (!draft || !canStartPlacement()) return;

		if (!ui.placementDraft) startPlacement(draft);

		const pt = placementPointFromDrag(event);
		if (pt) updatePlacementFromXZ(pt[0], pt[1]);
		if (ui.placementPosition) commitPlacement();
	}

	function onViewportDragLeave(event: DragEvent) {
		if (event.currentTarget === event.target && ui.placementDraft) {
			ui.placementTracking = false;
		}
	}
</script>

<div class="viewport-wrap" role="presentation">
	<div class="viewport-canvas">
		<ContextMenu.Root>
			<ContextMenu.Trigger
				class={cn('viewport-hit-target', ui.placementDraft !== null && 'placement-drop-target')}
				role="region"
				aria-label="3D viewport"
				onpointerenter={onViewportEnter}
				onpointerleave={onViewportLeave}
				ondragover={onViewportDragOver}
				ondrop={onViewportDrop}
				ondragleave={onViewportDragLeave}
			>
				{#key hmrScene.canvasGeneration}
					<Canvas shadows={ui.scene.shadows} {renderMode}>
						<WorldScene />
					</Canvas>
				{/key}
			</ContextMenu.Trigger>

			{#if editMode}
				<ContextMenu.Content class="w-52">
					<ContextMenu.Group>
						<ContextMenu.Item disabled={!canCopy} onSelect={() => world.copySelection()}>
							Copy
							<ContextMenu.Shortcut>{shortcutLabels.copy}</ContextMenu.Shortcut>
						</ContextMenu.Item>
						<ContextMenu.Item disabled={!canPaste} onSelect={() => world.pasteClipboard()}>
							Paste
							<ContextMenu.Shortcut>{shortcutLabels.paste}</ContextMenu.Shortcut>
						</ContextMenu.Item>
						<ContextMenu.Item
							disabled={!canDuplicate}
							onSelect={() => world.duplicateSelection()}
						>
							Duplicate
							<ContextMenu.Shortcut>{shortcutLabels.duplicate}</ContextMenu.Shortcut>
						</ContextMenu.Item>
					</ContextMenu.Group>

					<ContextMenu.Separator />

					<ContextMenu.Group>
						<ContextMenu.Item disabled={!canFocus} onSelect={() => camera.focusSelection()}>
							Focus selection
							<ContextMenu.Shortcut>F</ContextMenu.Shortcut>
						</ContextMenu.Item>
						{#if canEditObject && selectedId}
							<ContextMenu.Item onSelect={() => ui.editObject(selectedId)}>
								Edit object…
							</ContextMenu.Item>
						{/if}
						<ContextMenu.Item onSelect={() => ui.focusObjectsCatalogSearch()}>
							Add object…
						</ContextMenu.Item>
					</ContextMenu.Group>

					<ContextMenu.Separator />

					<ContextMenu.Item
						variant="destructive"
						disabled={!canDelete}
						onSelect={() => entityDestroy.request()}
					>
						Destroy
						<ContextMenu.Shortcut>{shortcutLabels.delete}</ContextMenu.Shortcut>
					</ContextMenu.Item>
				</ContextMenu.Content>
			{/if}
		</ContextMenu.Root>
	</div>

	<PlacementSession />
	<PlacementBanner />

	<PeerSelectionLabelOverlay />
	<RoomPortalPromptOverlay />
	<PlayerInteractPromptOverlay />
	<RoomTransitionOverlay />

	{#if ui.shellMode === 'edit'}
		<ViewportSelectionBar />
	{/if}

	{#if ui.shellMode !== 'play'}
		<div class="viewport-view-controls">
			<ViewControls />
		</div>
	{:else if ui.chrome.playToolbar}
		<div class="viewport-bottom-chrome">
			<PlayModeToolbar />
		</div>
	{:else}
		<!-- Keep gamepad pause/reset polling without the bottom-center buttons. -->
		<PlayModeToolbar visible={false} />
	{/if}

	{#if ui.shellMode === 'play'}
		<ViewportTopRight />
		<PlayPauseMenu />
		<PlayResetOverlay />
	{/if}
</div>

<style>
	.viewport-wrap {
		position: absolute;
		inset: 0;
		min-height: 0;
		background: var(--viewport);
	}

	.viewport-wrap::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			radial-gradient(ellipse 85% 75% at 50% 42%, transparent 35%, rgb(0 0 0 / 0.32) 100%),
			linear-gradient(
				to bottom,
				color-mix(in srgb, var(--foreground) 3%, transparent) 0%,
				transparent 22%,
				transparent 78%,
				rgb(0 0 0 / 0.18) 100%
			);
	}

	.viewport-canvas {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: var(--viewport);
	}

	.viewport-canvas :global(.viewport-hit-target) {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		margin: 0;
		overflow: hidden;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: inherit;
	}

	.viewport-canvas :global(.viewport-hit-target > div) {
		width: 100%;
		height: 100%;
	}

	.viewport-bottom-chrome {
		position: absolute;
		bottom: var(--float-inset);
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}

	.viewport-view-controls {
		position: absolute;
		bottom: var(--viewport-bottom-inset, var(--chrome-bottom-outer, var(--float-inset)));
		left: var(--chrome-edge, var(--float-inset));
		z-index: 2;
		pointer-events: none;
	}
</style>
