<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { ui, type ShellMode } from '$lib/ui/ui.svelte';

	const mode = $derived(ui.shellMode);

	function selectMode(next: Exclude<ShellMode, 'publish'>) {
		if (next === 'play') {
			if (mode !== 'play') ui.enterPlay();
			return;
		}
		if (mode !== 'edit') ui.exitToEdit();
	}
</script>

<div class="shell-mode-tabs" role="tablist" aria-label="Editor mode">
	<button
		type="button"
		role="tab"
		class="shell-mode-tab"
		aria-selected={mode === 'edit'}
		class:active={mode === 'edit'}
		onclick={() => selectMode('edit')}
	>
		<PencilIcon class="tab-icon" aria-hidden="true" />
		<span>Edit</span>
	</button>
	<button
		type="button"
		role="tab"
		class="shell-mode-tab"
		aria-selected={mode === 'play'}
		class:active={mode === 'play'}
		onclick={() => selectMode('play')}
	>
		<PlayIcon class="tab-icon" aria-hidden="true" />
		<span>Play</span>
	</button>
</div>

<style>
	.shell-mode-tabs {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		width: fit-content;
		height: var(--doc-bar-height);
		gap: 2px;
		padding: 2px;
		border-radius: var(--rounded-pill);
		background: var(--chrome-pill-bg);
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.shell-mode-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 26px;
		min-width: 52px;
		padding: 0 12px;
		border: none;
		border-radius: var(--rounded-pill);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease,
			box-shadow 120ms ease;
	}

	.shell-mode-tab:hover:not(.active) {
		color: var(--foreground);
	}

	.shell-mode-tab.active {
		background: var(--primary);
		color: var(--primary-foreground);
		box-shadow: 0 1px 2px color-mix(in srgb, black 24%, transparent);
	}

	.shell-mode-tab:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	:global(.tab-icon) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.85;
	}
</style>
