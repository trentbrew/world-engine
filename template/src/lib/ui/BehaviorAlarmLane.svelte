<script lang="ts">
	import { actionSummary } from '$lib/engine/events/actionSummary';
	import type { EventAction, EventTrigger } from '$lib/engine/ontology/schema';

	interface Props {
		slot: number;
		actions: EventAction[];
	}

	let { slot, actions }: Props = $props();

	const trigger = `alarm${slot}` as EventTrigger;
	let open = $state(actions.length > 0);
</script>

<article class="alarm-lane">
	<button type="button" class="lane-header" aria-expanded={open} onclick={() => (open = !open)}>
		<span class="slot">alarm{slot}</span>
		<span class="count">{actions.length} action{actions.length === 1 ? '' : 's'}</span>
	</button>
	{#if open && actions.length > 0}
		<ol>
			{#each actions as action, index (`${trigger}-${index}`)}
				<li>{actionSummary(action)}</li>
			{/each}
		</ol>
	{/if}
</article>

<style>
	.alarm-lane {
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.lane-header {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border: 0;
		background: color-mix(in srgb, var(--viewport) 30%, transparent);
		cursor: pointer;
		font-size: 11px;
		color: var(--foreground);
	}

	.slot {
		font-family: var(--font-mono);
		font-weight: 600;
	}

	.count {
		color: var(--muted-foreground);
		font-size: 10px;
	}

	ol {
		margin: 0;
		padding: 6px 10px 8px 26px;
	}

	li {
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.45;
	}
</style>
