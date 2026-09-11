<script lang="ts">
	/**
	 * Assets as a floating palette instead of a full route. Same catalog content
	 * as `AssetsCatalogPanel` — only the container and the column count differ,
	 * so there is one source of truth for the catalog itself.
	 */
	import type { AssetKind } from '$lib/assets/catalog';
	import AssetCatalogShell from '$lib/ui/AssetCatalogShell.svelte';
	import AssetSectionContent from '$lib/ui/AssetSectionContent.svelte';
	import DockPopover from '$lib/ui/DockPopover.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const TABS: { id: AssetKind; label: string }[] = [
		{ id: 'models', label: 'Models' },
		{ id: 'textures', label: 'Textures' },
		{ id: 'audio', label: 'Audio' },
		{ id: 'files', label: 'Files' }
	];

	const open = $derived(ui.dockPopover === 'assets' && ui.shellMode === 'edit');
	const placeholder = $derived(
		ui.assetsTab === 'models' ? 'Search models…' : `Search ${ui.assetsTab}…`
	);
	const label = $derived(TABS.find((t) => t.id === ui.assetsTab)?.label ?? 'Assets');

	function expandToRoute() {
		ui.closeDockPopover();
		ui.setRoute('assets');
	}
</script>

<DockPopover
	{open}
	title="Assets"
	storageKey="assets"
	defaultWidth={700}
	defaultHeight={440}
	minWidth={420}
	onclose={() => ui.closeDockPopover()}
	onexpand={expandToRoute}
>
	{#snippet header()}
		<div class="tab-row" role="tablist" aria-label="Asset type">
			{#each TABS as tab (tab.id)}
				<button
					type="button"
					role="tab"
					class="tab-btn"
					class:active={ui.assetsTab === tab.id}
					aria-selected={ui.assetsTab === tab.id}
					onclick={() => (ui.assetsTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	{/snippet}

	<div class="palette-catalog">
		<AssetCatalogShell searchPlaceholder={placeholder} catalogLabel={label}>
			{#if ui.assetsTab === 'models'}
				<section class="catalog-section" aria-label="Primitives">
					<h3 class="section-heading">Primitives</h3>
					<AssetSectionContent section="shapes" embedded />
				</section>
				<section class="catalog-section" aria-label="Models">
					<h3 class="section-heading">Models</h3>
					<AssetSectionContent section="models" embedded />
				</section>
			{:else}
				<AssetSectionContent section={ui.assetsTab} />
			{/if}
		</AssetCatalogShell>
	</div>
</DockPopover>

<style>
	/* Segmented control — the header is horizontal here, not a stacked panel. */
	.tab-row {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--field-control-radius);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
	}

	.tab-btn {
		padding: 4px 10px;
		border: none;
		border-radius: calc(var(--field-control-radius) - 2px);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.tab-btn:hover:not(.active) {
		color: var(--foreground);
	}

	.tab-btn.active {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 85%, transparent);
	}

	.tab-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.palette-catalog {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/*
	 * The catalog grid is hard-coded to 2 columns for the 250px side panel.
	 * At palette width that reads as a list, so reflow to fill the extra room.
	 */
	.palette-catalog :global(.asset-collection.grid),
	.palette-catalog :global(.shapes-grid) {
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
	}

	.catalog-section + .catalog-section {
		margin-top: 12px;
	}

	.section-heading {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
</style>
