<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getComponent, getType } from '$lib/engine/ontology/registry';
	import { canSaveAsType } from '$lib/engine/ontology/captureType';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { ui } from '$lib/ui/ui.svelte';
	import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';

	interface Props {
		entity: Entity;
	}

	let { entity }: Props = $props();

	const entityType = $derived(entity.type ? getType(entity.type) : undefined);
	const componentNames = $derived(Object.keys(entity.components));
	const saveEligibility = $derived(canSaveAsType(entity));

	let openSections = $state<string[]>([]);

	$effect(() => {
		openSections = entityType
			? ['type', ...componentNames]
			: componentNames.length > 0
				? [...componentNames]
				: [];
	});

	function openSaveTypeDialog() {
		ui.saveTypeEntityId = entity.id;
		ui.saveTypeOpen = true;
	}
</script>

<div class="schema-panel">
	<div class="schema-body">
		{#if componentNames.length === 0}
			<InspectorEmptyState title="No components" hint="Add components via the Props tab." />
		{:else}
			<Accordion.Root type="multiple" bind:value={openSections} class="inspector-accordion">
				{#if entityType && entity.type}
					<Accordion.Item value="type">
						<Accordion.Trigger class="inspector-trigger">Type · {entityType.name}</Accordion.Trigger>
						<Accordion.Content class="inspector-content">
							<div class="meta-row">
								<span class="meta-key">conformsTo</span>
								<span class="meta-val">{entity.type}</span>
							</div>
							<div class="meta-row">
								<span class="meta-key">components</span>
								<span class="meta-val">{entityType.components.join(', ')}</span>
							</div>
						</Accordion.Content>
					</Accordion.Item>
				{:else if entity.type}
					<InspectorEmptyState
						title="Unknown type"
						hint={`conformsTo "${entity.type}" is not in the registry.`}
					/>
				{/if}

				{#each componentNames as name (name)}
					{@const schema = getComponent(name)}
					<Accordion.Item value={name}>
						<Accordion.Trigger class="inspector-trigger">{name}</Accordion.Trigger>
						<Accordion.Content class="inspector-content">
							{#if schema}
								{#each Object.entries(schema.fields) as [field, spec] (field)}
									<div class="schema-field">
										<span class="field-name">{field}</span>
										<span class="field-type">{spec.t}</span>
										<span class="sync-badge" class:realtime={spec.sync === 'realtime'}>
											{spec.sync ?? 'durable'}
										</span>
									</div>
								{/each}
							{:else}
								<p class="no-schema">No ComponentSchema registered for {name}</p>
							{/if}
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}
	</div>

	<div class="schema-footer">
		<Button
			variant="outline"
			size="sm"
			class="save-type-btn inspector-footer-btn"
			disabled={!saveEligibility.ok}
			title={saveEligibility.ok ? undefined : saveEligibility.reason}
			onclick={openSaveTypeDialog}
		>
			Save as type…
		</Button>
	</div>
</div>

<style>
	.schema-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.schema-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.schema-footer {
		flex-shrink: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		background: color-mix(in srgb, var(--background) 80%, transparent);
	}

	:global(.save-type-btn) {
		width: 100%;
		font-size: 11px;
	}

	:global(.inspector-accordion) {
		padding: var(--spacing-sm) var(--spacing-md);
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
	}

	.meta-row {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 6px;
		margin-bottom: 6px;
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.meta-key {
		color: var(--muted-foreground);
	}

	.meta-val {
		color: var(--text-mono);
		word-break: break-all;
	}

	.schema-field {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 8px;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 4px 0;
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.schema-field:first-child {
		border-top: none;
	}

	.field-name {
		color: var(--foreground);
	}

	.field-type {
		color: var(--muted-foreground);
	}

	.sync-badge {
		font-size: 9px;
		padding: 1px 5px;
		border-radius: 4px;
		background: var(--card);
		color: var(--muted-foreground);
		text-transform: uppercase;
	}

	.sync-badge.realtime {
		color: var(--success);
	}

	.no-schema {
		font-size: 11px;
		color: var(--muted-foreground);
		margin: 0;
	}
</style>
