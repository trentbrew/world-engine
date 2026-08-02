<script lang="ts">
	import { loadCatalog, type CatalogClip, type ClipCatalog } from '$lib/engine/animation/clipCatalog';
	import { comp } from '$lib/engine/render/access';
	import { world } from '$lib/engine/runtime/world.svelte';
	import ObjectClipGrid from '$lib/ui/ObjectClipGrid.svelte';
	import { ui, type ObjectLeftTab } from '$lib/ui/ui.svelte';

	const entityId = $derived(ui.objectTarget);
	const entity = $derived(entityId ? world.getEntity(entityId) : undefined);
	const anim = $derived(
		entity
			? comp<{ catalog?: string; clip?: string }>(entity, 'Mesh3DAnimator')
			: undefined
	);
	const skin = $derived(
		entity ? comp<{ mesh?: string; rig?: string }>(entity, 'SkinnedMesh') : undefined
	);

	let catalog = $state<ClipCatalog | null>(null);
	let search = $state('');
	let category = $state<string | 'all'>('all');

	const TABS: { id: ObjectLeftTab; label: string }[] = [
		{ id: 'clips', label: 'Clips' },
		{ id: 'structure', label: 'Structure' }
	];

	$effect(() => {
		const ref = anim?.catalog ?? 'catalog:mesh2motion-human';
		let cancelled = false;
		void loadCatalog(ref).then((c) => {
			if (!cancelled) catalog = c;
		});
		return () => {
			cancelled = true;
		};
	});

	const categories = $derived.by(() => {
		const cats = new Set<string>();
		for (const c of catalog?.clips ?? []) {
			if (c.category) cats.add(c.category);
		}
		return ['all', ...[...cats].sort()];
	});

	const filteredClips = $derived.by((): CatalogClip[] => {
		const q = search.trim().toLowerCase();
		return (catalog?.clips ?? []).filter((c) => {
			if (category !== 'all' && c.category !== category) return false;
			if (q && !c.id.toLowerCase().includes(q)) return false;
			return true;
		});
	});
</script>

<div class="object-clip-library" aria-label="Clip library">
	<div class="panel-tabs" role="tablist" aria-label="Object views">
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				role="tab"
				class="panel-tab"
				class:active={ui.objectLeftTab === tab.id}
				aria-selected={ui.objectLeftTab === tab.id}
				onclick={() => (ui.objectLeftTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if ui.objectLeftTab === 'clips'}
		<div class="clip-toolbar">
			<input
				type="search"
				class="search"
				placeholder="Search clips…"
				aria-label="Search clips"
				bind:value={search}
			/>
			<div class="cats" role="tablist" aria-label="Clip categories">
				{#each categories as cat (cat)}
					<button
						type="button"
						class="cat"
						class:active={category === cat}
						onclick={() => (category = cat)}
					>
						{cat === 'all' ? 'All' : cat}
					</button>
				{/each}
			</div>
		</div>
		{#if entityId && anim?.clip}
			<ObjectClipGrid
				clips={filteredClips}
				activeClip={anim.clip}
				onSelect={(clipId) => world.setField(entityId, 'Mesh3DAnimator', 'clip', clipId)}
			/>
		{:else}
			<div class="clip-empty" role="status">
				<p>Select a character with SkinnedMesh + Mesh3DAnimator, or double-click one in Scene.</p>
			</div>
		{/if}
	{:else}
		<div class="structure" role="tabpanel">
			<dl>
				<div>
					<dt>Mesh</dt>
					<dd>{skin?.mesh ?? '—'}</dd>
				</div>
				<div>
					<dt>Rig</dt>
					<dd>{skin?.rig ?? 'human'}</dd>
				</div>
				<div>
					<dt>Catalog</dt>
					<dd>{anim?.catalog ?? '—'}</dd>
				</div>
				<div>
					<dt>Clips</dt>
					<dd>{catalog?.clips?.length ?? 0}</dd>
				</div>
			</dl>
		</div>
	{/if}
</div>

<style>
	.object-clip-library {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.panel-tabs {
		display: flex;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		padding: 0 var(--spacing-sm);
		flex-shrink: 0;
	}

	.panel-tab {
		flex: 1;
		font-size: 11px;
		font-weight: 500;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.panel-tab.active {
		color: var(--foreground);
		border-bottom-color: var(--primary);
	}

	.clip-toolbar {
		padding: var(--spacing-sm);
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
	}

	.search {
		width: 100%;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: var(--background);
		font-size: 11px;
		color: var(--foreground);
	}

	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.cat {
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: transparent;
		font-size: 10px;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.cat.active {
		color: var(--foreground);
		border-color: var(--accent-entity);
		background: color-mix(in srgb, var(--accent-entity) 12%, transparent);
	}

	.clip-empty {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-md);
	}

	.clip-empty p {
		margin: 0;
		max-width: 28ch;
		font-size: 12px;
		line-height: 1.45;
		text-align: center;
		color: var(--muted-foreground);
	}

	.structure {
		padding: var(--spacing-md);
		overflow-y: auto;
	}

	dl {
		margin: 0;
		display: grid;
		gap: 10px;
	}

	dt {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	dd {
		margin: 2px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		word-break: break-all;
	}
</style>
