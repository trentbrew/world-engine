<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import type { CatalogViewMode } from '$lib/ui/catalogPrefs.svelte';

	interface Props {
		view: CatalogViewMode;
		onchange: (view: CatalogViewMode) => void;
		/** Accessible label prefix, e.g. "Assets" */
		label?: string;
	}

	let { view, onchange, label = 'Catalog' }: Props = $props();
</script>

<div class="catalog-view-toggle" role="group" aria-label="{label} layout">
	<button
		type="button"
		class="view-btn"
		class:active={view === 'grid'}
		aria-pressed={view === 'grid'}
		title="Grid view"
		onclick={() => onchange('grid')}
	>
		<LayoutGridIcon class="size-3.5" aria-hidden="true" />
	</button>
	<button
		type="button"
		class="view-btn"
		class:active={view === 'list'}
		aria-pressed={view === 'list'}
		title="List view"
		onclick={() => onchange('list')}
	>
		<ListIcon class="size-3.5" aria-hidden="true" />
	</button>
</div>

<style>
	.catalog-view-toggle {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
		border-radius: var(--field-control-radius);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		flex-shrink: 0;
	}

	.view-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: calc(var(--field-control-radius) - 2px);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.view-btn:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 55%, transparent);
	}

	.view-btn.active {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 85%, transparent);
	}

	.view-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}
</style>
