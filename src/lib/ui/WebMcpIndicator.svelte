<script lang="ts">
	import { webmcp } from '$lib/engine/agent/webmcp/state.svelte';

	const title = $derived.by(() => {
		switch (webmcp.status) {
			case 'ready':
				return `WebMCP active — ${webmcp.registeredCount} tools registered for browser agents`;
			case 'pending':
				return 'WebMCP — registering tools…';
			default:
				return 'WebMCP unavailable — requires Chrome 149+ with the origin trial or #enable-webmcp-testing';
		}
	});

	const label = $derived(
		webmcp.status === 'ready' ? `WebMCP · ${webmcp.registeredCount}` : 'WebMCP'
	);
</script>

<div
	class="webmcp-indicator"
	class:ready={webmcp.status === 'ready'}
	class:pending={webmcp.status === 'pending'}
	class:unsupported={webmcp.status === 'unsupported'}
	role="status"
	aria-live="polite"
	{title}
>
	<span class="dot" aria-hidden="true"></span>
	<span class="label">{label}</span>
</div>

<style>
	.webmcp-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--card);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		color: var(--muted-foreground);
		letter-spacing: 0.02em;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted-foreground);
		opacity: 0.55;
		flex-shrink: 0;
	}

	.webmcp-indicator.ready {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--success) 35%, var(--border));
	}

	.webmcp-indicator.ready .dot {
		background: var(--success);
		opacity: 1;
	}

	.webmcp-indicator.pending .dot {
		background: var(--primary, #7dd3fc);
		opacity: 1;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.45;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}
</style>
