<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	interface Props {
		entity: Entity;
	}

	let { entity }: Props = $props();

	let draft = $state('');
	let baseline = $state('');
	let syncedKey = $state('');
	let error = $state<string | null>(null);

	const componentKey = $derived(Object.keys(entity.components).sort().join(','));
	const entityKey = $derived(`${entity.id}:${componentKey}`);
	const dirty = $derived(draft !== baseline);

	function syncFromWorld() {
		const json = world.entityJsonString(entity.id);
		baseline = json;
		draft = json;
		error = null;
	}

	$effect(() => {
		const key = entityKey;
		if (key === syncedKey) return;
		syncedKey = key;
		syncFromWorld();
	});

	function revert() {
		draft = baseline;
		error = null;
	}

	function apply() {
		if (draft === baseline) return;

		const result = world.applyEntityJson(entity.id, draft);
		if (!result.ok) {
			error = result.error;
			toast.error(result.error);
			return;
		}
		error = null;
		toast.success('Entity JSON applied');
		syncFromWorld();
	}
</script>

<div class="json-panel">
	<p class="hint">
		JSON-LD entity fragment. Edit <code>components</code> and click Apply. Formulas use
		<code>=…</code> strings.
	</p>

	<textarea
		bind:value={draft}
		class="json-editor"
		spellcheck="false"
		aria-label="Entity JSON editor"
		oninput={() => (error = null)}
	></textarea>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<div class="actions">
		<Button variant="outline" size="sm" onclick={revert} disabled={!dirty}>Revert</Button>
		<Button size="sm" onclick={apply} disabled={!dirty}>Apply</Button>
	</div>
</div>

<style>
	.json-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		gap: var(--spacing-sm);
	}

	.hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.hint code {
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.json-editor {
		flex: 1;
		min-height: 160px;
		width: 100%;
		resize: vertical;
		padding: 10px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		background: color-mix(in srgb, var(--viewport) 70%, transparent);
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
		tab-size: 2;
	}

	.json-editor:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.error {
		margin: 0;
		font-size: 11px;
		color: var(--destructive);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}
</style>
