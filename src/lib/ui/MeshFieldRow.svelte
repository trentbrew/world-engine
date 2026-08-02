<script lang="ts">
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import * as Select from '$lib/components/ui/select/index.js';
	import { SHAPE_CATALOG } from '$lib/assets/shapes';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';

	interface Props {
		id: string;
		component: string;
		field?: string;
		value: unknown;
		disabled?: boolean;
		dirty?: boolean;
		resettable?: boolean;
		onReset?: () => void;
		onChange: (value: string) => void;
		onBrowse: () => void;
	}

	let {
		id,
		component,
		field = 'mesh',
		value,
		disabled = false,
		dirty = false,
		resettable = false,
		onReset,
		onChange,
		onBrowse
	}: Props = $props();

	const meshValue = $derived(String(value ?? ''));

	function meshLabel(url: string): string {
		if (url.startsWith('primitive:')) {
			return SHAPE_CATALOG.find((shape) => shape.mesh === url)?.label ?? url.replace('primitive:', '');
		}
		const tail = url.split('/').pop() ?? url;
		return tail.length > 28 ? `${tail.slice(0, 25)}…` : tail;
	}

	const options = $derived.by(() => {
		const rows = SHAPE_CATALOG.map((shape) => ({ value: shape.mesh, label: shape.label }));
		if (meshValue && !rows.some((row) => row.value === meshValue)) {
			rows.push({ value: meshValue, label: meshLabel(meshValue) });
		}
		return rows;
	});

	const selectValue = $derived(meshValue || options[0]?.value || '');
</script>

<div class="field-row" class:field-row--dirty={dirty} class:field-row--disabled={disabled}>
	<InspectorFieldLabel
		label={field}
		{id}
		{component}
		{field}
		{dirty}
		{resettable}
		{onReset}
	/>
	<div class="field-row-control">
		<FieldWell {disabled} {dirty}>
			<Select.Root
				type="single"
				value={selectValue}
				onValueChange={(next) => next && onChange(next)}
			>
				<Select.Trigger
					{id}
					class="field-select-trigger mesh-select-trigger"
					size="sm"
					{disabled}
				>
					<span class="select-value">
						{options.find((option) => option.value === selectValue)?.label ?? selectValue}
					</span>
					<span class="select-chevrons" aria-hidden="true">▴▾</span>
				</Select.Trigger>
				<Select.Content>
					{#each options as option (option.value)}
						<Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<button
				type="button"
				class="mesh-browse"
				aria-label="Browse assets"
				{disabled}
				onclick={onBrowse}
			>
				<FolderOpenIcon class="size-3.5" aria-hidden="true" />
			</button>
		</FieldWell>
	</div>
</div>

<style>
	:global(.mesh-select-trigger) {
		flex: 1;
		min-width: 0;
		width: auto !important;
		border: 0 !important;
		border-radius: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	:global(.mesh-select-trigger:focus-visible) {
		box-shadow: none !important;
	}
</style>
