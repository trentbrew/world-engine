<script lang="ts">
	import { Canvas } from '@threlte/core';
	import AssetPreviewScene from '$lib/scene/AssetPreviewScene.svelte';
	import AssetAnimatedPreviewScene from '$lib/scene/AssetAnimatedPreviewScene.svelte';
	import { buildAssetPreviewEntity } from '$lib/engine/runtime/assetPreviewEntity';
	import {
		isVideoFile,
		fileExtension,
		type AssetEntry
	} from '$lib/assets/catalog';
	import type { GltfInspection } from '$lib/assets/inspectGltf';
	import AssetThumbnail from '$lib/ui/AssetThumbnail.svelte';
	import { assetPreview } from '$lib/ui/assetPreview.svelte';
	import { hmrScene } from '$lib/engine/dev/hmrScene.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { resolveAssetUrl } from '$lib/engine/render/meshRef';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);

	const isModelPreview = $derived(!!shape || asset?.kind === 'models');
	const previewMesh = $derived(shape?.mesh ?? (asset?.kind === 'models' ? asset.url : null));
	const view = $derived(assetPreview.view);
	const inspection = $derived(assetPreview.inspection);

	const useAnimatedPreview = $derived(
		isModelPreview &&
			ui.assetInspectorTab === 'animations' &&
			(inspection?.boneCount ?? 0) > 0 &&
			!!previewMesh
	);

	// Build once per mesh — the selected clip is applied reactively inside
	// SkinnedMeshView (it reads ui.previewAnimClip when in an object stage), so
	// the entity and Canvas must NOT re-key on clip changes. Keying the Canvas on
	// the clip spawns a fresh WebGL context per click, quickly exhausting the
	// browser's context pool and freezing the preview.
	const previewEntity = $derived.by(() => {
		if (!useAnimatedPreview || !previewMesh) return null;
		return buildAssetPreviewEntity(previewMesh);
	});

	const canvasKey = $derived.by(() => {
		if (shape) return `${hmrScene.canvasGeneration}:shape:${shape.id}`;
		if (asset?.kind === 'models') {
			const mode = useAnimatedPreview ? 'anim' : 'static';
			return `${hmrScene.canvasGeneration}:model:${mode}:${asset.url}`;
		}
		return 'empty';
	});

	function onInspect(inspectionResult: GltfInspection | null) {
		assetPreview.setInspection(inspectionResult);
	}

	$effect(() => {
		void preview?.kind;
		void asset?.url;
		void shape?.id;
		assetPreview.setInspection(null);
		ui.previewAnimClip = null;
	});

	let audioEl = $state<HTMLAudioElement | undefined>();
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

	$effect(() => {
		const el = audioEl;
		if (!el || asset?.kind !== 'audio') return;
		el.loop = assetPreview.audioLoop;
		el.volume = assetPreview.audioVolume;
	});
</script>

<div class="asset-preview-viewport" role="region" aria-label="Asset preview">
	{#if preview}
		<header class="preview-toolbar glass-panel">
			<div class="preview-title-block">
				<span class="preview-kicker">
					{shape ? 'primitive' : asset?.kind}
				</span>
				<strong class="preview-title">{shape?.label ?? asset?.name}</strong>
			</div>
		</header>

		<div class="preview-body">
			<div class="preview-stage">
				{#if isModelPreview && previewMesh}
					<div class="preview-canvas">
						{#key canvasKey}
							<Canvas shadows renderMode="always">
								{#if useAnimatedPreview && previewEntity}
									<AssetAnimatedPreviewScene entity={previewEntity} {onZoomPercent} />
								{:else}
									<AssetPreviewScene
										mesh={previewMesh}
										wireframe={view.wireframe}
										showBones={view.showBones}
										showNormals={view.showNormals}
										materialChannel={view.materialChannel}
										{onInspect}
										{onZoomPercent}
									/>
								{/if}
							</Canvas>
						{/key}
						{#if zoomHudVisible}
							<div class="zoom-hud" aria-live="polite">{zoomPercent}%</div>
						{/if}
					</div>
				{:else if asset?.kind === 'textures'}
					<div
						class="texture-stage"
						class:uv-checker={view.materialChannel === 'uvChecker'}
					>
						<img src={resolveAssetUrl(asset.url)} alt="" />
					</div>
				{:else if asset?.kind === 'audio'}
					<div class="media-stage">
						<AssetThumbnail {asset} size="md" />
						<!-- svelte-ignore a11y_media_has_caption -->
						<audio
							bind:this={audioEl}
							src={resolveAssetUrl(asset.url)}
							controls
							preload="metadata"
							loop={assetPreview.audioLoop}
						></audio>
					</div>
				{:else if asset?.kind === 'files'}
					{#if isVideoFile(asset.name)}
						<div class="media-stage video-stage">
							<!-- svelte-ignore a11y_media_has_caption -->
							<video src={resolveAssetUrl(asset.url)} controls preload="metadata"></video>
						</div>
					{:else}
						<div class="media-stage">
							{#if fileExtension(asset.name) === '.pdf'}
								<iframe src={resolveAssetUrl(asset.url)} title={asset.name} class="file-frame"></iframe>
							{:else}
								<AssetThumbnail {asset} size="md" />
								<a class="file-open" href={resolveAssetUrl(asset.url)} target="_blank" rel="noopener noreferrer">
									Open file
									<ExternalLinkIcon class="size-3" aria-hidden="true" />
								</a>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{:else}
		<div class="preview-empty" role="status">
			<h2>Select an asset</h2>
			<p>Choose a primitive, model, texture, or file from the catalog to preview it here.</p>
		</div>
	{/if}
</div>

<style>
	.asset-preview-viewport {
		position: absolute;
		top: var(--chrome-top-outer, 0px);
		left: var(--main-inset-left, 0px);
		right: var(--main-inset-right, 0px);
		bottom: var(--chrome-bottom-outer, 0px);
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--viewport);
	}

	.preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: var(--spacing-md);
		margin-bottom: 0;
		padding: 8px 10px;
		flex-shrink: 0;
		pointer-events: auto;
	}

	.preview-title-block {
		min-width: 0;
	}

	.preview-kicker {
		display: block;
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.preview-title {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		font-weight: 600;
	}

	.preview-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: var(--spacing-md);
		height: 0;
	}

	.preview-stage {
		min-height: 0;
		height: 100%;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
		overflow: hidden;
	}

	.preview-stage:has(.video-stage) {
		border: none;
		background: transparent;
	}

	.preview-canvas {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 240px;
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

	.preview-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.texture-stage,
	.media-stage {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		min-height: 240px;
		padding: 16px;
		gap: 12px;
	}

	.texture-stage img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.texture-stage.uv-checker {
		background-image:
			linear-gradient(45deg, #666 25%, transparent 25%),
			linear-gradient(-45deg, #666 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #666 75%),
			linear-gradient(-45deg, transparent 75%, #666 75%);
		background-size: 24px 24px;
		background-position:
			0 0,
			0 12px,
			12px -12px,
			-12px 0;
		background-color: #999;
	}

	audio {
		width: min(560px, 100%);
		max-height: min(60vh, 420px);
	}

	.video-stage {
		padding: 20px 24px;
	}

	.video-stage video {
		width: min(960px, 100%);
		max-height: min(78vh, 720px);
		border-radius: var(--radius-lg);
		box-shadow: 0 16px 48px color-mix(in srgb, black 38%, transparent);
		background: #000;
		object-fit: contain;
	}

	.file-frame {
		width: 100%;
		height: min(60vh, 480px);
		border: none;
		border-radius: var(--radius-sm);
		background: var(--background);
	}

	.file-open {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--foreground);
		text-decoration: none;
		font-size: 12px;
	}

	.file-open:hover {
		text-decoration: underline;
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
