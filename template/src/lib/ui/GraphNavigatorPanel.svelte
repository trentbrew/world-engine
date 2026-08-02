<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { graphBrowse, type GraphNodeKind } from '$lib/ui/graphBrowse.svelte';

	const FILTERS: GraphNodeKind[] = ['all', 'type', 'component', 'entity', 'collection'];
</script>

<aside class="graph-nav" aria-label="Graph navigator">
	<div class="panel-header">
		<div class="section-label">Ontology</div>
		<span class="node-count">{graphBrowse.filteredNodes.length}</span>
	</div>

	<div class="search-wrap">
		<label class="search-row">
			<SearchIcon class="size-3.5 search-icon" aria-hidden="true" />
			<input
				type="search"
				class="search-input"
				placeholder="Search nodes…"
				aria-label="Search graph nodes"
				bind:value={graphBrowse.search}
			/>
		</label>
	</div>

	<div class="filter-row" role="tablist" aria-label="Graph node kinds">
		{#each FILTERS as kind (kind)}
			<button
				type="button"
				role="tab"
				class="filter-chip"
				class:active={graphBrowse.filter === kind}
				aria-selected={graphBrowse.filter === kind}
				onclick={() => graphBrowse.setFilter(kind)}
			>
				{graphBrowse.kindLabel(kind)}
			</button>
		{/each}
	</div>

	<ul class="node-list" role="listbox" aria-label="Graph nodes">
		{#each graphBrowse.filteredNodes as node (node.id)}
			<li>
				<button
					type="button"
					role="option"
					class="node-row"
					class:selected={graphBrowse.selection === node.id}
					aria-selected={graphBrowse.selection === node.id}
					onclick={() => graphBrowse.select(node.id)}
				>
					<span class="node-kind">{graphBrowse.kindLabel(node.kind)}</span>
					<span class="node-label">{node.label}</span>
					<span class="node-detail">{node.detail}</span>
				</button>
			</li>
		{:else}
			<li class="empty">No nodes match this filter.</li>
		{/each}
	</ul>
</aside>

<style>
	.graph-nav {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		flex-shrink: 0;
	}

	.section-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.node-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.search-wrap {
		padding: var(--spacing-sm) var(--spacing-md);
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

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 0 var(--spacing-md) var(--spacing-sm);
		flex-shrink: 0;
	}

	.filter-chip {
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		border-radius: 999px;
		background: transparent;
		color: var(--muted-foreground);
		font: 600 10px/1 inherit;
		padding: 4px 8px;
		cursor: pointer;
	}

	.filter-chip.active {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
		background: color-mix(in srgb, var(--primary) 10%, transparent);
	}

	.node-list {
		list-style: none;
		margin: 0;
		padding: 0 var(--spacing-sm) var(--spacing-sm);
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
	}

	.node-row {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas:
			'kind label'
			'kind detail';
		gap: 0 8px;
		width: 100%;
		padding: 8px var(--spacing-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.node-row:hover {
		background: color-mix(in srgb, var(--muted) 28%, transparent);
	}

	.node-row.selected {
		background: color-mix(in srgb, var(--primary) 12%, transparent);
	}

	.node-kind {
		grid-area: kind;
		align-self: start;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		padding-top: 1px;
	}

	.node-label {
		grid-area: label;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.node-detail {
		grid-area: detail;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		padding: var(--spacing-md);
		font-size: 12px;
		color: var(--muted-foreground);
	}
</style>
