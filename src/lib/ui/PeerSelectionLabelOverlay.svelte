<script lang="ts">
	import { peerSelectionLabels } from '$lib/engine/render/peerSelectionLabels.svelte';
	import { session } from '$lib/engine/net/session.svelte';
</script>

{#if session.connected && peerSelectionLabels.labels.length > 0}
	<div class="peer-badge-layer" aria-hidden="true">
		{#each peerSelectionLabels.labels as badge (badge.key)}
			{#if badge.visible}
				<span class="peer-badge" style:left="{badge.x}px" style:top="{badge.y}px">
					<span class="peer-badge-dot" style:background={badge.color}></span>
					<span class="peer-badge-name">{badge.name}</span>
				</span>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.peer-badge-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		overflow: hidden;
	}

	.peer-badge {
		position: absolute;
		transform: translate(-50%, -120%);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: var(--rounded-pill);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--card) 88%, transparent);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
		backdrop-filter: blur(8px);
		color: var(--foreground);
		white-space: nowrap;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.35;
	}

	.peer-badge-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.peer-badge-name {
		font-size: 12px;
		font-weight: 600;
	}
</style>
