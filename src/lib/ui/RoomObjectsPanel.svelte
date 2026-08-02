<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import CatalogAddTile from '$lib/ui/CatalogAddTile.svelte';
	import CatalogViewToggle from '$lib/ui/CatalogViewToggle.svelte';
	import { catalogPrefs } from '$lib/ui/catalogPrefs.svelte';
	import {
		getType,
		isBuiltinType,
		listObjectTypes
	} from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import {
		canStartPlacement,
		draftFromType,
		startPlacement,
		type TypePlacementDraft
	} from '$lib/scene/placementSession';
	import { writePlacementDrag } from '$lib/scene/placementDrag';
	import { assetLibrary } from '$lib/ui/assetLibrary.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import StarIcon from '@lucide/svelte/icons/star';

	const SOFT_HIDE = new Set(['GroundPlane', 'AmbientLight', 'DirectionalLight']);
	/** Off by default — recent types still tracked in catalogPrefs for a future toggle. */
	const recentsVisible = false;

	let search = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const viewMode = $derived(catalogPrefs.objectsViewMode);

	const placeable = $derived.by(() => {
		void world.typeRevision;
		void catalogPrefs.starredTypes;
		return listObjectTypes()
			.filter((name) => {
				if (SOFT_HIDE.has(name)) return false;
				return getType(name)?.components.includes('Transform') ?? false;
			})
			.sort((a, b) => {
				const aStar = catalogPrefs.isTypeStarred(a) ? 0 : 1;
				const bStar = catalogPrefs.isTypeStarred(b) ? 0 : 1;
				if (aStar !== bStar) return aStar - bStar;
				return a.localeCompare(b);
			});
	});

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return placeable;
		return placeable.filter((name) => name.toLowerCase().includes(q));
	});

	const recentTypes = $derived.by(() => {
		if (search.trim()) return [];
		return catalogPrefs.recentTypes.filter((name) => placeable.includes(name));
	});

	const armedType = $derived(
		ui.placementDraft?.kind === 'type' ? ui.placementDraft.typeName : null
	);
	const inPlay = $derived(ui.shellMode === 'play');
	const canPlace = $derived(canStartPlacement() && !inPlay);

	$effect(() => {
		void ui.objectsCatalogSearchFocusRequest;
		if (ui.roomsPaneTab !== 'objects') return;
		queueMicrotask(() => searchInput?.focus());
	});

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

	function armType(typeName: string) {
		if (!canPlace) return;
		catalogPrefs.touchRecentType(typeName);
		startPlacement(draftFromType(typeName));
	}

	function onDragStart(event: DragEvent, typeName: string) {
		if (!canPlace || !event.dataTransfer) return;
		const draft = draftFromType(typeName) as TypePlacementDraft;
		catalogPrefs.touchRecentType(typeName);
		writePlacementDrag(event.dataTransfer, draft);
		startPlacement(draft);
	}

	function onDragEnd() {
		assetLibrary.endPlacementDrag();
	}

	function toggleStar(event: MouseEvent, typeName: string) {
		event.stopPropagation();
		catalogPrefs.toggleTypeStar(typeName);
	}

	function addNewType() {
		ui.addNewObjectType();
	}
</script>

<div class="room-objects-panel" aria-label="Place object types">
	<p class="subtitle">Place types into this room</p>

	<div class="search-wrap">
		<label class="search-row">
			<SearchIcon class="size-3.5 search-icon" aria-hidden="true" />
			<input
				type="search"
				class="search-input"
				placeholder="Search object types…"
				aria-label="Search object types"
				bind:value={search}
				bind:this={searchInput}
			/>
			<CatalogViewToggle
				view={viewMode}
				label="Objects"
				onchange={(mode) => catalogPrefs.setObjectsViewMode(mode)}
			/>
		</label>
	</div>

	{#if inPlay}
		<p class="play-hint" role="status">Exit play to place objects.</p>
	{/if}

	<div class="catalog-scroll">
		{#if recentsVisible && !search.trim() && recentTypes.length > 0}
			<section class="catalog-section" aria-label="Recent object types">
				<h3 class="section-heading">Recent</h3>
				{#if viewMode === 'grid'}
					<div class="type-grid">
						{#each recentTypes as typeName (typeName)}
							{@const thumb = thumbFor(typeName)}
							<div class="type-tile-wrap">
								<button
									type="button"
									class="type-star"
									class:starred={catalogPrefs.isTypeStarred(typeName)}
									aria-label={catalogPrefs.isTypeStarred(typeName)
										? `Unstar ${typeName}`
										: `Star ${typeName}`}
									aria-pressed={catalogPrefs.isTypeStarred(typeName)}
									onclick={(event) => toggleStar(event, typeName)}
								>
									<StarIcon class="size-3" aria-hidden="true" />
								</button>
								<button
									type="button"
									class="type-tile"
									class:armed={armedType === typeName}
									aria-pressed={armedType === typeName}
									aria-label={`Place ${typeName}`}
									disabled={!canPlace}
									draggable={canPlace}
									onclick={() => armType(typeName)}
									ondragstart={(event) => onDragStart(event, typeName)}
									ondragend={onDragEnd}
								>
									<span class="type-thumb" aria-hidden="true">
										{#if thumb}
											<img src={thumb} alt="" />
										{:else}
											<span class="thumb-box"></span>
										{/if}
									</span>
									<span class="type-meta">
										<span class="type-name">{typeName}</span>
										<Badge variant="outline" class="type-badge">
											{isBuiltinType(typeName) ? 'built-in' : 'custom'}
										</Badge>
									</span>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<ul class="type-list">
						{#each recentTypes as typeName (typeName)}
							<li>
								<div class="type-row-wrap">
									<button
										type="button"
										class="type-row"
										class:armed={armedType === typeName}
										disabled={!canPlace}
										draggable={canPlace}
										onclick={() => armType(typeName)}
										ondragstart={(event) => onDragStart(event, typeName)}
										ondragend={onDragEnd}
									>
										<span class="type-name">{typeName}</span>
										<Badge variant="outline" class="type-badge">
											{isBuiltinType(typeName) ? 'built-in' : 'custom'}
										</Badge>
									</button>
									<button
										type="button"
										class="type-star list-star"
										class:starred={catalogPrefs.isTypeStarred(typeName)}
										aria-label={catalogPrefs.isTypeStarred(typeName)
											? `Unstar ${typeName}`
											: `Star ${typeName}`}
										onclick={(event) => toggleStar(event, typeName)}
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

		{#if filtered.length > 0}
			{#if viewMode === 'grid'}
				<div class="type-grid">
					{#each filtered as typeName (typeName)}
						{@const thumb = thumbFor(typeName)}
						<div class="type-tile-wrap">
							<button
								type="button"
								class="type-star"
								class:starred={catalogPrefs.isTypeStarred(typeName)}
								aria-label={catalogPrefs.isTypeStarred(typeName)
									? `Unstar ${typeName}`
									: `Star ${typeName}`}
								aria-pressed={catalogPrefs.isTypeStarred(typeName)}
								onclick={(event) => toggleStar(event, typeName)}
							>
								<StarIcon class="size-3" aria-hidden="true" />
							</button>
							<button
								type="button"
								class="type-tile"
								class:armed={armedType === typeName}
								aria-pressed={armedType === typeName}
								aria-label={`Place ${typeName}`}
								disabled={!canPlace}
								draggable={canPlace}
								onclick={() => armType(typeName)}
								ondragstart={(event) => onDragStart(event, typeName)}
								ondragend={onDragEnd}
							>
								<span class="type-thumb" aria-hidden="true">
									{#if thumb}
										<img src={thumb} alt="" />
									{:else}
										<span class="thumb-box"></span>
									{/if}
								</span>
								<span class="type-meta">
									<span class="type-name">{typeName}</span>
									<Badge variant="outline" class="type-badge">
										{isBuiltinType(typeName) ? 'built-in' : 'custom'}
									</Badge>
								</span>
							</button>
						</div>
					{/each}
					<CatalogAddTile layout="grid" label="New object type" onclick={addNewType} />
				</div>
			{:else}
				<ul class="type-list">
					{#each filtered as typeName (typeName)}
						<li>
							<div class="type-row-wrap">
								<button
									type="button"
									class="type-row"
									class:armed={armedType === typeName}
									disabled={!canPlace}
									draggable={canPlace}
									onclick={() => armType(typeName)}
									ondragstart={(event) => onDragStart(event, typeName)}
									ondragend={onDragEnd}
								>
									<span class="type-name">{typeName}</span>
									<Badge variant="outline" class="type-badge">
										{isBuiltinType(typeName) ? 'built-in' : 'custom'}
									</Badge>
								</button>
								<button
									type="button"
									class="type-star list-star"
									class:starred={catalogPrefs.isTypeStarred(typeName)}
									aria-label={catalogPrefs.isTypeStarred(typeName)
										? `Unstar ${typeName}`
										: `Star ${typeName}`}
									onclick={(event) => toggleStar(event, typeName)}
								>
									<StarIcon class="size-3" aria-hidden="true" />
								</button>
							</div>
						</li>
					{/each}
					<li>
						<CatalogAddTile layout="list" label="New object type" onclick={addNewType} />
					</li>
				</ul>
			{/if}
		{:else if search.trim()}
			<div class="empty">
				<p>No types match “{search.trim()}”.</p>
				<Button variant="outline" size="sm" onclick={() => (search = '')}>Clear search</Button>
			</div>
		{:else}
			<div class="empty">
				<p>No placeable types in this world.</p>
				<Button variant="outline" size="sm" onclick={addNewType}>Create object type</Button>
			</div>
		{/if}
	</div>
</div>

<style>
	.room-objects-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: auto;
		max-height: 100%;
		flex: 0 1 auto;
		overflow: hidden;
	}

	.subtitle {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-sm) 0;
		font-size: 11px;
		color: var(--muted-foreground);
		flex-shrink: 0;
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
		font-size: 12px;
		outline: none;
	}

	.play-hint {
		margin: var(--spacing-sm);
		margin-bottom: 0;
		padding: 6px 10px;
		border-radius: var(--field-control-radius);
		background: color-mix(in srgb, var(--muted) 40%, transparent);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		font-size: 11px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.catalog-scroll {
		overflow-y: auto;
		min-height: 0;
		flex: 1;
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

	.type-tile-wrap {
		position: relative;
		min-width: 0;
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

	.type-tile:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.type-tile.armed,
	.type-row.armed {
		border-color: color-mix(in srgb, var(--accent-entity) 55%, var(--border));
		background: color-mix(in srgb, var(--accent-entity) 22%, transparent);
	}

	.type-tile:focus-visible,
	.type-row:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
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

	.type-tile:hover .type-star,
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

	.type-thumb img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.thumb-box {
		width: 18px;
		height: 18px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--muted-foreground) 45%, transparent);
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
		gap: 8px;
		flex: 1;
		min-width: 0;
		width: 100%;
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

	.type-row-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.type-row:hover:not(:disabled) {
		background: color-mix(in srgb, var(--secondary) 35%, transparent);
	}

	.type-row:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.type-row .type-name {
		flex: 1;
		min-width: 0;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: var(--spacing-md);
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.empty p {
		margin: 0;
	}
</style>
