<script lang="ts">
	import { ui } from '$lib/ui/ui.svelte';
</script>

{#if ui.placementDraft && ui.shellMode === 'edit'}
	<div class="placement-banner glass-panel" role="status" aria-live="polite">
		Click or drag to place · Esc to cancel
	</div>
{/if}

<style>
	.placement-banner {
		position: absolute;
		top: calc(var(--chrome-top-outer) + var(--spacing-sm));
		left: 50%;
		transform: translateX(-50%);
		z-index: 4;
		padding: 6px 14px;
		border-radius: var(--rounded-sm);
		font-size: 11px;
		color: var(--accent-entity);
		white-space: nowrap;
		pointer-events: none;
		border-color: color-mix(in srgb, var(--accent-entity) 40%, var(--border));
	}
</style>
