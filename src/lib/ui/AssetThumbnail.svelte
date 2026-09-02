<script lang="ts">
	import { loadModelThumbnail, peekModelThumbnail } from '$lib/assets/modelThumbnail';
	import { isVideoFile, isDocumentFile, type AssetEntry } from '$lib/assets/catalog';
	import BoxIcon from '@lucide/svelte/icons/box';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MusicIcon from '@lucide/svelte/icons/music';
	import { resolveAssetUrl } from '$lib/engine/render/meshRef';
	import VideoIcon from '@lucide/svelte/icons/video';

	interface Props {
		asset: AssetEntry;
		size?: 'sm' | 'md';
	}

	let { asset, size = 'sm' }: Props = $props();

	const isHdr = $derived(asset.name.toLowerCase().endsWith('.hdr'));
	const isTexturePreview = $derived(asset.kind === 'textures' && !isHdr);
	const isVideo = $derived(asset.kind === 'files' && isVideoFile(asset.name));
	const isDoc = $derived(asset.kind === 'files' && isDocumentFile(asset.name));

	let modelThumb = $state<string | null>(
		asset.kind === 'models' ? peekModelThumbnail(asset.url) : null
	);
	let textureFailed = $state(false);

	$effect(() => {
		textureFailed = false;
		if (asset.kind !== 'models') {
			modelThumb = null;
			return;
		}

		const url = asset.url;
		modelThumb = peekModelThumbnail(url);
		if (modelThumb) return;

		const renderSize = size === 'md' ? 96 : 64;
		let cancelled = false;
		void loadModelThumbnail(url, renderSize).then((result) => {
			if (!cancelled && result) modelThumb = result;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="asset-thumb" class:md={size === 'md'} aria-hidden="true">
	{#if isTexturePreview && !textureFailed}
		<img src={resolveAssetUrl(asset.url)} alt="" loading="lazy" decoding="async" onerror={() => (textureFailed = true)} />
	{:else if asset.kind === 'models' && modelThumb}
		<img src={modelThumb} alt="" />
	{:else if asset.kind === 'models'}
		<BoxIcon class="thumb-icon" />
	{:else if asset.kind === 'audio'}
		<MusicIcon class="thumb-icon" />
	{:else if isVideo}
		<VideoIcon class="thumb-icon" />
	{:else if isDoc}
		<FileTextIcon class="thumb-icon" />
	{:else if asset.kind === 'files'}
		<FileIcon class="thumb-icon" />
	{:else}
		<ImageIcon class="thumb-icon" />
	{/if}
</div>

<style>
	.asset-thumb {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
		overflow: hidden;
	}

	.asset-thumb.md {
		width: 100%;
		height: 72px;
		border-radius: var(--radius-sm);
	}

	.asset-thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.asset-thumb :global(.thumb-icon) {
		width: 14px;
		height: 14px;
		opacity: 0.55;
		color: var(--muted-foreground);
	}

	.asset-thumb.md :global(.thumb-icon) {
		width: 22px;
		height: 22px;
	}
</style>
