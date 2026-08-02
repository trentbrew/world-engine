<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import CatalogViewToggle from '$lib/ui/CatalogViewToggle.svelte';
	import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';

	interface Props {
		searchPlaceholder?: string;
		catalogLabel?: string;
		children: import('svelte').Snippet;
	}

	let {
		searchPlaceholder = 'Search assets…',
		catalogLabel = 'Assets',
		children
	}: Props = $props();

	const picking = $derived(ui.assetPickTarget !== null);

	onMount(() => {
		void assetLibrary.ensureLoaded();
	});
</script>

<div class="asset-catalog-panel">
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
				placeholder={searchPlaceholder}
				aria-label={searchPlaceholder}
				bind:value={assetLibrary.searchQuery}
			/>
			<CatalogViewToggle
				view={catalogPrefs.assetsViewMode}
				label={catalogLabel}
				onchange={(mode) => catalogPrefs.setAssetsViewMode(mode)}
			/>
		</label>
	</div>

	<div class="catalog-body">
		{#if assetLibrary.loading}
			<p class="status">Loading…</p>
		{:else if assetLibrary.error}
			<p class="status error">{assetLibrary.error}</p>
			<Button variant="outline" size="sm" onclick={() => void assetLibrary.refresh()}>
				Retry
			</Button>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.asset-catalog-panel {
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

	.catalog-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--spacing-sm) var(--spacing-sm);
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
