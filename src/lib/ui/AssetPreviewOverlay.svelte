<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import AssetThumbnail from '$lib/ui/AssetThumbnail.svelte';
	import { formatBytes, isVideoFile, fileExtension } from '$lib/assets/catalog';
	import { ui } from '$lib/ui/ui.svelte';
	import { isAssetRoute } from '$lib/ui/assetRoutes';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);

	function onOpenChange(open: boolean) {
		if (!open) ui.closeAssetPreview();
	}
</script>

{#if preview && !isAssetRoute(ui.railRoute)}
	<Dialog.Root open onOpenChange={onOpenChange}>
		<Dialog.Content resizable class="w-[min(560px,96vw)] sm:max-w-none" showCloseButton>
			<Dialog.Header>
				{#if asset}
					<Dialog.Description class="sr-only">Asset preview for {asset.name}</Dialog.Description>
					<p class="preview-kicker">{asset.kind}</p>
					<Dialog.Title>{asset.name}</Dialog.Title>
				{:else if shape}
					<Dialog.Description class="sr-only">Shape preview for {shape.label}</Dialog.Description>
					<p class="preview-kicker">shape</p>
					<Dialog.Title>{shape.label}</Dialog.Title>
				{/if}
			</Dialog.Header>

			<div class="preview-stage">
				{#if asset}
					{#if asset.kind === 'textures'}
						<img src={asset.url} alt="" />
					{:else if asset.kind === 'audio'}
						<audio src={asset.url} controls preload="metadata"></audio>
					{:else if asset.kind === 'files'}
						{#if isVideoFile(asset.name)}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video src={asset.url} controls preload="metadata"></video>
						{:else if fileExtension(asset.name) === '.pdf'}
							<iframe src={asset.url} title={asset.name} class="file-frame"></iframe>
						{:else}
							<div class="file-preview">
								<AssetThumbnail {asset} size="md" />
								<a class="file-open" href={asset.url} target="_blank" rel="noopener noreferrer">
									Open file
									<ExternalLinkIcon class="size-3" aria-hidden="true" />
								</a>
							</div>
						{/if}
					{:else}
						<div class="model-preview">
							<AssetThumbnail {asset} size="md" />
							<span>Drag onto the scene to place</span>
						</div>
					{/if}
				{:else if shape}
					<div class="shape-preview">
						<span class="shape-thumb" aria-hidden="true">
							{#if shape.thumb === 'sphere'}
								<span class="thumb-sphere"></span>
							{:else if shape.thumb === 'capsule'}
								<span class="thumb-capsule"></span>
							{:else}
								<span class="thumb-box"></span>
							{/if}
						</span>
						<span class="shape-hint">Drag onto the scene to place</span>
					</div>
				{/if}
			</div>

			{#if asset}
				<dl class="preview-meta">
					<div>
						<dt>URL</dt>
						<dd>{asset.url}</dd>
					</div>
					{#if asset.size}
						<div>
							<dt>Size</dt>
							<dd>{formatBytes(asset.size)}</dd>
						</div>
					{/if}
				</dl>
			{:else if shape}
				<dl class="preview-meta">
					<div>
						<dt>Mesh</dt>
						<dd>{shape.mesh}</dd>
					</div>
				</dl>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}

<style>
	.preview-kicker,
	dt {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.preview-stage {
		min-height: 180px;
		display: grid;
		place-items: center;
		border: 1px dashed color-mix(in srgb, var(--border) 65%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--viewport) 45%, transparent);
		overflow: hidden;
		padding: 12px;
	}

	.preview-stage img {
		max-width: 100%;
		max-height: min(40vh, 320px);
		object-fit: contain;
	}

	audio,
	video {
		width: min(420px, 100%);
		max-height: min(40vh, 320px);
	}

	.file-frame {
		width: 100%;
		height: min(50vh, 360px);
		border: none;
		border-radius: var(--radius-sm);
		background: var(--background);
	}

	.model-preview,
	.file-preview,
	.shape-preview {
		display: grid;
		gap: 8px;
		justify-items: center;
		color: var(--muted-foreground);
		font-size: 11px;
	}

	.file-open {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--foreground);
		text-decoration: none;
	}

	.file-open:hover {
		text-decoration: underline;
	}

	.shape-thumb {
		width: 120px;
		height: 120px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
	}

	.thumb-box {
		width: 48px;
		height: 48px;
		background: #d4d4d4;
		border-radius: 4px;
	}

	.thumb-sphere {
		width: 48px;
		height: 48px;
		background: #d4d4d4;
		border-radius: 50%;
	}

	.thumb-capsule {
		width: 32px;
		height: 56px;
		background: #d4d4d4;
		border-radius: 999px;
	}

	.preview-meta {
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.preview-meta div {
		min-width: 0;
	}

	dd {
		margin: 2px 0 0;
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		overflow-wrap: anywhere;
	}
</style>
