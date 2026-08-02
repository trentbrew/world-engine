<script lang="ts">
	import AssetThumbnail from '$lib/ui/AssetThumbnail.svelte';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import { formatBytes, type AssetEntry } from '$lib/assets/catalog';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import StarIcon from '@lucide/svelte/icons/star';

	interface Props {
		asset: AssetEntry;
		view: 'list' | 'grid';
		armed?: boolean;
		selected?: boolean;
		starred?: boolean;
		draggable?: boolean;
		onclick: () => void;
		onpreview?: () => void;
		onstar?: () => void;
		ondragstart?: (event: DragEvent) => void;
		ondragend?: () => void;
	}

	let {
		asset,
		view,
		armed = false,
		selected = false,
		starred = false,
		draggable = false,
		onclick,
		onpreview,
		onstar,
		ondragstart,
		ondragend
	}: Props = $props();

	const isAudio = $derived(asset.kind === 'audio');
	const playing = $derived(isAudio && assetLibrary.playingAudioUrl === asset.url);

	function onAudioPlay(event: MouseEvent) {
		event.stopPropagation();
		assetLibrary.toggleAudioPlayback(asset.url);
	}
</script>

<div
	class="asset-item"
	class:list={view === 'list'}
	class:grid={view === 'grid'}
	class:armed
	class:selected
>
	<div class="thumb-wrap">
		<button
			type="button"
			class="thumb-open"
			class:md={view === 'grid'}
			aria-label="Preview {asset.name}"
			{draggable}
			{onclick}
			{ondragstart}
			{ondragend}
		>
			<AssetThumbnail {asset} size={view === 'grid' ? 'md' : 'sm'} />
		</button>

		{#if isAudio}
			<button
				type="button"
				class="audio-play"
				aria-label={playing ? `Pause ${asset.name}` : `Play ${asset.name}`}
				aria-pressed={playing}
				onclick={onAudioPlay}
			>
				{#if playing}
					<PauseIcon class="size-3" aria-hidden="true" />
				{:else}
					<PlayIcon class="size-3" aria-hidden="true" />
				{/if}
			</button>
		{/if}
	</div>

	<button type="button" class="asset-meta-btn" {onclick}>
		<span class="asset-meta">
			<span class="asset-name" title={asset.name}>{asset.name}</span>
			{#if view === 'list'}
				<span class="asset-url" title={asset.url}>{asset.url}</span>
			{/if}
			{#if view === 'grid' && asset.size}
				<span class="asset-size-inline">{formatBytes(asset.size)}</span>
			{/if}
		</span>
		{#if view === 'list' && asset.size}
			<span class="asset-size">{formatBytes(asset.size)}</span>
		{/if}
	</button>

	{#if onpreview}
		<button type="button" class="asset-preview" aria-label="Preview {asset.name}" onclick={onpreview}>
			Preview
		</button>
	{/if}

	{#if onstar}
		<button
			type="button"
			class="asset-star"
			class:starred
			aria-label={starred ? `Unstar ${asset.name}` : `Star ${asset.name}`}
			aria-pressed={starred}
			onclick={(event) => {
				event.stopPropagation();
				onstar();
			}}
		>
			<StarIcon class="size-3" aria-hidden="true" />
		</button>
	{/if}
</div>

<style>
	.asset-item {
		color: var(--foreground);
		font-family: var(--font-mono);
		text-align: left;
	}

	.thumb-open,
	.asset-meta-btn,
	.asset-preview,
	.asset-star,
	.audio-play {
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-family: inherit;
	}

	.thumb-open:focus-visible,
	.asset-meta-btn:focus-visible,
	.asset-preview:focus-visible,
	.asset-star:focus-visible,
	.audio-play:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.thumb-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.thumb-open {
		display: block;
		padding: 0;
		width: 100%;
	}

	.thumb-open.md {
		width: 100%;
	}

	.audio-play {
		position: absolute;
		right: 4px;
		bottom: 4px;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card) 92%, transparent);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		color: var(--foreground);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--background) 35%, transparent);
	}

	.audio-play:hover {
		background: color-mix(in srgb, var(--accent-entity) 18%, var(--card));
		border-color: color-mix(in srgb, var(--accent-entity) 45%, var(--border));
	}

	.asset-item.list {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 0;
		border-radius: var(--radius-sm);
		font-size: 11px;
	}

	.asset-item.list .thumb-wrap {
		display: flex;
		align-items: center;
	}

	.asset-item.list .thumb-open {
		width: auto;
	}

	.asset-item.list .audio-play {
		right: -2px;
		bottom: -2px;
	}

	.asset-meta-btn {
		min-width: 0;
		flex: 1;
		text-align: left;
		padding: 0;
	}

	.asset-item.list .asset-meta-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
	}

	.asset-item.list:hover .asset-meta-btn {
		background: var(--card);
	}

	.asset-item.grid {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		min-width: 0;
	}

	.asset-item.grid .asset-meta-btn {
		display: block;
		width: 100%;
	}

	.asset-item.grid:hover {
		border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.asset-item.armed.grid,
	.asset-item.armed.list {
		border-color: color-mix(in srgb, var(--accent-entity) 55%, var(--ring));
		background: color-mix(in srgb, var(--accent-entity) 22%, transparent);
	}

	.asset-item.selected.grid,
	.asset-item.selected.list {
		border-color: color-mix(in srgb, var(--ring) 75%, var(--border));
		background: color-mix(in srgb, var(--card) 82%, transparent);
	}

	.asset-item.selected.armed.grid,
	.asset-item.selected.armed.list {
		border-color: color-mix(in srgb, var(--accent-entity) 65%, var(--ring));
	}

	.asset-item.armed.list {
		border: 1px solid color-mix(in srgb, var(--accent-entity) 55%, var(--ring));
		border-radius: var(--radius-sm);
	}

	.asset-preview {
		flex-shrink: 0;
		align-self: center;
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		font-size: 9px;
		color: var(--muted-foreground);
	}

	.asset-preview:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.asset-item.grid .asset-preview {
		align-self: stretch;
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
	}

	.asset-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.asset-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 10px;
		line-height: 1.3;
	}

	.grid .asset-name {
		white-space: normal;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.asset-url {
		font-size: 9px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.asset-size,
	.asset-size-inline {
		flex-shrink: 0;
		font-size: 9px;
		color: var(--muted-foreground);
	}

	.asset-size-inline {
		margin-top: 2px;
	}

	.asset-star {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 999px;
		color: var(--muted-foreground);
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.asset-item:hover .asset-star,
	.asset-star.starred,
	.asset-star:focus-visible {
		opacity: 1;
	}

	.asset-star.starred {
		color: color-mix(in srgb, #f5c542 85%, var(--foreground));
	}

	.asset-star:hover {
		color: color-mix(in srgb, #f5c542 85%, var(--foreground));
		background: color-mix(in srgb, var(--card) 80%, transparent);
	}

	.asset-item.list .asset-star {
		position: static;
		flex-shrink: 0;
		opacity: 1;
		border-radius: var(--radius-sm);
	}
</style>
