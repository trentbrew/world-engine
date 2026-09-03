<script lang="ts">
	import type { AssetKind } from '$lib/assets/catalog';
	import AssetCatalogShell from '$lib/ui/AssetCatalogShell.svelte';
	import AssetSectionContent from '$lib/ui/AssetSectionContent.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type AssetTab = AssetKind;

	const TABS: { id: AssetTab; label: string }[] = [
		{ id: 'models', label: 'Models' },
		{ id: 'textures', label: 'Textures' },
		{ id: 'audio', label: 'Audio' },
		{ id: 'files', label: 'Files' }
	];

	const placeholder = $derived(
		ui.assetsTab === 'models'
			? 'Search models…'
			: `Search ${ui.assetsTab.toLowerCase()}…`
	);
	const label = $derived(
		ui.assetsTab === 'models' ? 'Models' : TABS.find((t) => t.id === ui.assetsTab)?.label ?? 'Assets'
	);
</script>

<div class="assets-panel">
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

<style>
	.assets-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.tab-row {
		display: flex;
		gap: 2px;
		padding: var(--spacing-sm) var(--spacing-sm) 0;
		flex-shrink: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
	}

	.tab-btn {
		flex: 1;
		padding: 6px 4px;
		border: none;
		border-bottom: 1px solid transparent;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: transparent;
		color: var(--muted-foreground);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}

	.tab-btn:hover:not(.active) {
		color: var(--foreground);
	}

	.tab-btn.active {
		color: var(--foreground);
		border-bottom-color: var(--ring);
	}

	.tab-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
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
