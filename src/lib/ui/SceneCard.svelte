<script lang="ts">
	import SceneSelector from '$lib/ui/SceneSelector.svelte';

	let openNewScene = $state(false);
</script>

<div class="scene-card chrome-float-card glass-panel-shell chrome-opacity-panel">
	<SceneSelector embedded {openNewScene} onNewBlank={() => (openNewScene = true)} />
	<button
		type="button"
		class="scene-card-new"
		aria-label="New blank scene"
		onclick={() => (openNewScene = true)}
	>
		<span aria-hidden="true">+</span>
	</button>
</div>

<style>
	.scene-card {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		flex-shrink: 0;
		margin-bottom: var(--chrome-float-gap, 6px);
	}

	.scene-card :global(.scene-selector--embedded) {
		width: 100%;
		padding-left: 0;
		flex: 1 1 auto;
		min-width: 0;
	}

	.scene-card :global(.scene-trigger) {
		width: 100%;
		max-width: none;
		background: transparent;
		border-color: transparent;
		border-radius: var(--radius-md);
	}

	.scene-card :global(.scene-trigger-title) {
		font-weight: 600;
	}

	.scene-card-new {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
	}

	.scene-card-new:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.scene-card-new:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
</style>
