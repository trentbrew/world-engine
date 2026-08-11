<script lang="ts">
	import DebugConsole from '$lib/ui/debug/DebugConsole.svelte';
	import MovementJankHud from '$lib/ui/MovementJankHud.svelte';
	import PlayCameraControls from '$lib/ui/PlayCameraControls.svelte';
	import ViewportConfigPopover from '$lib/ui/ViewportConfigPopover.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';
	import { playHudMenu } from '$lib/ui/playHudMenu.svelte';

	interface Props {
		/** When true, sit inline in the doc bar (play mode top-left). */
		inline?: boolean;
	}

	let { inline = false }: Props = $props();

	const showLiveControls = $derived(!ui.playPaused);
	const showStats = $derived(ui.chrome.statsHud);
	const showJank = $derived(viewportDebug.jankHud);

	$effect(() => {
		if (ui.shellMode !== 'play' || ui.playPaused) playHudMenu.close();
	});

	$effect(() => {
		if (!showLiveControls && playHudMenu.isOpen('camera')) playHudMenu.close();
		if (!showStats && playHudMenu.isOpen('stats')) playHudMenu.close();
		if (!showJank && playHudMenu.isOpen('jank')) playHudMenu.close();
	});
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
		overflow: visible;
	}

	/* Top-of-screen HUD: dropdown panels overlay the viewport, not the nav row. */
	.viewport-play-hud--inline :global(.camera-controls),
	.viewport-play-hud--inline :global(.debug-console),
	.viewport-play-hud--inline :global(.jank-hud) {
		position: relative;
		top: auto;
		right: auto;
		bottom: auto;
		left: auto;
		align-items: center;
	}

	.viewport-play-hud--inline :global(.camera-panel),
	.viewport-play-hud--inline :global(.debug-panel),
	.viewport-play-hud--inline :global(.jank-panel) {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		z-index: 50;
	}

	@media (max-width: 767px) {
		.viewport-play-hud {
			display: none;
		}
	}
</style>
