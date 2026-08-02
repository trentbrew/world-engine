<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	const DOT_COUNT = 49;

	interface Props extends HTMLAttributes<HTMLDivElement> {
		frames: number[][];
		duration?: number;
		isPlaying?: boolean;
		repeatCount?: number;
		onComplete?: () => void;
	}

	let {
		frames,
		duration = 100,
		isPlaying = true,
		repeatCount = -1,
		onComplete,
		class: className = '',
		...rest
	}: Props = $props();

	let frameIndex = $state(0);

	const active = $derived(new Set(frames[frameIndex] ?? []));

	$effect(() => {
		frames;
		frameIndex = 0;
	});

	$effect(() => {
		if (!isPlaying || frames.length === 0) return;

		if (typeof window !== 'undefined') {
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (reduced) {
				frameIndex = Math.floor(frames.length / 2);
				return;
			}
		}

		let current = frameIndex;
		let repeats = 0;

		const id = setInterval(() => {
			if (current + 1 >= frames.length) {
				if (repeatCount !== -1 && repeats + 1 >= repeatCount) {
					clearInterval(id);
					onComplete?.();
					return;
				}
				repeats++;
			}
			current = (current + 1) % frames.length;
			frameIndex = current;
		}, duration);

		return () => clearInterval(id);
	});
</script>

<div class="dot-loader {className}" aria-hidden="true" {...rest}>
	{#each { length: DOT_COUNT } as _, index (index)}
		<span class="dot" class:active={active.has(index)}></span>
	{/each}
</div>

<style>
	.dot-loader {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		width: fit-content;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--text) 15%, transparent);
		transition: background 40ms linear;
	}

	.dot.active {
		background: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			transition: none;
		}
	}
</style>
