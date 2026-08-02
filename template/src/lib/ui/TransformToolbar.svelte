<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import MoveIcon from '@lucide/svelte/icons/move';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import { formatBinding, primaryBinding } from '$lib/engine/input/shortcutBinding';
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type GizmoMode = 'translate' | 'rotate' | 'scale';

	interface Props {
		/** Panel = full-width inspector strip; float = compact viewport bar. */
		variant?: 'panel' | 'float';
	}

	let { variant = 'panel' }: Props = $props();

	const modes = $derived([
		{
			id: 'translate' as GizmoMode,
			label: 'Move',
			shortcut: formatBinding(primaryBinding('gizmoTranslate', inputPrefs.shortcuts)),
			Icon: MoveIcon
		},
		{
			id: 'rotate' as GizmoMode,
			label: 'Rotate',
			shortcut: formatBinding(primaryBinding('gizmoRotate', inputPrefs.shortcuts)),
			Icon: RotateCwIcon
		},
		{
			id: 'scale' as GizmoMode,
			label: 'Scale',
			shortcut: formatBinding(primaryBinding('gizmoScale', inputPrefs.shortcuts)),
			Icon: Maximize2Icon
		}
	]);

	const visible = $derived(
		ui.shellMode === 'edit' &&
			!ui.placementDraft &&
			!worldProfile.is2d &&
			world.selection !== null &&
			world.selectedEntity !== null &&
			world.canTransformEntity(world.selection)
	);
</script>

{#if visible}
	<div
		class="transform-toolbar"
		class:transform-toolbar-float={variant === 'float'}
		role="toolbar"
		aria-label="Transform tools"
	>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			class="inspector-toggle-group"
			value={ui.transformGizmoMode}
			onValueChange={(value) => {
				if (value === 'translate' || value === 'rotate' || value === 'scale') {
					ui.setTransformGizmoMode(value);
				}
			}}
		>
			{#each modes as mode (mode.id)}
				<ToggleGroup.Item
					value={mode.id}
					title={`${mode.label} (${mode.shortcut})`}
					aria-label={`${mode.label}, shortcut ${mode.shortcut}`}
				>
					<mode.Icon class="tool-icon" aria-hidden="true" />
					<span class="tool-label">{mode.label}</span>
					<Kbd class="tool-kbd">{mode.shortcut}</Kbd>
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</div>
{/if}

<style>
	.transform-toolbar {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		flex-shrink: 0;
	}

	.transform-toolbar-float {
		width: auto;
		padding: 0;
		border-bottom: none;
	}

	:global(.tool-icon) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.tool-label {
		font-size: 11px;
		font-weight: 500;
	}

	:global(.tool-kbd) {
		height: 18px;
		min-width: 18px;
		padding: 0 4px;
		font-size: 10px;
		font-family: var(--font-mono);
		opacity: 0.85;
	}

	:global(.transform-toolbar [data-slot='toggle-group-item']) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}

	:global(.transform-toolbar-float [data-slot='toggle-group']) {
		border: none;
		background: transparent;
		gap: 2px;
	}

	:global(.transform-toolbar-float [data-slot='toggle-group-item']) {
		height: 28px;
		padding: 0 10px;
		border-radius: var(--rounded-pill);
	}
</style>
