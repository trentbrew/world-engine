<script lang="ts">
	import { camera } from '$lib/engine/render/camera.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';

	function setProjection(next: 'perspective' | 'orthographic') {
		camera.projection = next;
	}
</script>

<div
	class="view-controls-cluster"
	class:ortho-active={camera.projection === 'orthographic'}
	role="tablist"
	aria-label="Projection"
>
	<div class="gizmo-well" aria-hidden="true"></div>

	{#if !worldProfile.is2d}
		<div class="proj-buttons">
			<button
				type="button"
				role="tab"
				class="proj-btn"
				class:active={camera.projection === 'orthographic'}
				aria-selected={camera.projection === 'orthographic'}
				onclick={() => setProjection('orthographic')}
			>
				Orthographic
			</button>
			<button
				type="button"
				role="tab"
				class="proj-btn"
				class:active={camera.projection === 'perspective'}
				aria-selected={camera.projection === 'perspective'}
				onclick={() => setProjection('perspective')}
			>
				Perspective
			</button>
		</div>
	{/if}
</div>

<style>
	.view-controls-cluster {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		pointer-events: auto;
	}

	.gizmo-well {
		width: var(--gizmo-well-size);
		height: var(--gizmo-well-size);
		flex-shrink: 0;
		pointer-events: none;
	}

	.proj-buttons {
		display: flex;
		align-items: center;
		gap: 6px;
		opacity: 0;
		pointer-events: none;
		transition: opacity 160ms ease;
	}

	.view-controls-cluster:hover .proj-buttons,
	.view-controls-cluster:focus-within .proj-buttons,
	.view-controls-cluster.ortho-active .proj-buttons {
		opacity: 1;
		pointer-events: auto;
	}

	.proj-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: var(--view-bar-height);
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: var(--rounded-pill);
		background: var(--chrome-pill-bg);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.28);
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		color: var(--muted-foreground);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}

	.proj-btn:hover:not(.active) {
		color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
		border-color: color-mix(in srgb, var(--ring) 55%, var(--border));
	}

	.proj-btn.active {
		background: var(--card);
		color: var(--foreground);
		font-weight: 600;
		border-color: var(--ring);
		box-shadow:
			0 4px 16px rgb(0 0 0 / 0.35),
			inset 0 1px 0 rgb(255 255 255 / 0.06);
	}

	.proj-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.proj-buttons {
			opacity: 1;
			pointer-events: auto;
			transition: none;
		}
	}
</style>
