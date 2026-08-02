<script lang="ts">
	import { roomPortalPrompt } from '$lib/engine/room/roomPortalPrompt.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const prompt = $derived(roomPortalPrompt.prompt);
	const show = $derived(ui.shellMode === 'play' && !!prompt?.visible);
</script>

{#if show && prompt}
	<div class="portal-prompt-layer" aria-live="polite">
		<div
			class="portal-prompt"
			style:left="{prompt.x}px"
			style:top="{prompt.y}px"
			role="status"
		>
			<kbd class="portal-prompt-key">{prompt.hint.replace(/^Press\s+/i, '')}</kbd>
			<span class="portal-prompt-label">{prompt.label}</span>
		</div>
	</div>
{/if}

<style>
	.portal-prompt-layer {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		overflow: hidden;
	}

	.portal-prompt {
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
	}

	.portal-prompt-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--viewport) 55%, transparent);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		line-height: 1;
		color: var(--foreground);
	}

	.portal-prompt-label {
		font-size: 12px;
		font-weight: 600;
	}
</style>
