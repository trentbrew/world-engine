<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import StarIcon from '@lucide/svelte/icons/star';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CatalogAddTile from '$lib/ui/CatalogAddTile.svelte';
	import CatalogViewToggle from '$lib/ui/CatalogViewToggle.svelte';
	import ObjectTypeThumb from '$lib/ui/ObjectTypeThumb.svelte';
	import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
	import { getType, isBuiltinType, listObjectTypes } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const types = $derived.by(() => {
		void world.typeRevision;
		void catalogPrefs.starredTypes;
		return listObjectTypes()
			.map((name) => ({
				name,
				def: getType(name)
			}))
			.sort((a, b) => {
				const aStar = catalogPrefs.isTypeStarred(a.name) ? 0 : 1;
				const bStar = catalogPrefs.isTypeStarred(b.name) ? 0 : 1;
				if (aStar !== bStar) return aStar - bStar;
				return a.name.localeCompare(b.name);
			});
	});

	const viewMode = $derived(catalogPrefs.objectsViewMode);
	const selected = $derived(ui.selectedObjectType);
	const DEFAULT_OBJECT_TYPE = 'Character';
	/** Off by default — recent types still tracked in catalogPrefs for a future toggle. */
	const recentsVisible = false;

	const recentTypes = $derived.by(() => {
		return catalogPrefs.recentTypes
			.filter((name) => types.some((row) => row.name === name))
			.map((name) => types.find((row) => row.name === name)!)
			.filter(Boolean);
	});

	$effect(() => {
		if (ui.railRoute !== 'objects') return;
		if (selected && types.some((row) => row.name === selected)) return;
		const fallback =
			types.find((row) => row.name === DEFAULT_OBJECT_TYPE)?.name ?? types[0]?.name ?? null;
		ui.selectObjectType(fallback);
	});

	function selectType(name: string) {
		catalogPrefs.touchRecentType(name);
		ui.selectObjectType(name);
	}

	function toggleStar(event: MouseEvent, name: string) {
		event.stopPropagation();
		catalogPrefs.toggleTypeStar(name);
	}

	function thumbFor(typeName: string): string | null {
		const type = getType(typeName);
		if (!type) return null;
		const skinned = type.defaults?.SkinnedMesh?.mesh;
		if (typeof skinned === 'string' && skinned && !skinned.startsWith('primitive:')) return skinned;
		const render = type.defaults?.Render?.mesh;
		if (typeof render === 'string' && render && !render.startsWith('primitive:')) return render;
		const sprite = type.defaults?.Sprite?.texture;
		if (typeof sprite === 'string' && sprite) return sprite;
		return null;
	}
</script>

<div class="objects-resource-panel" aria-label="Object resources">
	<header class="panel-header">
		<div class="header-top">
			<h2>Objects</h2>
			<div class="header-actions">
				<CatalogViewToggle
					view={viewMode}
					label="Objects"
					onchange={(mode) => catalogPrefs.setObjectsViewMode(mode)}
				/>
				<Button
					variant="outline"
					size="sm"
					class="new-type-btn inspector-footer-btn"
					aria-label="New object type"
					onclick={() => ui.openNewObjectTypeDialog()}
				>
					<PlusIcon class="size-3.5" aria-hidden="true" />
					New
				</Button>
			</div>
		</div>
		<p>Define what things are — capabilities and defaults — before placing them in rooms.</p>
	</header>

	<div class="catalog-scroll" role="listbox" aria-label="Object types">
		{#if recentsVisible && recentTypes.length > 0}
			<section class="catalog-section" aria-label="Recent object types">
				<h3 class="section-heading">Recent</h3>
				{#if viewMode === 'grid'}
					<div class="type-grid">
						{#each recentTypes as row (row.name)}
							{@const thumb = thumbFor(row.name)}
							<div class="type-tile-wrap">
								<button
									type="button"
									class="type-star"
									class:starred={catalogPrefs.isTypeStarred(row.name)}
									aria-label={catalogPrefs.isTypeStarred(row.name)
										? `Unstar ${row.name}`
										: `Star ${row.name}`}
									onclick={(event) => toggleStar(event, row.name)}
								>
									<StarIcon class="size-3" aria-hidden="true" />
								</button>
								<button
									type="button"
									class="type-tile"
									class:active={selected === row.name}
									role="option"
									aria-selected={selected === row.name}
									onclick={() => selectType(row.name)}
								>
									<span class="type-thumb" aria-hidden="true">
										<ObjectTypeThumb mesh={thumb} />
									</span>
									<span class="type-meta">
										<span class="type-name">{row.name}</span>
										<Badge variant="outline" class="type-badge">
											{isBuiltinType(row.name) ? 'built-in' : 'custom'}
										</Badge>
									</span>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<ul class="type-list">
						{#each recentTypes as row (row.name)}
							<li>
								<div class="type-row-wrap">
									<button
										type="button"
										class="type-row"
										class:active={selected === row.name}
										role="option"
										aria-selected={selected === row.name}
										onclick={() => selectType(row.name)}
									>
										<span class="type-name">{row.name}</span>
										<Badge variant="outline" class="type-badge">
											{isBuiltinType(row.name) ? 'built-in' : 'custom'} ·
											{row.def?.components.length ?? 0}
										</Badge>
									</button>
									<button
										type="button"
										class="type-star list-star"
										class:starred={catalogPrefs.isTypeStarred(row.name)}
										aria-label={catalogPrefs.isTypeStarred(row.name)
											? `Unstar ${row.name}`
											: `Star ${row.name}`}
										onclick={(event) => toggleStar(event, row.name)}
									>
										<StarIcon class="size-3" aria-hidden="true" />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if viewMode === 'grid'}
			<div class="type-grid">
				{#each types as row (row.name)}
					{@const thumb = thumbFor(row.name)}
					<div class="type-tile-wrap">
						<button
							type="button"
							class="type-star"
							class:starred={catalogPrefs.isTypeStarred(row.name)}
							aria-label={catalogPrefs.isTypeStarred(row.name)
								? `Unstar ${row.name}`
								: `Star ${row.name}`}
							onclick={(event) => toggleStar(event, row.name)}
						>
							<StarIcon class="size-3" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="type-tile"
							class:active={selected === row.name}
							role="option"
							aria-selected={selected === row.name}
							onclick={() => selectType(row.name)}
						>
							<span class="type-thumb" aria-hidden="true">
								<ObjectTypeThumb mesh={thumb} />
							</span>
							<span class="type-meta">
								<span class="type-name">{row.name}</span>
								<Badge variant="outline" class="type-badge">
									{isBuiltinType(row.name) ? 'built-in' : 'custom'}
								</Badge>
							</span>
						</button>
					</div>
				{/each}
				<CatalogAddTile
					layout="grid"
					label="New object type"
					onclick={() => ui.openNewObjectTypeDialog()}
				/>
			</div>
		{:else}
			<ul class="type-list">
				{#each types as row (row.name)}
					<li>
						<div class="type-row-wrap">
							<button
								type="button"
								class="type-row"
								class:active={selected === row.name}
								role="option"
								aria-selected={selected === row.name}
								onclick={() => selectType(row.name)}
							>
								<span class="type-name">{row.name}</span>
								<Badge variant="outline" class="type-badge">
									{isBuiltinType(row.name) ? 'built-in' : 'custom'} · {row.def?.components.length ?? 0}
								</Badge>
							</button>
							<button
								type="button"
								class="type-star list-star"
								class:starred={catalogPrefs.isTypeStarred(row.name)}
								aria-label={catalogPrefs.isTypeStarred(row.name)
									? `Unstar ${row.name}`
									: `Star ${row.name}`}
								onclick={(event) => toggleStar(event, row.name)}
							>
								<StarIcon class="size-3" aria-hidden="true" />
							</button>
						</div>
					</li>
				{/each}
				<li>
					<CatalogAddTile
						layout="list"
						label="New object type"
						onclick={() => ui.openNewObjectTypeDialog()}
					/>
				</li>
			</ul>
		{/if}
	</div>

	<p class="hint">Rooms is for instances — select an object here to edit its type definition.</p>
</div>

<style>
	.objects-resource-panel {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		flex-shrink: 0;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.panel-header h2 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
	}

	.panel-header p {
		margin: 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	:global(.new-type-btn) {
		flex-shrink: 0;
		width: auto;
		padding-inline: 10px;
	}

	.catalog-scroll {
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
	}

	.catalog-section {
		padding: var(--spacing-sm) var(--spacing-sm) 0;
	}

	.section-heading {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.type-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: var(--spacing-sm);
		align-content: start;
	}

	.catalog-section .type-grid {
		padding: 0;
		margin-bottom: 8px;
	}

	.type-tile-wrap,
	.type-row-wrap {
		position: relative;
		min-width: 0;
	}

	.type-row-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.type-tile {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		min-height: 72px;
		padding: 6px;
		border-radius: var(--field-control-radius);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--background) 35%, transparent);
		color: var(--foreground);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
	}

	.type-tile:hover,
	.type-row:hover {
		background: color-mix(in srgb, var(--secondary) 35%, transparent);
	}

	.type-tile.active,
	.type-row.active {
		border-color: color-mix(in srgb, var(--accent-entity) 55%, var(--border));
		background: color-mix(in srgb, var(--accent-entity) 12%, transparent);
		color: var(--accent-entity);
	}

	.type-star {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card) 75%, transparent);
		color: var(--muted-foreground);
		cursor: pointer;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.type-tile-wrap:hover .type-star,
	.type-star.starred,
	.type-star:focus-visible,
	.type-star.list-star {
		opacity: 1;
	}

	.type-star.starred {
		color: color-mix(in srgb, #f5c542 85%, var(--foreground));
	}

	.type-star.list-star {
		position: static;
		background: transparent;
		flex-shrink: 0;
	}

	.type-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 40px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		overflow: hidden;
	}

	.type-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.type-name {
		font-size: 11px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.type-badge) {
		width: fit-content;
		font-size: 9px;
		padding: 0 4px;
		height: 16px;
	}

	.type-list {
		list-style: none;
		margin: 0;
		padding: var(--spacing-sm);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.type-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border: 1px solid transparent;
		border-radius: var(--field-control-radius);
		background: none;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		cursor: pointer;
		text-align: left;
	}

	.type-row .type-name {
		flex: 1;
		min-width: 0;
	}

	.hint {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		font-size: 11px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}
</style>
