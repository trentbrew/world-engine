<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import { Button } from '$lib/components/ui/button/index.js';
	import { listCollections, listComponents, getType } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	// world.entities is reactive; touch it so the collection list recomputes on change.
	const collections = $derived.by(() => {
		void world.entities.length;
		void world.componentRevision;
		void world.typeRevision;
		return listCollections();
	});

	const activeCollection = $derived(ui.collectionsCollection);

	let creating = $state(false);
	let newName = $state('');
	let newComponents = $state<string[]>([]);

	const availableComponents = $derived.by(() => {
		void world.entities.length;
		return listComponents();
	});

	function toggleComponent(name: string) {
		newComponents = newComponents.includes(name)
			? newComponents.filter((c) => c !== name)
			: [...newComponents, name];
	}

	function openCreate() {
		creating = true;
		newName = '';
		newComponents = [];
	}

	function submitCreate() {
		const result = world.defineCollection(newName, newComponents);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success(`Created collection ${newName.trim()}`);
		ui.selectCollection(newName.trim());
		creating = false;
	}
</script>

<aside class="collections-panel" aria-label="Collections">
	<div class="panel-header">
		<div class="section-label">Collections</div>
		<Button
			variant="ghost"
			size="icon"
			class="header-add"
			aria-label="New collection"
			onclick={openCreate}
		>
			<PlusIcon class="size-4" aria-hidden="true" />
		</Button>
	</div>

	{#if creating}
		<form
			class="create-form"
			onsubmit={(e) => {
				e.preventDefault();
				submitCreate();
			}}
		>
			<input
				class="create-name"
				placeholder="Collection name (e.g. Quest)"
				bind:value={newName}
				aria-label="Collection name"
			/>
			<div class="component-picker" role="group" aria-label="Components">
				{#each availableComponents as name (name)}
					<label class="component-check">
						<input
							type="checkbox"
							checked={newComponents.includes(name)}
							onchange={() => toggleComponent(name)}
						/>
						<span>{name}</span>
					</label>
				{/each}
			</div>
			<div class="create-actions">
				<Button type="submit" size="sm" disabled={!newName.trim()}>Create</Button>
				<Button type="button" variant="ghost" size="sm" onclick={() => (creating = false)}>
					Cancel
				</Button>
			</div>
		</form>
	{/if}

	<div class="panel-body">
		{#if collections.length === 0 && !creating}
			<p class="empty">
				No collections yet. Create one to manage game-global data — story beats, characters,
				level info.
			</p>
		{/if}

		{#each collections as name (name)}
			{@const meta = getType(name)?.collectionMeta}
			<button
				type="button"
				class="collection-row"
				class:active={activeCollection === name}
				aria-current={activeCollection === name ? 'true' : undefined}
				onclick={() => ui.selectCollection(name)}
			>
				<DatabaseIcon class="size-3.5 collection-icon" aria-hidden="true" />
				<span class="collection-name">{meta?.plural ?? name}</span>
				<span class="collection-count">{world.recordsFor(name).length}</span>
			</button>
		{/each}
	</div>
</aside>

<style>
	.collections-panel {
		position: relative;
		z-index: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--chrome-divider);
		flex-shrink: 0;
	}

	.section-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--chrome-divider);
	}

	.create-name {
		width: 100%;
		height: 30px;
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--field-control-radius);
		background: var(--card);
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
	}

	.component-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		max-height: 120px;
		overflow-y: auto;
	}

	.component-check {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.create-actions {
		display: flex;
		gap: 6px;
	}

	.create-actions :global([data-slot='button']) {
		border-radius: var(--field-control-radius) !important;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
	}

	.empty {
		padding: var(--spacing-md);
		color: var(--muted-foreground);
		font-size: 12px;
		line-height: 1.5;
	}

	.collection-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 32px;
		padding: 0 8px;
		margin-bottom: 2px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--foreground);
		cursor: pointer;
		text-align: left;
	}

	.collection-row:hover {
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.collection-row.active {
		background: color-mix(in srgb, var(--accent-entity) 12%, transparent);
		color: var(--accent-entity);
	}

	:global(.collection-icon) {
		flex-shrink: 0;
		opacity: 0.7;
	}

	.collection-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;
	}

	.collection-count {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}
</style>
