<script lang="ts">
	import { roomTransition } from '$lib/engine/room/roomTransition.svelte';

	const show = $derived(
		roomTransition.active || roomTransition.opacity > 0.01 || roomTransition.holding
	);
	const showCue = $derived(roomTransition.holding && !!roomTransition.cueText);
	const reduced = $derived(roomTransition.cueText === 'Loading');
</script>

{#if show}
	<div
		class="room-transition"
		style:opacity={Math.max(roomTransition.opacity, roomTransition.holding ? 1 : 0)}
		style:background={roomTransition.color}
	>
		{#if showCue}
			<div class="room-transition-cue" role="status" aria-live="polite">
				{#if !reduced}
					<div class="room-transition-dots" aria-hidden="true">
						<span class="room-transition-dot"></span>
						<span class="room-transition-dot"></span>
						<span class="room-transition-dot"></span>
					</div>
				{/if}
				<span class="room-transition-text" class:visually-hidden={!reduced}>
					{roomTransition.cueText}
				</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.room-transition {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		display: grid;
		place-items: center;
	}

	.room-transition-cue {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		color: color-mix(in srgb, var(--foreground, #e8e8ec) 55%, transparent);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	.room-transition-dots {
		display: flex;
		gap: 6px;
	}

	.room-transition-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		animation: room-transition-pulse 1s ease-in-out infinite;
	}

	.room-transition-dot:nth-child(2) {
		animation-delay: 0.15s;
	}

	.room-transition-dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes room-transition-pulse {
		0%,
		100% {
			opacity: 0.25;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.visually-hidden {
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

	@media (prefers-reduced-motion: reduce) {
		.room-transition-dot {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
