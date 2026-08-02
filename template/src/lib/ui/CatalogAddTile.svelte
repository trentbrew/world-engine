<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';

	interface Props {
		label: string;
		layout?: 'grid' | 'list';
		onclick: () => void;
	}

	let { label, layout = 'grid', onclick }: Props = $props();
</script>

<button
	type="button"
	class="catalog-add-tile"
	class:list={layout === 'list'}
	aria-label={label}
	{onclick}
>
	<PlusIcon class="size-4" aria-hidden="true" />
	{#if layout === 'list'}
		<span class="add-label">{label}</span>
	{/if}
</button>

<style>
	.catalog-add-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 72px;
		padding: 6px;
		border-radius: var(--field-control-radius);
		border: 1px dashed color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--background) 20%, transparent);
		color: var(--muted-foreground);
		cursor: pointer;
		font-family: inherit;
		transition:
			color 120ms ease,
			border-color 120ms ease,
			background 120ms ease;
	}

	.catalog-add-tile:hover {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--accent-entity) 45%, var(--border));
		background: color-mix(in srgb, var(--accent-entity) 10%, transparent);
	}

	.catalog-add-tile:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.catalog-add-tile.list {
		flex-direction: row;
		justify-content: flex-start;
		gap: 8px;
		width: 100%;
		min-height: 36px;
		padding: 8px 10px;
		border-style: dashed;
	}

	.add-label {
		font-size: 11px;
		font-weight: 500;
	}
</style>
