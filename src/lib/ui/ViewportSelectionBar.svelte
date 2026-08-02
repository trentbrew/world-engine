<script lang="ts">
	import { hasEntityClipboard } from '$lib/engine/runtime/entityClipboard.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import EntityEditActions from '$lib/ui/EntityEditActions.svelte';
	import TransformToolbar from '$lib/ui/TransformToolbar.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const showActions = $derived(
		ui.shellMode === 'edit' &&
			ui.railRoute === 'rooms' &&
			(world.selection !== null || hasEntityClipboard())
	);

	const showTransform = $derived(
		!ui.placementDraft &&
			!worldProfile.is2d &&
			world.selection !== null &&
			world.selectedEntity !== null &&
			world.canTransformEntity(world.selection)
	);
</script>

{#if showActions}
	<div class="viewport-selection-bar">
		<div
			class="selection-bar-card chrome-float-card glass-panel-shell chrome-opacity-panel"
			role="group"
			aria-label="Selection tools"
		>
			{#if showTransform}
				<div class="selection-bar-cluster">
					<TransformToolbar variant="float" />
				</div>
			{/if}
			<div class="selection-bar-cluster selection-bar-actions">
				{#if showTransform}
					<div class="selection-bar-divider" aria-hidden="true"></div>
				{/if}
				<EntityEditActions />
			</div>
		</div>
	</div>
{/if}

<style>
	.viewport-selection-bar {
		position: absolute;
		top: calc(var(--chrome-top-outer));
		right: var(--main-inset-right);
		max-width: fit-content;
		z-index: 12;
		pointer-events: none;
	}

	.selection-bar-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		min-height: 40px;
		padding: 4px 8px;
		pointer-events: auto;
	}

	.selection-bar-cluster {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.selection-bar-actions {
		margin-left: auto;
	}

	.selection-bar-divider {
		width: 1px;
		height: 20px;
		background: color-mix(in srgb, var(--border) 70%, transparent);
		flex-shrink: 0;
	}

	@media (max-width: 767px) {
		.viewport-selection-bar {
			display: none;
		}
	}
</style>
