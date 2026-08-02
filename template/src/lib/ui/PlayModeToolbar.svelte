<script lang="ts">
	import { onMount } from 'svelte';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { gamepadPausePressed, gamepadResetPressed } from '$lib/engine/player/gamepad.svelte';
	import { consumeFallResetRequest } from '$lib/engine/systems/behaviors/jump';
	import { ui } from '$lib/ui/ui.svelte';

	let { visible = true }: { visible?: boolean } = $props();

	const paused = $derived(ui.playPaused);

	function pollPlayControls() {
		if (ui.shellMode !== 'play') return;
		if (gamepadPausePressed()) ui.togglePlayPause();
		if (gamepadResetPressed()) ui.resetPlay();
		if (consumeFallResetRequest()) ui.resetPlay();
	}

	onMount(() => {
		let raf = 0;
		const loop = () => {
			pollPlayControls();
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if ui.shellMode === 'play' && visible}
	<div class="play-toolbar" role="toolbar" aria-label="Play controls">
		<button
			type="button"
			class="tool-btn"
			class:active={paused}
			aria-pressed={paused}
			title={paused ? 'Resume (P / Start)' : 'Pause (P / Start)'}
			onclick={() => ui.togglePlayPause()}
		>
			{#if paused}
				<PlayIcon class="tool-icon" aria-hidden="true" />
				<span class="tool-label">Resume</span>
			{:else}
				<PauseIcon class="tool-icon" aria-hidden="true" />
				<span class="tool-label">Pause</span>
			{/if}
		</button>
		<button
			type="button"
			class="tool-btn"
			title="Reset (R / Select / −)"
			onclick={() => ui.resetPlay()}
		>
			<RotateCcwIcon class="tool-icon" aria-hidden="true" />
			<span class="tool-label">Reset</span>
		</button>
	</div>
{/if}

<style>
	.play-toolbar {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		background: var(--chrome-pill-bg);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.28);
		pointer-events: auto;
	}

	.tool-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 28px;
		padding: 0 10px;
		border: none;
		border-radius: var(--rounded-pill);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease,
			box-shadow 120ms ease;
	}

	.tool-btn:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 55%, transparent);
	}

	.tool-btn.active {
		background: var(--primary);
		color: var(--primary-foreground);
		box-shadow: 0 1px 2px color-mix(in srgb, black 24%, transparent);
	}

	.tool-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	:global(.tool-icon) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.9;
	}
</style>

