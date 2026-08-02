<script lang="ts">
	import { getComponent, getType } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import EntityGraphPanel from '$lib/ui/EntityGraphPanel.svelte';
	import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';
	import { graphBrowse } from '$lib/ui/graphBrowse.svelte';

	const selected = $derived(graphBrowse.selectedNode);

	const entity = $derived.by(() => {
		if (!selected || selected.kind !== 'entity') return null;
		return world.getEntity(selected.id) ?? null;
	});

	const typeSchema = $derived.by(() => {
		if (!selected) return null;
		if (selected.kind === 'type' || selected.kind === 'collection') {
			return getType(selected.label) ?? null;
		}
		return null;
	});

	const componentSchema = $derived.by(() => {
		if (!selected || selected.kind !== 'component') return null;
		return getComponent(selected.label) ?? null;
	});
</script>

<aside class="graph-inspector" aria-label="Graph node inspector">
	<div class="panel-header">
		<div class="section-label">Selection</div>
	</div>

	{#if !selected}
		<InspectorEmptyState
			title="No node selected"
			hint="Pick a type, component, or entity from the navigator or canvas."
		/>
	{:else}
		<div class="selection-card">
			<p class="kind">{graphBrowse.kindLabel(selected.kind)}</p>
			<h3 class="name">{selected.label}</h3>
			<p class="id">{selected.id}</p>
		</div>

		<div class="inspector-body">
			{#if entity}
				<EntityGraphPanel {entity} />
			{:else if typeSchema}
				<section class="facts">
					<h4>Components</h4>
					<ul>
						{#each typeSchema.components as component (component)}
							<li>{component}</li>
						{/each}
					</ul>
				</section>
			{:else if componentSchema}
				<section class="facts">
					<h4>Fields</h4>
					<ul>
						{#each Object.keys(componentSchema.fields) as field (field)}
							<li>
								<span class="field-name">{field}</span>
								<span class="field-type">{componentSchema.fields[field].t}</span>
							</li>
						{/each}
					</ul>
				</section>
			{:else}
				<p class="stub">Inspector wiring for this node kind is next.</p>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.graph-inspector {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
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

	.selection-card {
		padding: var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
		flex-shrink: 0;
	}

	.kind {
		margin: 0 0 4px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.name {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.id {
		margin: 6px 0 0;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		word-break: break-all;
	}

	.inspector-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	.facts {
		padding: var(--spacing-md);
	}

	.facts h4 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.facts ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}

	.facts li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 11px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--background) 70%, transparent);
	}

	.field-name {
		font-family: var(--font-mono);
		color: var(--foreground);
	}

	.field-type {
		color: var(--muted-foreground);
	}

	.stub {
		margin: 0;
		padding: var(--spacing-md);
		font-size: 12px;
		color: var(--muted-foreground);
	}
</style>
