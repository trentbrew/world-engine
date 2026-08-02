<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { shellNavHistory } from '$lib/ui/shellNavHistory.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const canGoBack = $derived(shellNavHistory.canGoBack);
	const canGoForward = $derived(shellNavHistory.canGoForward);
	const enabled = $derived(ui.shellMode === 'edit');
</script>

<div class="nav-history" role="group" aria-label="Navigation history">
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon-sm"
					class="nav-history-btn"
					disabled={!enabled || !canGoBack}
					aria-label="Go back"
					onclick={() => ui.goNavBack()}
				>
					<ArrowLeftIcon class="size-3.5" aria-hidden="true" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom" sideOffset={6} class="text-xs">Back</Tooltip.Content>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon-sm"
					class="nav-history-btn"
					disabled={!enabled || !canGoForward}
					aria-label="Go forward"
					onclick={() => ui.goNavForward()}
				>
					<ArrowRightIcon class="size-3.5" aria-hidden="true" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom" sideOffset={6} class="text-xs">Forward</Tooltip.Content>
	</Tooltip.Root>
</div>

<style>
	.nav-history {
		display: inline-flex;
		align-items: center;
		gap: 0;
		flex-shrink: 0;
	}

	:global(.nav-history-btn) {
		width: 26px;
		height: 26px;
		color: var(--muted-foreground);
	}

	:global(.nav-history-btn:hover:not(:disabled)) {
		color: var(--foreground);
	}

	:global(.nav-history-btn:disabled) {
		opacity: 0.35;
	}
</style>
