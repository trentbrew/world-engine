<script lang="ts">
	import { Canvas } from '@threlte/core';
	import ObjectStageScene from '$lib/scene/ObjectStageScene.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { hmrScene } from '$lib/engine/dev/hmrScene.svelte';

	const entity = $derived(ui.objectTarget ? world.getEntity(ui.objectTarget) : undefined);

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

<div class="object-stage-wrap" role="presentation">
	{#if entity}
		<div class="object-stage-canvas">
			{#key `${hmrScene.canvasGeneration}:${entity.id}`}
				<Canvas shadows={ui.scene.shadows} renderMode="always">
					<ObjectStageScene {onZoomPercent} />
				</Canvas>
			{/key}
			{#if zoomHudVisible}
				<div class="zoom-hud" aria-live="polite">{zoomPercent}%</div>
			{/if}
		</div>
	{:else}
		<div class="object-stage-empty" role="status">
			<h2>No object selected</h2>
			<p>Double-click a character in a room, or pick one from the Instances list.</p>
			<button type="button" class="back-btn" onclick={() => ui.exitObject()}>
				Back to Rooms
			</button>
		</div>
	{/if}
</div>

<style>
	.object-stage-wrap {
		position: absolute;
		inset: 0;
		min-height: 0;
		background: var(--viewport);
	}

	.object-stage-canvas {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.object-stage-canvas :global(canvas) {
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

	.object-stage-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--spacing-lg);
		text-align: center;
		gap: 8px;
	}

	.object-stage-empty h2 {
		margin: 0;
		font-size: 15px;
	}

	.object-stage-empty p {
		margin: 0;
		max-width: 32ch;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.back-btn {
		margin-top: 8px;
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		background: color-mix(in srgb, var(--card) 80%, transparent);
		color: var(--foreground);
		font-size: 12px;
		cursor: pointer;
	}

	.back-btn:hover {
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}
</style>
