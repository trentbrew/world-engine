<script lang="ts">
	import type { Entity, EventTrigger } from '$lib/engine/ontology/schema';
	import { actionSummary } from '$lib/engine/events/actionSummary';

	interface Props {
		entity: Entity;
	}

	let { entity }: Props = $props();

	const TRIGGERS: { id: EventTrigger; label: string }[] = [
		{ id: 'create', label: 'Create' },
		{ id: 'step', label: 'Step' },
		{ id: 'destroy', label: 'Destroy' }
	];

	const eventEntries = $derived(
		TRIGGERS.map((trigger) => ({
			...trigger,
			actions: entity.events?.[trigger.id] ?? []
		})).filter((entry) => entry.actions.length > 0)
	);
</script>

<section class="entity-events" aria-label="Entity events">
	{#if eventEntries.length > 0}
		<p class="events-note">
			Read-only event handlers inherited from the entity type or authored inline.
		</p>
		<div class="event-groups">
			{#each eventEntries as entry (entry.id)}
				<article class="event-card">
					<header>
						<span class="trigger-label">{entry.label}</span>
						<span class="action-count">{entry.actions.length} action{entry.actions.length === 1 ? '' : 's'}</span>
					</header>
					<ol>
						{#each entry.actions as action, index (`${entry.id}-${index}`)}
							<li>{actionSummary(action)}</li>
						{/each}
					</ol>
				</article>
			{/each}
		</div>
	{:else}
		<div class="empty-events">
			<h3>No events yet</h3>
			<p>Create, Step, and Destroy handlers will appear here when this object has authored events.</p>
		</div>
	{/if}
</section>

<style>
	.entity-events {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-sm);
	}

	.events-note,
	.empty-events p {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 11px;
	}

	.event-groups {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: var(--spacing-sm);
	}

	.event-card {
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--viewport) 35%, transparent);
		overflow: hidden;
	}

	.event-card header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
	}

	.trigger-label {
		font-size: 11px;
		font-weight: 600;
	}

	.action-count {
		color: var(--muted-foreground);
		font-size: 10px;
	}

	ol {
		margin: 0;
		padding: 8px 10px 10px 26px;
	}

	li {
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.45;
	}

	.empty-events {
		display: grid;
		gap: 4px;
		padding: var(--spacing-md);
		border: 1px dashed color-mix(in srgb, var(--border) 60%, transparent);
		border-radius: var(--radius-sm);
	}

	.empty-events h3 {
		margin: 0;
		font-size: 13px;
	}
</style>
