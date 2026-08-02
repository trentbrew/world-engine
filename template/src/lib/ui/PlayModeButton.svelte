<script lang="ts">
	import { ui } from '$lib/ui/ui.svelte';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SquareIcon from '@lucide/svelte/icons/square';

	const playing = $derived(ui.shellMode === 'play');
</script>

<button
	type="button"
	class="play-btn"
	class:playing
	aria-pressed={playing}
	aria-label={playing ? 'Stop play mode' : 'Enter play mode'}
	title={playing ? 'Stop (Esc)' : 'Play (P)'}
	onclick={() => ui.togglePlay()}
>
	{#if playing}
		<SquareIcon class="play-icon" aria-hidden="true" />
	{:else}
		<PlayIcon class="play-icon" aria-hidden="true" />
	{/if}
	<span class="play-label">{playing ? 'Stop' : 'Play'}</span>
</button>

<style>
	.play-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid transparent;
		border-radius: var(--rounded-pill);
		background: var(--accent-play);
		color: var(--accent-play-foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 120ms ease,
			color 120ms ease,
			border-color 120ms ease;
	}

	.play-btn:hover {
		background: color-mix(in srgb, var(--accent-play) 88%, white);
	}

	.play-btn.playing {
		background: var(--surface-raised);
		color: var(--text);
		border-color: var(--border);
	}

	.play-btn:focus-visible {
		outline: 2px solid var(--border-focus);
		outline-offset: 1px;
	}

	:global(.play-icon) {
		width: 14px;
		height: 14px;
	}
</style>
