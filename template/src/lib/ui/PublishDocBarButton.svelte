<script lang="ts">
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { ui } from '$lib/ui/ui.svelte';

	const active = $derived(ui.shellMode === 'publish');

	function onClick() {
		if (active) ui.exitPublish();
		else ui.enterPublish();
	}
</script>

<button
	type="button"
	class="publish-btn"
	class:active
	aria-pressed={active}
	aria-label={active ? 'Exit publish' : 'Publish'}
	title={active ? 'Back to edit' : 'Publish'}
	onclick={onClick}
>
	<UploadIcon class="publish-btn-icon" aria-hidden="true" />
	<span>Publish</span>
</button>

<style>
	.publish-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		/* Match .shell-mode-tabs outer height (2px pad + 26px tabs + 2px pad + borders). */
		height: var(--doc-bar-height);
		padding: 0 12px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		background: var(--chrome-pill-bg);
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 120ms ease,
			color 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}

	.publish-btn:hover:not(.active) {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--ring) 45%, var(--border));
	}

	.publish-btn.active {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--primary-foreground);
		box-shadow: 0 1px 2px color-mix(in srgb, black 24%, transparent);
	}

	.publish-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	:global(.publish-btn-icon) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.9;
	}
</style>
