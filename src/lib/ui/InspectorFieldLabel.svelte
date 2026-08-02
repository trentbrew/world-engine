<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { resolveInspectorFieldHelp } from '$lib/ui/inspectorFieldHelp';

	interface Props {
		label: string;
		id: string;
		description?: string;
		component?: string;
		field?: string;
		dirty?: boolean;
		showLabel?: boolean;
		resettable?: boolean;
		onReset?: () => void;
	}

	let {
		label,
		id,
		description,
		component,
		field,
		dirty = false,
		showLabel = true,
		resettable = false,
		onReset
	}: Props = $props();

	const helpText = $derived(
		resolveInspectorFieldHelp({ id, component, field, description })
	);
	const dirtyHintId = $derived(`${id}-dirty-hint`);

	function onLabelClick(event: MouseEvent) {
		if (!resettable || !onReset || event.altKey !== true) return;
		event.preventDefault();
		onReset();
	}
</script>

<div class="field-label-wrap">
	<span class="field-dot" class:field-dot--visible={dirty} aria-hidden="true"></span>
	{#if helpText && showLabel && label}
		<Tooltip.Root>
			<Tooltip.Trigger
				type="button"
				class="inspector-label-info"
				aria-label="About {label}"
				onclick={(event) => event.stopPropagation()}
			>
				<CircleHelpIcon class="size-3" aria-hidden="true" />
			</Tooltip.Trigger>
			<Tooltip.Content side="top" sideOffset={6} class="max-w-56 text-pretty">
				{helpText}
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	{#if showLabel && label}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<label class="field-label" for={id} onclick={onLabelClick} title={resettable ? 'Alt+click to reset' : undefined}>
			{label}
		</label>
		{#if dirty}
			<span id={dirtyHintId} class="sr-only">modified from default</span>
		{/if}
	{/if}
</div>
