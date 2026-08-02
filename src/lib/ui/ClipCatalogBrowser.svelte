<script lang="ts">
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { loadCatalog, type CatalogClip, type ClipCatalog } from '$lib/engine/animation/clipCatalog';
	import { clipSearchText, describeClip } from '$lib/engine/animation/clipSemantics';

	interface Props {
		catalogRef: string;
		activeClip: string;
		embeddedClips?: string[];
		title?: string;
		subtitle?: string;
		readonly?: boolean;
		onSelect: (clipId: string) => void;
		/** Playback transport for the active clip (rendered inline on its card). */
		playing?: boolean;
		time?: number;
		duration?: number;
		onTogglePlay?: () => void;
		onScrub?: (time: number) => void;
	}

	let {
		catalogRef,
		activeClip,
		embeddedClips = [],
		title = 'Animations',
		subtitle = '',
		readonly = false,
		onSelect,
		playing = true,
		time = 0,
		duration = 0,
		onTogglePlay,
		onScrub
	}: Props = $props();

	let catalog = $state<ClipCatalog | null>(null);
	let search = $state('');
	let category = $state<string | 'all'>('all');
	let failedPreviews = $state<Set<string>>(new Set());

	$effect(() => {
		const ref = catalogRef;
		let cancelled = false;
		void loadCatalog(ref).then((c) => {
			if (!cancelled) catalog = c;
		});
		return () => {
			cancelled = true;
		};
	});

	const catalogClips = $derived(catalog?.clips ?? []);
	const embeddedClipEntries = $derived.by((): CatalogClip[] =>
		embeddedClips.map((id) => ({ id, category: 'embedded' }))
	);
	const allClips = $derived.by(() => {
		const seen = new Set<string>();
		const merged: CatalogClip[] = [];
		for (const clip of [...embeddedClipEntries, ...catalogClips]) {
			if (seen.has(clip.id)) continue;
			seen.add(clip.id);
			merged.push(clip);
		}
		return merged;
	});

	const categories = $derived.by(() => {
		const cats = new Set<string>();
		for (const c of allClips) {
			if (c.category) cats.add(c.category);
		}
		return ['all', ...[...cats].sort()];
	});

	const filteredClips = $derived.by((): CatalogClip[] => {
		const q = search.trim().toLowerCase();
		return allClips.filter((c) => {
			if (category !== 'all' && c.category !== category) return false;
			if (q && !clipSearchText(c).includes(q)) return false;
			return true;
		});
	});

	const catalogLabel = $derived(catalog?.name ?? catalogRef.replace(/^catalog:/, ''));

	// mesh2motion hosts a looping webm preview per clip, keyed by rig folder.
	const previewBase = $derived(
		catalog?.source === 'mesh2motion' && catalog.rig
			? `https://app.mesh2motion.org/animpreviews/${catalog.rig}`
			: null
	);

	function previewUrl(clipId: string): string | null {
		if (!previewBase) return null;
		return `${previewBase}/dark_${encodeURIComponent(clipId)}.webm`;
	}

	function markFailed(clipId: string) {
		if (failedPreviews.has(clipId)) return;
		const next = new Set(failedPreviews);
		next.add(clipId);
		failedPreviews = next;
	}

	function prettyClip(id: string): string {
		return id.replace(/_/g, ' ');
	}

	const frame = $derived(Math.max(0, Math.floor(time * 30)));
	const totalFrames = $derived(Math.max(1, Math.round(duration * 30)));

	function handleScrub(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(value)) onScrub?.(value);
	}
</script>

<div class="clip-catalog-browser" aria-label="Animation clips">
	<header class="browser-header">
		<div class="header-top">
			<div class="meta">
				<span class="title">{title}</span>
				<span class="subtitle">{subtitle || catalogLabel}</span>
			</div>
			<span class="count">{filteredClips.length} clip{filteredClips.length === 1 ? '' : 's'}</span>
		</div>

		<input
			type="search"
			class="filter"
			placeholder="Filter animations…"
			aria-label="Filter animations"
			bind:value={search}
		/>

		{#if categories.length > 1}
			<div class="cat-pills" role="tablist" aria-label="Animation categories">
				{#each categories as cat (cat)}
					<button
						type="button"
						role="tab"
						class="pill"
						class:active={category === cat}
						aria-selected={category === cat}
						onclick={() => (category = cat)}
					>
						{cat === 'all' ? 'All' : cat}
					</button>
				{/each}
			</div>
		{/if}
	</header>

	<div class="clip-grid" role="listbox" aria-label="Animation clips">
		{#each filteredClips as clip (clip.id)}
			{@const url = previewUrl(clip.id)}
			{@const isActive = clip.id === activeClip}
			{@const description = describeClip(clip)}
			<div class="clip-card" class:active={isActive}>
				<button
					type="button"
					role="option"
					class="clip-select"
					aria-selected={isActive}
					aria-label="{clip.id}: {description}"
					title={description}
					onclick={() => onSelect(clip.id)}
				>
					<span class="clip-thumb" aria-hidden="true">
						{#if url && !failedPreviews.has(clip.id)}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								class="thumb-video"
								src={url}
								muted
								loop
								autoplay
								playsinline
								preload="metadata"
								onerror={() => markFailed(clip.id)}
								disablePictureInPicture
								disableRemotePlayback
							></video>
						{:else}
							<span class="thumb-label">{clip.category ?? 'clip'}</span>
						{/if}
						{#if clip.dur}
							<span class="clip-dur">{clip.dur.toFixed(1)}s</span>
						{/if}
					</span>
					<span class="clip-title">{prettyClip(clip.id)}</span>
					<span class="clip-desc">{description}</span>
				</button>

				{#if isActive && onScrub}
					<div class="clip-transport" role="group" aria-label="Playback">
						<button
							type="button"
							class="mini-play"
							aria-label={playing ? 'Pause preview' : 'Play preview'}
							onclick={() => onTogglePlay?.()}
						>
							{#if playing}
								<PauseIcon class="size-3" aria-hidden="true" />
							{:else}
								<PlayIcon class="size-3" aria-hidden="true" />
							{/if}
						</button>
						<input
							type="range"
							class="mini-slider"
							min="0"
							max={Math.max(duration, 0.001)}
							step="0.01"
							value={time}
							aria-label="Scrub animation"
							oninput={handleScrub}
						/>
						<span class="mini-frames" aria-live="polite">{frame}/{totalFrames}</span>
					</div>
				{/if}
			</div>
		{:else}
			<p class="grid-empty">No animations match this filter.</p>
		{/each}
	</div>
</div>

<style>
	.clip-catalog-browser {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
	}

	.browser-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px 8px;
		flex-shrink: 0;
	}

	.header-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--foreground);
	}

	.subtitle {
		font-size: 10px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count {
		font-size: 10px;
		color: var(--muted-foreground);
		flex-shrink: 0;
		white-space: nowrap;
		padding-top: 2px;
	}

	.filter {
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--background) 80%, transparent);
		font-size: 11px;
		color: var(--foreground);
	}

	.filter::placeholder {
		color: var(--muted-foreground);
	}

	.cat-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pill {
		padding: 4px 10px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: 999px;
		background: transparent;
		font-size: 10px;
		font-weight: 500;
		text-transform: capitalize;
		color: var(--muted-foreground);
		cursor: pointer;
		white-space: nowrap;
	}

	.pill:hover {
		background: color-mix(in srgb, var(--muted) 30%, transparent);
		color: var(--foreground);
	}

	.pill.active {
		color: var(--primary-foreground, #fff);
		background: color-mix(in srgb, var(--primary) 82%, #c084fc);
		border-color: transparent;
	}

	.clip-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 0 12px 12px;
		overflow-y: auto;
		overflow-x: hidden;
		flex: 1 1 auto;
		min-height: 0;
		align-content: start;
		-webkit-overflow-scrolling: touch;
	}

	.clip-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--card) 55%, transparent);
		min-width: 0;
	}

	.clip-card:hover {
		border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
	}

	.clip-card.active {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 10%, var(--card));
	}

	.clip-select {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}

	.clip-thumb {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 4 / 3;
		border-radius: 4px;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 70%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 65%),
			color-mix(in srgb, var(--viewport) 70%, #0a0a12);
		border: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.thumb-video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		filter: contrast(2) grayscale(100%) brightness(1.1);
	}

	.thumb-label {
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: color-mix(in srgb, var(--muted-foreground) 85%, transparent);
	}

	.clip-dur {
		position: absolute;
		right: 4px;
		bottom: 4px;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 9px;
		font-family: var(--font-mono, monospace);
		color: #fff;
		background: color-mix(in srgb, #000 55%, transparent);
	}

	.clip-title {
		font-size: 10px;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.clip-desc {
		font-size: 9px;
		line-height: 1.35;
		color: var(--muted-foreground);
		overflow: hidden;
		line-clamp: 3;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
	}

	.clip-transport {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 2px;
	}

	.mini-play {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border: 0;
		border-radius: 5px;
		background: color-mix(in srgb, var(--primary) 82%, #c084fc);
		color: var(--primary-foreground, #fff);
		cursor: pointer;
	}

	.mini-slider {
		flex: 1 1 auto;
		min-width: 0;
		height: 14px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.mini-frames {
		font: 600 9px/1 var(--font-mono, monospace);
		color: var(--muted-foreground);
		flex-shrink: 0;
		white-space: nowrap;
	}

	.grid-empty {
		grid-column: 1 / -1;
		margin: 12px 0;
		text-align: center;
		font-size: 11px;
		color: var(--muted-foreground);
	}
</style>
