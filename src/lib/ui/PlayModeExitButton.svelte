<script lang="ts">
	import { ui } from '$lib/ui/ui.svelte';
	import SquareIcon from '@lucide/svelte/icons/square';
</script>

<button
	type="button"
	class="exit-play"
	aria-label="Stop play mode"
	title="Stop (Esc)"
	onclick={() => ui.exitPlay()}
>
	<SquareIcon class="exit-icon" aria-hidden="true" />
	<span>Stop</span>
</button>

<style>
	.exit-play {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 12px;
		border: 1px solid transparent;
		border-radius: var(--rounded-pill);
		background: var(--destructive);
		color: oklch(0.985 0 0);
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 6px 20px color-mix(in srgb, var(--destructive) 35%, transparent);
		transition:
			background 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease;
	}

	.exit-play:hover {
		background: color-mix(in srgb, var(--destructive) 88%, white);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--destructive) 45%, transparent);
	}

	.exit-play:active {
		transform: translateY(1px);
	}

	.exit-play:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	:global(.exit-icon) {
		width: 13px;
		height: 13px;
	}
</style>
