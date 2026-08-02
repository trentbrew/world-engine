<script lang="ts">
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Entity, RefTarget } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorField from '$lib/ui/InspectorField.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	interface Props {
		entityId: string;
		component: string;
		field: string;
		value: unknown;
		target: RefTarget;
	}

	let { entityId, component, field, value, target }: Props = $props();

	const inputId = $derived(`${entityId}-${component}-${field}`.replace(/[^a-zA-Z0-9_-]/g, '-'));
	const current = $derived(String(value ?? ''));

	function entityLabel(entity: Entity): string {
		for (const bag of Object.values(entity.components)) {
			for (const key of ['displayName', 'name', 'title', 'label']) {
				const v = (bag as Record<string, unknown>)[key];
				if (typeof v === 'string' && v.trim()) return v;
			}
		}
		return entity.id.split('/').pop() ?? entity.id;
	}

	const candidates = $derived.by(() => {
		void world.entities.length;
		if (target.kind === 'record') return world.recordsFor(target.collection);
		if (target.kind === 'entity') return world.entities.filter((e) => !e.type || !isRecord(e));
		return [];
	});

	function isRecord(entity: Entity): boolean {
		return entity.id.startsWith('record:');
	}

	const options = $derived([
		{ value: '', label: '— none —' },
		...candidates.map((e) => ({ value: e.id, label: entityLabel(e) }))
	]);

	// Dangling: a set ref that resolves to nothing in the current graph.
	const dangling = $derived(
		target.kind !== 'asset' &&
			current !== '' &&
			!candidates.some((e) => e.id === current)
	);

	function commit(next: unknown) {
		world.setField(entityId, component, field, next);
	}

	function browseAssets() {
		ui.openAssetPick({ entityId, component, field });
	}
</script>

{#if target.kind === 'asset'}
	<div class="field-row">
		<InspectorFieldLabel label={field} id={inputId} {component} {field} />
		<div class="field-row-control">
			<FieldWell>
				<input
					id={inputId}
					class="field-value field-value--mesh"
					value={current}
					aria-label={field}
					onchange={(e) => commit(e.currentTarget.value)}
				/>
				<button type="button" class="mesh-browse" aria-label="Browse assets" onclick={browseAssets}>
					<FolderOpenIcon class="size-3.5" aria-hidden="true" />
				</button>
			</FieldWell>
		</div>
	</div>
{:else}
	<InspectorField
		id={inputId}
		label={field}
		kind="select"
		{component}
		{field}
		value={current}
		{options}
		onChange={(next) => commit(next === '' ? '' : next)}
	/>
{/if}

{#if dangling}
	<div class="ref-dangling" role="note">
		<AlertTriangleIcon class="size-3" aria-hidden="true" />
		<span>Reference <code>{current}</code> not found</span>
	</div>
{/if}

<style>
	.ref-dangling {
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 2px 0 6px;
		padding-left: 2px;
		font-size: 10px;
		color: var(--destructive);
	}

	.ref-dangling code {
		font-family: var(--font-mono);
		font-size: 10px;
	}
</style>
