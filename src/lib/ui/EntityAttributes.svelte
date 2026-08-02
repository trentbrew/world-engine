<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { getComponent } from '$lib/engine/ontology/registry';
	import type { ComponentData, Entity } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import ComponentFieldInput from '$lib/ui/ComponentFieldInput.svelte';
	import InspectorRangeField from '$lib/ui/InspectorRangeField.svelte';
	import { layoutComponentFields } from '$lib/ui/inspectorFieldLayout';
	import { ui } from '$lib/ui/ui.svelte';

	function fieldsForComponent(component: string, data: ComponentData): [string, unknown][] {
		const schema = getComponent(component);
		const keys = new Set([...Object.keys(schema?.fields ?? {}), ...Object.keys(data)]);
		return [...keys].map((key) => [key, data[key] ?? schema?.fields[key]?.default]);
	}

	function fieldRowsForComponent(component: string, data: ComponentData) {
		const fields = fieldsForComponent(component, data);
		const values = new Map(fields);
		return layoutComponentFields(
			component,
			fields.map(([name]) => name)
		).map((row) => ({
			...row,
			entries: row.fields.map((name) => [name, values.get(name)] as [string, unknown])
		}));
	}

	function componentNames(entity: Entity): string[] {
		return Object.keys(entity.components);
	}

	const selected = $derived(world.selectedEntity);
	const componentKey = $derived.by(() => {
		void world.entities.length;
		void world.entityStructureRevision;
		const entity = world.selectedEntity;
		return entity ? Object.keys(entity.components).sort().join(',') : '';
	});
	// Reactive component list for the render loop — tracks structural changes
	// (add/remove component, JSON apply) that mutate `.components` in place.
	const renderedComponentNames = $derived.by(() => {
		void world.entityStructureRevision;
		void world.entities.length;
		return selected ? Object.keys(selected.components) : [];
	});
	let openSections = $state<string[]>([]);

	$effect(() => {
		const entity = selected;
		void componentKey;
		openSections = entity ? componentNames(entity) : [];
	});

	interface Props {
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();
</script>

<aside class="attributes-panel" class:embedded aria-label="Entity attributes">
	{#if !embedded}
		<div class="panel-header">
			<div class="section-label">Attributes</div>
		</div>
	{/if}

	<div class="panel-body">
		{#if selected}
			{#key world.entityStructureRevision}
			<Accordion.Root type="multiple" bind:value={openSections} class="inspector-accordion">
				{#each renderedComponentNames as name (name)}
					<Accordion.Item value={name}>
						<Accordion.Trigger class="inspector-trigger">{name}</Accordion.Trigger>
						<Accordion.Content class="inspector-content">
							{#if name === 'Mesh3DAnimator' && ui.isAnimatableEntity(selected.id)}
								<button
									type="button"
									class="object-editor-link"
									onclick={() => ui.editObject(selected.id)}
								>
									Open in Object editor →
								</button>
							{/if}
							{#each fieldRowsForComponent(name, selected.components[name]) as row (row.key)}
								{#if row.widget === 'header'}
									<div class="field-subsection">{row.label ?? row.key}</div>
								{:else if row.widget === 'range' && row.fields.length === 2}
									<InspectorRangeField
										entityId={selected.id}
										component={name}
										minField={row.fields[0]}
										maxField={row.fields[1]}
										label={row.label ?? row.key}
									/>
								{:else}
									{#each row.entries as [field, value] (field)}
										<ComponentFieldInput
											entityId={selected.id}
											component={name}
											{field}
											{value}
										/>
									{/each}
								{/if}
							{/each}
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
			{/key}
		{:else}
			<p class="empty">Select an entity</p>
		{/if}
	</div>
</aside>

<style>
	.attributes-panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
	}

	.attributes-panel:not(.embedded) {
		height: max-content;
		max-height: inherit;
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

	.panel-body {
		overflow-y: auto;
		min-height: 0;
		max-height: min(60vh, 480px);
	}

	.attributes-panel.embedded {
		flex: 1;
		min-height: 0;
	}

	.attributes-panel.embedded .panel-body {
		flex: 1;
		min-height: 0;
		max-height: none;
		overflow-y: auto;
	}

	:global(.inspector-accordion) {
		padding: var(--spacing-sm) var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.inspector-accordion [data-slot='accordion-item']) {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 32%, transparent);
		padding-bottom: 6px;
	}

	:global(.inspector-accordion [data-slot='accordion-item']:last-child) {
		border-bottom: none;
		padding-bottom: 0;
	}

	.object-editor-link {
		display: block;
		width: calc(100% - var(--spacing-md) * 2);
		margin: 0 var(--spacing-md) var(--spacing-sm);
		padding: 6px 8px;
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--field-control-radius);
		background: transparent;
		font-size: 11px;
		color: var(--muted-foreground);
		cursor: pointer;
		text-align: left;
	}

	.object-editor-link:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 5%, transparent);
	}

	:global(.inspector-trigger) {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
		padding-left: 0;
		padding-right: 0;
		position: sticky;
		top: 0;
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		z-index: 10;
	}

	:global(.inspector-trigger:hover) {
		color: var(--foreground);
		text-decoration: none;
	}

	:global(.inspector-content) {
		padding-left: var(--spacing-md);
		padding-right: 0;
		padding-bottom: var(--spacing-sm);
	}

	.empty {
		padding: var(--spacing-md);
		color: var(--muted-foreground);
		font-size: 12px;
	}

	.field-subsection {
		margin: 10px 0 6px;
		padding-top: 8px;
		border-top: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.field-subsection:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}
</style>
