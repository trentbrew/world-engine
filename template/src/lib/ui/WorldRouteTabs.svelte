<script lang="ts">
	import { ui } from '$lib/ui/ui.svelte';
	import { railOrder } from '$lib/ui/railOrder.svelte';
	import { resolveActiveWorldRoute } from '$lib/ui/worldNav';

	const activeRoute = $derived(resolveActiveWorldRoute());
	const items = $derived(railOrder.items);
</script>

<nav class="world-route-tabs" aria-label="World navigation">
	{#each items as item (item.id)}
		<button
			type="button"
			class="route-btn"
			class:active={activeRoute === item.id}
			aria-current={activeRoute === item.id ? 'true' : undefined}
			aria-label={item.label}
			onclick={() => ui.setRoute(item.id)}
		>
			<item.Icon class="route-icon" aria-hidden="true" />
			{#if activeRoute === item.id}
				<span class="route-label">{item.label}</span>
			{/if}
		</button>
	{/each}
</nav>

<style>
	.world-route-tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		height: 100%;
	}

	.route-btn {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 5px;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--rounded-pill);
		background: none;
		color: var(--muted-foreground);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 120ms ease,
			background 120ms ease,
			width 120ms ease,
			padding 120ms ease;
	}

	:global(.route-icon) {
		width: 16px;
		height: 16px;
		stroke-width: 1.75px;
		flex-shrink: 0;
	}

	.route-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
		line-height: 1;
		white-space: nowrap;
	}

	.route-btn:hover:not(.active) {
		color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.route-btn.active,
	.route-btn[aria-current='true'] {
		width: auto;
		height: 28px;
		padding: 0 10px;
		color: var(--foreground);
		background: var(--chrome-pill-bg);
		border: 1px solid var(--border);
		box-shadow: 0 1px 2px color-mix(in srgb, black 18%, transparent);
	}

	.route-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.route-btn {
			transition: none;
		}
	}
</style>
