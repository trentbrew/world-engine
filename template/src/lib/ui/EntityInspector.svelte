<script lang="ts">
	import { world } from '$lib/engine/runtime/world.svelte';
	import { canNudgeSelectedTransform } from '$lib/ui/shellKeyboard';
	import type { ComponentData, Entity } from '$lib/engine/ontology/schema';

	function shortId(id: string): string {
		const parts = id.split('/');
		return parts[parts.length - 1] ?? id;
	}

	function typeDotClass(entity: Entity): string {
		if ('Ground' in entity.components) return 'ground';
		if ('Marker' in entity.components) return 'spawn';
		return 'prop';
	}

	function componentEntries(entity: Entity): [string, [string, string][]][] {
		return Object.entries(entity.components).map(([name, data]) => [
			name,
			fieldEntries(data)
		]);
	}

	function fieldEntries(data: ComponentData): [string, string][] {
		return Object.entries(data).map(([key, value]) => [key, formatValue(value)]);
	}

	function formatValue(value: unknown): string {
		if (Array.isArray(value)) return `[${value.join(', ')}]`;
		if (value && typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function formatFragment(entity: Entity): string {
		return JSON.stringify(
			{ '@id': entity.id, conformsTo: entity.type, components: entity.components },
			null,
			2
		);
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (canNudgeSelectedTransform()) return;

		const entities = world.selectableEntities;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const next = Math.min(index + 1, entities.length - 1);
			world.trySelect(entities[next].id, { notify: false });
			focusRow(next);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prev = Math.max(index - 1, 0);
			world.trySelect(entities[prev].id, { notify: false });
			focusRow(prev);
		}
	}

	function focusRow(index: number) {
		const row = document.querySelector<HTMLElement>(`[data-entity-index="${index}"]`);
		row?.focus();
	}

	const selected = $derived(world.selectedEntity);
</script>

<aside class="inspector" aria-label="Entity inspector">
	<div class="inspector-section">
		<div class="section-label">Entities</div>
	</div>

	<ul id="entity-list" class="entity-list" role="listbox" aria-label="World entities">
		{#each world.selectableEntities as entity, index (entity.id)}
			<li
				role="option"
				tabindex="0"
				data-entity-index={index}
				class="entity-row"
				class:entity-row-locked={!world.canTransformEntity(entity.id)}
				aria-selected={world.selection === entity.id}
				onclick={() => world.trySelect(entity.id)}
				onkeydown={(event) => handleKeydown(event, index)}
			>
				<span class="type-dot {typeDotClass(entity)}"></span>
				<span class="entity-id">{shortId(entity.id)}</span>
				<span class="entity-type">{entity.type ?? '—'}</span>
			</li>
		{/each}
	</ul>

	<div class="attrs">
		<div class="section-label">Attributes</div>
		{#if selected}
			<div class="attr-row">
				<span class="attr-key">@id</span>
				<span class="attr-val">{selected.id}</span>
			</div>
			<div class="attr-row">
				<span class="attr-key">conformsTo</span>
				<span class="attr-val">{selected.type ?? '—'}</span>
			</div>
			{#each componentEntries(selected) as [name, fields] (name)}
				<div class="comp-label">{name}</div>
				{#each fields as [key, value] (key)}
					<div class="attr-row">
						<span class="attr-key">{key}</span>
						<span class="attr-val">{value}</span>
					</div>
				{/each}
			{/each}
			<pre class="json-fragment" aria-hidden="true">{formatFragment(selected)}</pre>
		{:else}
			<p class="empty">Select an entity</p>
		{/if}
	</div>
</aside>

<style>
	.inspector {
		background: var(--background);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}

	.inspector-section {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--border);
	}

	.section-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.entity-list {
		list-style: none;
		overflow-y: auto;
		flex: 1;
		padding: var(--spacing-sm);
		margin: 0;
	}

	.entity-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px var(--spacing-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 11px;
		min-width: 0;
	}

	.entity-row:hover {
		background: var(--card);
	}

	.entity-row[aria-selected='true'] {
		background: color-mix(in srgb, var(--secondary) 55%, transparent);
	}

	.entity-row-locked {
		cursor: not-allowed;
		opacity: 0.72;
	}

	.entity-row-locked:hover {
		background: transparent;
	}

	.entity-row:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.type-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.type-dot.ground {
		background: var(--viewport-grid);
		border: 1px solid var(--muted-foreground);
	}

	.type-dot.prop {
		background: var(--primary);
	}

	.type-dot.spawn {
		background: var(--accent-spawn);
	}

	.entity-id {
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.entity-type {
		display: none;
	}

	.attrs {
		padding: var(--spacing-sm) var(--spacing-md);
		overflow-y: auto;
		max-height: 40%;
		border-top: 1px solid var(--border);
	}

	.comp-label {
		margin: var(--spacing-sm) 0 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent-link);
	}

	.attr-row {
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: 6px;
		margin-bottom: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.attr-key {
		color: var(--muted-foreground);
	}

	.attr-val {
		color: var(--text-mono);
		word-break: break-all;
	}

	.json-fragment {
		display: none;
	}

	.empty {
		color: var(--muted-foreground);
		font-size: 12px;
	}
</style>
