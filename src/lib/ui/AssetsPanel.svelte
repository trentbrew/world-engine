<script lang="ts">
	/** @deprecated Legacy tabbed assets panel — replaced by route-scoped catalog panels (TRL assets rail split). */
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import AssetSectionContent from '$lib/ui/AssetSectionContent.svelte';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import { ui, type AssetsSection } from '$lib/ui/ui.svelte';
	import BoxIcon from '@lucide/svelte/icons/box';
	import FileIcon from '@lucide/svelte/icons/file';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MusicIcon from '@lucide/svelte/icons/music';
	import CatalogViewToggle from '$lib/ui/CatalogViewToggle.svelte';
	import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ShapesIcon from '@lucide/svelte/icons/shapes';

	type SectionEntry = {
		id: AssetsSection;
		label: string;
		icon: typeof ShapesIcon;
	};

	const SECTIONS: SectionEntry[] = [
		{ id: 'shapes', label: 'Shapes', icon: ShapesIcon },
		{ id: 'models', label: 'Models', icon: BoxIcon },
		{ id: 'textures', label: 'Textures', icon: ImageIcon },
		{ id: 'audio', label: 'Audio', icon: MusicIcon },
		{ id: 'files', label: 'Files', icon: FileIcon }
	];

	const picking = $derived(ui.assetPickTarget !== null);
	const section = $derived(ui.assetsSection);

	onMount(() => {
		void assetLibrary.ensureLoaded();
	});
</script>

<div class="assets-panel">
	{#if picking}
		<div class="pick-hint" role="status">
			<span>Pick an asset for the selected field</span>
			<Button
				variant="ghost"
				size="sm"
				class="pick-cancel"
				onclick={() => (ui.assetPickTarget = null)}
			>
				Cancel
			</Button>
		</div>
	{/if}

	<div class="search-wrap">
		<label class="search-row">
			<SearchIcon class="size-3.5 search-icon" aria-hidden="true" />
			<input
				type="search"
				class="search-input"
				placeholder="Search assets…"
				aria-label="Search assets"
				bind:value={assetLibrary.searchQuery}
			/>
			<CatalogViewToggle
				view={catalogPrefs.assetsViewMode}
				label="Assets"
				onchange={(mode) => catalogPrefs.setAssetsViewMode(mode)}
			/>
		</label>
	</div>

	<div class="section-tabs" role="tablist" aria-label="Asset categories">
		{#each SECTIONS as entry (entry.id)}
			{@const Icon = entry.icon}
			<button
				type="button"
				role="tab"
				class="section-tab"
				class:active={section === entry.id}
				aria-selected={section === entry.id}
				title={entry.label}
				onclick={() => (ui.assetsSection = entry.id)}
			>
				<Icon class="size-3.5" aria-hidden="true" />
				<span class="section-tab-label">{entry.label}</span>
			</button>
		{/each}
	</div>

	<div class="assets-body">
		{#if assetLibrary.loading}
			<p class="status">Loading…</p>
		{:else if assetLibrary.error}
			<p class="status error">{assetLibrary.error}</p>
			<Button variant="outline" size="sm" onclick={() => void assetLibrary.refresh()}>
				Retry
			</Button>
		{:else}
			<AssetSectionContent {section} />
		{/if}
	</div>
</div>

<style>
	.assets-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.pick-hint {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: var(--spacing-sm);
		margin-bottom: 0;
		padding: 6px 8px 6px 10px;
		border-radius: var(--field-control-radius);
		background: color-mix(in srgb, var(--accent-entity) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent-entity) 35%, var(--border));
		font-size: 11px;
		color: var(--accent-entity);
		flex-shrink: 0;
	}

	:global(.pick-cancel) {
		height: 24px;
		padding: 0 8px;
		font-size: 11px;
	}

	.search-wrap {
		padding: var(--spacing-sm);
		flex-shrink: 0;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0 8px;
		height: 28px;
		border-radius: var(--field-control-radius);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		flex-shrink: 0;
	}

	.search-row:focus-within {
		border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
	}

	:global(.search-icon) {
		flex-shrink: 0;
		color: var(--muted-foreground);
	}

	.search-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 11px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--muted-foreground);
	}

	.section-tabs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 2px;
		padding: var(--spacing-sm);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		flex-shrink: 0;
	}

	.section-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-width: 0;
		padding: 6px 4px;
		border: none;
		border-radius: var(--field-control-radius);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 9px;
		font-weight: 500;
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.section-tab:hover:not(.active) {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 55%, transparent);
	}

	.section-tab.active {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 85%, transparent);
	}

	.section-tab:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.section-tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.assets-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-sm);
	}

	.status {
		margin: 0;
		font-size: 12px;
		color: var(--muted-foreground);
		text-align: center;
	}

	.status.error {
		color: var(--destructive);
		margin-bottom: 8px;
	}
</style>
