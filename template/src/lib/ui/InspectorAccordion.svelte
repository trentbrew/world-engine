<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	interface Props {
		title: string;
		open?: boolean;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, open = $bindable(true), actions, children }: Props = $props();
</script>

<section class="accordion">
	<div class="accordion-header">
		<button
			type="button"
			class="accordion-trigger"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<span class="chevron-wrap" class:open>
				<ChevronRightIcon class="size-3.5" aria-hidden="true" />
			</span>
			<span class="accordion-title">{title}</span>
		</button>
		{#if actions}
			<div class="accordion-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if open}
		<div class="accordion-body">
			{@render children()}
		</div>
	{/if}
</section>

<style>
	.accordion {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}

	.accordion-header {
		display: flex;
		align-items: stretch;
	}

	.accordion-trigger {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		padding: 8px var(--spacing-md);
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		border: none;
		color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-align: left;
		cursor: pointer;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.accordion-trigger:hover {
		color: var(--foreground);
		background: transparent;
	}

	.accordion-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.chevron-wrap {
		display: inline-flex;
		flex-shrink: 0;
		transition: transform 120ms ease;
	}

	.chevron-wrap.open {
		transform: rotate(90deg);
	}

	.accordion-title {
		flex: 1;
		min-width: 0;
	}

	.accordion-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		padding-right: calc(var(--spacing-md) - 4px);
	}

	.accordion-body {
		padding: 0 var(--spacing-md) var(--spacing-sm);
		padding-left: var(--spacing-md);
	}
</style>
