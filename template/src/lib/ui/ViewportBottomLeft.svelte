<script lang="ts">
	import DebugConsole from '$lib/ui/debug/DebugConsole.svelte';
	import MovementJankHud from '$lib/ui/MovementJankHud.svelte';
	import PlayCameraControls from '$lib/ui/PlayCameraControls.svelte';
	import ViewportConfigPopover from '$lib/ui/ViewportConfigPopover.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

	interface Props {
		/** When true, sit inline in the doc bar (play mode top-left). */
		inline?: boolean;
	}

	let { inline = false }: Props = $props();

	const showLiveControls = $derived(!ui.playPaused);
	const showStats = $derived(ui.chrome.statsHud);
	const showJank = $derived(viewportDebug.jankHud);
</script>

<div
	class="viewport-play-hud"
	class:viewport-play-hud--inline={inline}
	class:viewport-play-hud--float={!inline}
	data-testid="viewport-play-hud"
>
	{#if showLiveControls}
		<ViewportConfigPopover />
		<PlayCameraControls />
	{/if}
	{#if showStats}
		<DebugConsole embedded placement="bottom-left" />
	{/if}
	{#if showJank}
		<MovementJankHud embedded />
	{/if}
</div>

<style>
	.viewport-play-hud {
		display: flex;
		gap: 8px;
		pointer-events: auto;
		z-index: 10;
	}

	.viewport-play-hud--float {
		position: absolute;
		top: var(--chrome-top-outer, calc(var(--float-inset) + var(--doc-bar-chrome-height, 48px)));
		left: var(--float-inset);
		align-items: flex-start;
	}

	.viewport-play-hud--inline {
		position: relative;
		align-items: center;
		min-width: 0;
		flex-shrink: 1;
	}

	@media (max-width: 767px) {
		.viewport-play-hud {
			display: none;
		}
	}
</style>
