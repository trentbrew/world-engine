<script lang="ts">
	import { graphBrowse } from '$lib/ui/graphBrowse.svelte';

	const visibleNodes = $derived(graphBrowse.filteredNodes.slice(0, 48));
</script>

<div class="graph-viewport chrome-float-card glass-panel-shell chrome-opacity-main chrome-main-card" aria-label="Graph canvas">
	<header class="graph-toolbar">
		<div>
			<h2 class="title">World graph</h2>
			<p class="lede">
				Ontology map — types, components, and entities in this game file. Read-only scaffold;
				relationship edges land next.
			</p>
		</div>
		<span class="meta">{graphBrowse.nodes.length} nodes</span>
	</header>

	<div class="graph-canvas" role="presentation">
		{#each visibleNodes as node, index (node.id)}
			<button
				type="button"
				class="graph-node"
				class:selected={graphBrowse.selection === node.id}
				style:--node-x={`${(index % 6) * 16}%`}
				style:--node-y={`${Math.floor(index / 6) * 22}%`}
				onclick={() => graphBrowse.select(node.id)}
			>
				<span class="kind">{graphBrowse.kindLabel(node.kind)}</span>
				<span class="label">{node.label}</span>
			</button>
		{/each}

		{#if graphBrowse.filteredNodes.length === 0}
			<p class="canvas-empty">No nodes to show — try another filter or search term.</p>
		{:else if graphBrowse.filteredNodes.length > visibleNodes.length}
			<p class="canvas-more">
				+{graphBrowse.filteredNodes.length - visibleNodes.length} more in the navigator
			</p>
		{/if}
	</div>
</div>

<style>
	.graph-viewport {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.graph-toolbar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		border-bottom: 1px solid var(--chrome-divider);
		flex-shrink: 0;
	}

	.title {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
	}

	.lede {
		margin: 0;
		max-width: 52ch;
		font-size: 12px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.meta {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		white-space: nowrap;
		padding-top: 2px;
	}

	.graph-canvas {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		background-color: color-mix(in srgb, var(--viewport) 88%, transparent);
		background-image: radial-gradient(
			color-mix(in srgb, var(--border) 55%, transparent) 1px,
			transparent 1px
		);
		background-size: 20px 20px;
	}

	.graph-node {
		position: absolute;
		left: calc(8% + var(--node-x));
		top: calc(8% + var(--node-y));
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 120px;
		max-width: 180px;
		padding: 10px 12px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--card) 92%, transparent);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
		text-align: left;
		cursor: pointer;
	}

	.graph-node:hover {
		border-color: color-mix(in srgb, var(--ring) 65%, var(--border));
	}

	.graph-node.selected {
		border-color: var(--primary);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent),
			0 10px 28px rgb(0 0 0 / 0.22);
	}

	.kind {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.label {
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.canvas-empty,
	.canvas-more {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		font-size: 12px;
		color: var(--muted-foreground);
		text-align: center;
		max-width: 36ch;
	}

	.canvas-more {
		top: auto;
		bottom: var(--spacing-md);
		transform: translateX(-50%);
		font-family: var(--font-mono);
		font-size: 10px;
	}
</style>
