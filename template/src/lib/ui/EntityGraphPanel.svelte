<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import type { ComponentData, Entity } from '$lib/engine/ontology/schema';
	import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';

	const OTHER_REF_RE = /other\s*\(\s*['"](entity:[^'"]+)['"]\s*\)/g;

	interface Props {
		entity: Entity;
	}

	let { entity }: Props = $props();

	let openSections = $state(['references', 'facts']);

	const references = $derived(scanOtherRefs(entity.components));
	const facts = $derived(collectFacts(entity.components));

	function scanOtherRefs(components: Record<string, ComponentData>): string[] {
		const ids = new Set<string>();
		for (const bag of Object.values(components)) {
			for (const value of Object.values(bag)) {
				if (typeof value !== 'string') continue;
				for (const match of value.matchAll(OTHER_REF_RE)) {
					ids.add(match[1]);
				}
			}
		}
		return [...ids];
	}

	function collectFacts(components: Record<string, ComponentData>): [string, string][] {
		const rows: [string, string][] = [];
		for (const [component, bag] of Object.entries(components)) {
			for (const [field, value] of Object.entries(bag)) {
				if (typeof value === 'string' && value.startsWith('=')) continue;
				rows.push([`${component}.${field}`, formatFactValue(value)]);
			}
		}
		return rows;
	}

	function formatFactValue(value: unknown): string {
		if (typeof value === 'string') return value;
		return JSON.stringify(value);
	}
</script>

<div class="graph-panel">
	<Accordion.Root type="multiple" bind:value={openSections} class="inspector-accordion">
		<Accordion.Item value="references">
			<Accordion.Trigger class="inspector-trigger">References</Accordion.Trigger>
			<Accordion.Content class="inspector-content">
				{#if references.length === 0}
					<p class="inline-empty">No outgoing other() references</p>
				{:else}
					<ul class="ref-list">
						{#each references as ref (ref)}
							<li class="ref-item">{ref}</li>
						{/each}
					</ul>
				{/if}
			</Accordion.Content>
		</Accordion.Item>

		<Accordion.Item value="facts">
			<Accordion.Trigger class="inspector-trigger">Facts</Accordion.Trigger>
			<Accordion.Content class="inspector-content">
				{#if facts.length === 0}
					<InspectorEmptyState title="No facts" hint="No stored field values on this entity." />
				{:else}
					{#each facts as [key, val] (key)}
						<div class="fact-row">
							<span class="fact-key">{key}</span>
							<span class="fact-val">{val}</span>
						</div>
					{/each}
				{/if}
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>

<style>
	.graph-panel {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
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

	.inline-empty {
		font-size: 12px;
		color: var(--muted-foreground);
		margin: 0;
	}

	.ref-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.ref-item {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--accent-link);
		padding: 2px 0;
		word-break: break-all;
	}

	.fact-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 4px 0;
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.fact-row:first-child {
		border-top: none;
	}

	.fact-key {
		color: var(--muted-foreground);
		word-break: break-all;
	}

	.fact-val {
		color: var(--text-mono);
		text-align: right;
		max-width: 50%;
		word-break: break-all;
	}
</style>
