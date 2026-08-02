<script lang="ts">
	interface Props {
		title: string;
		hint?: string;
	}

	let { title, hint }: Props = $props();
</script>

<div class="empty-state">
	<p class="empty-title">{title}</p>
	{#if hint}
		<p class="empty-hint">{hint}</p>
	{/if}
</div>

<style>
	.empty-state {
		padding: var(--spacing-md) 0;
		font-size: 12px;
		color: var(--muted-foreground);
		line-height: 1.5;
	}

	.empty-title {
		color: var(--foreground);
		font-weight: 500;
		margin: 0 0 4px;
	}

	.empty-hint {
		margin: 0;
	}

	.empty-hint :global(code) {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-mono);
	}
</style>
