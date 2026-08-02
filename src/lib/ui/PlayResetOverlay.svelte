<script lang="ts">
	import { playResetFx } from '$lib/ui/playResetFx.svelte';
</script>

{#if playResetFx.active}
	<div
		class="reset-scrim"
		style:opacity={playResetFx.opacity}
		role="presentation"
		aria-hidden="true"
	></div>
{/if}

<style>
	.reset-scrim {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: auto;
		background: rgb(128 128 128);
		transition: opacity 200ms ease-in-out;
	}
</style>
