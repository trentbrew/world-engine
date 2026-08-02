<script lang="ts">
	import { camera } from '$lib/engine/render/camera.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<div class="popover-panel" role="dialog" aria-label="Camera">
	<div class="popover-title">Camera</div>
	<div class="segmented" role="group" aria-label="Camera mode">
		<button
			type="button"
			class="seg-btn"
			class:active={camera.mode === 'orbit'}
			aria-pressed={camera.mode === 'orbit'}
			onclick={() => camera.setMode('orbit')}
		>
			Orbit
		</button>
		<button
			type="button"
			class="seg-btn"
			class:active={camera.mode === 'follow'}
			aria-pressed={camera.mode === 'follow'}
			onclick={() => camera.setMode('follow')}
		>
			Follow
		</button>
	</div>
	<div class="actions">
		<Button variant="outline" size="sm" class="action-btn" onclick={() => camera.resetView()}>
			Reset view
		</Button>
		<Button variant="outline" size="sm" class="action-btn" onclick={() => camera.focusSelection()}>
			Focus selection
		</Button>
	</div>
</div>

<style>
	.popover-panel {
		width: var(--popover-width);
		padding: 12px;
		background: var(--secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 32px rgb(0 0 0 / 0.45);
	}

	.popover-title {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 10px;
	}

	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		width: 100%;
	}

	.seg-btn {
		flex: 1;
		padding: 5px 8px;
		font-family: inherit;
		font-size: 11px;
		border: none;
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.seg-btn.active {
		background: var(--card);
		color: var(--foreground);
	}

	.seg-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.actions {
		display: flex;
		gap: 6px;
		margin-top: 10px;
	}

	:global(.action-btn) {
		flex: 1;
		font-size: 11px;
	}
</style>
