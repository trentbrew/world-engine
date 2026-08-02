<script lang="ts">
	import { Canvas } from '@threlte/core';
	import ObjectTypePreviewScene from '$lib/scene/ObjectTypePreviewScene.svelte';
	import {
		buildTypePreviewEntity,
		typePreviewHasVisual
	} from '$lib/engine/runtime/typePreview';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { hmrScene } from '$lib/engine/dev/hmrScene.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const typeName = $derived(ui.selectedObjectType);

	const previewEntity = $derived.by(() => {
		void world.typeRevision;
		return typeName ? buildTypePreviewEntity(typeName) : null;
	});

	const hasVisual = $derived(typeName ? typePreviewHasVisual(typeName) : false);

	const canvasKey = $derived(
		previewEntity
			? `${hmrScene.canvasGeneration}:${typeName}:${world.typeRevision}`
			: 'empty'
	);

	let zoomPercent = $state(100);
	let zoomHudVisible = $state(false);
	let hideZoomTimer: ReturnType<typeof setTimeout> | undefined;

	function onZoomPercent(percent: number) {
		zoomPercent = percent;
		zoomHudVisible = true;
		if (hideZoomTimer) clearTimeout(hideZoomTimer);
		hideZoomTimer = setTimeout(() => {
			zoomHudVisible = false;
		}, 900);
	}
</script>

<div class="object-type-preview" role="region" aria-label="Object type preview">
	{#if previewEntity && hasVisual}
		<div class="preview-canvas">
			{#key canvasKey}
				<Canvas shadows={ui.scene.shadows} renderMode="always">
					<ObjectTypePreviewScene entity={previewEntity} {onZoomPercent} />
				</Canvas>
			{/key}
			{#if zoomHudVisible}
				<div class="zoom-hud" aria-live="polite">{zoomPercent}%</div>
			{/if}
		</div>
		<div class="preview-chrome">
			<span class="preview-badge">Preview</span>
			<span class="preview-type">{typeName}</span>
		</div>
	{:else if typeName}
		<div class="preview-empty" role="status">
			<h2>{typeName}</h2>
			<p>No visual preview — add a <strong>Render</strong> capability to see this type here.</p>
		</div>
	{:else}
		<div class="preview-empty" role="status">
			<h2>Select an object type</h2>
			<p>Pick a type in the left panel to preview its defaults before placing instances in Rooms.</p>
		</div>
	{/if}
</div>

<style>
	.object-type-preview {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: var(--viewport-bottom-inset, 0px);
		min-height: 0;
		background: var(--viewport);
	}

	.preview-canvas {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.preview-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.zoom-hud {
		position: absolute;
		right: 12px;
		bottom: 12px;
		z-index: 3;
		padding: 4px 8px;
		border-radius: 6px;
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		background: color-mix(in srgb, var(--card) 78%, transparent);
		backdrop-filter: blur(10px);
		font: 600 11px/1 var(--font-mono, monospace);
		color: var(--foreground);
		pointer-events: none;
	}

	.preview-chrome {
		position: absolute;
		/* Sit in the visible viewport gap — clear of logo, doc bar, and side panels. */
		top: calc(var(--chrome-top-outer, 0px) + var(--spacing-sm));
		left: calc(var(--main-inset-left, 0px) + var(--spacing-sm));
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
		background: color-mix(in srgb, var(--card) 72%, transparent);
		backdrop-filter: blur(12px);
		pointer-events: none;
		font-size: 11px;
	}

	.preview-badge {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.preview-type {
		font-weight: 600;
		color: var(--foreground);
	}

	.preview-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--spacing-lg);
		text-align: center;
		gap: 8px;
	}

	.preview-empty h2 {
		margin: 0;
		font-size: 15px;
	}

	.preview-empty p {
		margin: 0;
		max-width: 36ch;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted-foreground);
	}
</style>
