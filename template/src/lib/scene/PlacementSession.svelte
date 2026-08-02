<script lang="ts">
	import { onMount } from 'svelte';
	import { bindPlacementSession } from '$lib/scene/placementSession';
	import { ui } from '$lib/ui/ui.svelte';

	onMount(() => bindPlacementSession());
</script>

<div class="sr-only" role="status" aria-live="polite">
	{#if ui.placementDraft}
		Placing {ui.placementDraft.label}. Click the scene to place. Press Escape to cancel.
	{/if}
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
