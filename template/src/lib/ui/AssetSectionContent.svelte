<script lang="ts">
	import { dev } from '$app/environment';
	import AssetDropzone from '$lib/ui/AssetDropzone.svelte';
	import AssetItem from '$lib/ui/AssetItem.svelte';
	import CatalogAddTile from '$lib/ui/CatalogAddTile.svelte';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
	import {
		ASSET_KIND_LABELS,
		type AssetKind,
		type AssetEntry
	} from '$lib/assets/catalog';
	import { SHAPE_CATALOG, type ShapeEntry } from '$lib/assets/shapes';
	import { draftFromModel, draftFromShape, canStartPlacement } from '$lib/scene/placementSession';
	import { isAssetRoute } from '$lib/ui/assetRoutes';
	import { ui } from '$lib/ui/ui.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';

	interface Props {
		section: 'shapes' | AssetKind;
		/** Omit outer padding when nested in ModelsCatalogPanel. */
		embedded?: boolean;
	}

	let { section, embedded = false }: Props = $props();

	/** Off by default — recent assets still tracked in catalogPrefs for a future toggle. */
	const recentsVisible = false;

	let dropzone: AssetDropzone | undefined = $state();

	const viewMode = $derived(catalogPrefs.assetsViewMode);
	const placementArmedMesh = $derived(
		ui.placementDraft?.kind === 'mesh' ? ui.placementDraft.mesh : null
	);
	const canPlace = $derived(canStartPlacement() && assetLibrary.uploadingKind === null);
	const picking = $derived(ui.assetPickTarget !== null);
	const shapes = $derived(assetLibrary.filteredShapes());
	const items = $derived(section === 'shapes' ? [] : assetLibrary.grouped(section));
	const uploading = $derived(section !== 'shapes' && assetLibrary.uploadingKind === section);
	const hasSearch = $derived(assetLibrary.searchQuery.trim().length > 0);
	const selectedAssetUrl = $derived(
		isAssetRoute(ui.railRoute) && ui.previewContext?.kind === 'asset'
			? ui.previewContext.asset.url
			: null
	);
	const selectedShapeId = $derived(
		isAssetRoute(ui.railRoute) && ui.previewContext?.kind === 'shape'
			? ui.previewContext.shape.id
			: null
	);

	const recentShapes = $derived.by(() => {
		if (hasSearch || section !== 'shapes') return [] as ShapeEntry[];
		return catalogPrefs.recentAssets
			.filter((id) => id.startsWith('shape:'))
			.map((id) => SHAPE_CATALOG.find((shape) => `shape:${shape.id}` === id))
			.filter((shape): shape is ShapeEntry => !!shape && shapes.some((s) => s.id === shape.id));
	});

	const recentAssets = $derived.by(() => {
		if (hasSearch || section === 'shapes') return [] as AssetEntry[];
		return catalogPrefs.recentAssets
			.map((url) => assetLibrary.assets.find((asset) => asset.url === url))
			.filter(
				(asset): asset is AssetEntry =>
					!!asset && asset.kind === section && items.some((item) => item.url === asset.url)
			);
	});

	function selectShape(shape: ShapeEntry) {
		if (picking) assetLibrary.selectShape(shape);
		else assetLibrary.previewShape(shape);
	}

	function selectAsset(asset: AssetEntry) {
		assetLibrary.selectAsset(asset);
	}
</script>

{#snippet shapeTile(shape: ShapeEntry)}
	<button
		type="button"
		class="shape-tile"
		class:armed={placementArmedMesh === shape.mesh}
		class:selected={selectedShapeId === shape.id}
		aria-label={picking ? `Select ${shape.label}` : `Preview ${shape.label}`}
		disabled={false}
		draggable={canPlace && !picking}
		onclick={() => selectShape(shape)}
		ondragstart={(event) =>
			assetLibrary.beginPlacementDrag(event, draftFromShape(shape.mesh, shape.label))}
		ondragend={assetLibrary.endPlacementDrag}
	>
		<span class="shape-thumb" aria-hidden="true">
			{#if shape.thumb === 'sphere'}
				<span class="thumb-sphere"></span>
			{:else if shape.thumb === 'capsule'}
				<span class="thumb-capsule"></span>
			{:else}
				<span class="thumb-box"></span>
			{/if}
		</span>
		<span class="shape-label">{shape.label}</span>
	</button>
{/snippet}

{#snippet assetRow(asset: AssetEntry)}
	<AssetItem
		{asset}
		view={viewMode}
		armed={placementArmedMesh === asset.url}
		selected={selectedAssetUrl === asset.url}
		starred={catalogPrefs.isAssetStarred(asset.url)}
		draggable={asset.kind === 'models' && canPlace && !picking}
		onclick={() => selectAsset(asset)}
		onpreview={() => selectAsset(asset)}
		onstar={() => catalogPrefs.toggleAssetStar(asset.url)}
		ondragstart={(event) =>
			assetLibrary.beginPlacementDrag(event, draftFromModel(asset.url, asset.name))}
		ondragend={assetLibrary.endPlacementDrag}
	/>
{/snippet}

{#if section === 'shapes'}
	<div class:embedded>
	{#if !hasSearch && recentsVisible && recentShapes.length > 0}
		<section class="catalog-section" aria-label="Recent shapes">
			<h3 class="section-heading">Recent</h3>
			<div class="shapes-grid">
				{#each recentShapes as shape (shape.id)}
					{@render shapeTile(shape)}
				{/each}
			</div>
		</section>
	{/if}

	{#if shapes.length > 0}
		<div class="shapes-grid">
			{#each shapes as shape (shape.id)}
				{@render shapeTile(shape)}
			{/each}
		</div>
	{:else if hasSearch}
		<p class="empty-hint">No shapes match your search</p>
	{/if}
	</div>
{:else}
	<div class:embedded>
	<AssetDropzone
		bind:this={dropzone}
		kind={section}
		disabled={assetLibrary.uploadingKind !== null}
		onUpload={(files) => assetLibrary.uploadFiles(section, files)}
	>
		{#if dev && !embedded}
			<div class="section-toolbar">
				<span class="section-title">{ASSET_KIND_LABELS[section]}</span>
				<button
					type="button"
					class="add-asset-btn"
					aria-label="Add {ASSET_KIND_LABELS[section].toLowerCase()}"
					disabled={assetLibrary.uploadingKind !== null}
					onclick={() => dropzone?.browse()}
				>
					<PlusIcon class="size-3.5" />
				</button>
			</div>
		{/if}

		{#if !hasSearch && recentsVisible && recentAssets.length > 0}
			<section class="catalog-section" aria-label="Recent assets">
				<h3 class="section-heading">Recent</h3>
				<div class="asset-collection" class:grid={viewMode === 'grid'} class:list={viewMode === 'list'}>
					{#each recentAssets as asset (asset.url)}
						{@render assetRow(asset)}
					{/each}
				</div>
			</section>
		{/if}

		{#if items.length > 0}
			<div class="asset-collection" class:grid={viewMode === 'grid'} class:list={viewMode === 'list'}>
				{#each items as asset (asset.url)}
					{@render assetRow(asset)}
				{/each}
				{#if dev && viewMode === 'grid'}
					<CatalogAddTile
						layout="grid"
						label="Upload {ASSET_KIND_LABELS[section].toLowerCase()}"
						onclick={() => dropzone?.browse()}
					/>
				{/if}
			</div>
		{:else if !uploading}
			<p class="empty-hint">
				{hasSearch
					? `No ${ASSET_KIND_LABELS[section].toLowerCase()} match your search`
					: `No ${ASSET_KIND_LABELS[section].toLowerCase()} yet`}
			</p>
			{#if dev && !hasSearch}
				<div class="empty-upload">
					<CatalogAddTile
						layout={viewMode}
						label="Upload {ASSET_KIND_LABELS[section].toLowerCase()}"
						onclick={() => dropzone?.browse()}
					/>
				</div>
			{/if}
		{/if}

		{#if uploading}
			<p class="upload-status">Uploading…</p>
		{/if}
	</AssetDropzone>
	</div>
{/if}

<style>
	.catalog-section {
		margin-bottom: 10px;
	}

	.section-heading {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.shapes-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}

	.shape-tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		cursor: pointer;
		font-family: var(--font-mono);
		color: var(--foreground);
		text-align: center;
	}

	.shape-tile:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.shape-tile.armed {
		border-color: color-mix(in srgb, var(--accent-entity) 55%, var(--ring));
		background: color-mix(in srgb, var(--accent-entity) 22%, transparent);
	}

	.shape-tile.selected {
		border-color: color-mix(in srgb, var(--ring) 75%, var(--border));
		background: color-mix(in srgb, var(--card) 82%, transparent);
	}

	.shape-tile:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.shape-tile:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.shape-thumb {
		height: 48px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
	}

	.thumb-box {
		width: 22px;
		height: 22px;
		background: #d4d4d4;
		border-radius: 2px;
	}

	.thumb-sphere {
		width: 22px;
		height: 22px;
		background: #d4d4d4;
		border-radius: 50%;
	}

	.thumb-capsule {
		width: 14px;
		height: 26px;
		background: #d4d4d4;
		border-radius: 999px;
	}

	.shape-label {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.asset-collection.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}

	.asset-collection.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.section-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.section-title {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.add-asset-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.add-asset-btn:hover:not(:disabled) {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.add-asset-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.add-asset-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.empty-hint,
	.upload-status {
		margin: 0;
		padding: 8px 0;
		font-size: 11px;
		color: var(--muted-foreground);
		text-align: center;
	}

	.empty-upload {
		margin-top: 8px;
	}
</style>
