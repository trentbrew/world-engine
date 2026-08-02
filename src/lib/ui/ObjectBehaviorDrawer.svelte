<script lang="ts">
	import { actionSummary } from '$lib/engine/events/actionSummary';
	import type { EntityEvents, EventAction } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import BehaviorAlarmLane from '$lib/ui/BehaviorAlarmLane.svelte';
	import BehaviorScheduleStrip from '$lib/ui/BehaviorScheduleStrip.svelte';

	const entityId = $derived(ui.objectTarget);
	const entity = $derived(entityId ? world.getEntity(entityId) : undefined);
	const events = $derived(entity?.events);

	const alarmSlots = $derived(
		Array.from({ length: 12 }, (_, slot) => {
			const key = `alarm${slot}` as keyof EntityEvents;
			const raw = events?.[key];
			const actions = Array.isArray(raw) ? (raw as EventAction[]) : [];
			return { slot, actions };
		}).filter((row) => row.actions.length > 0)
	);

	let newClip = $state('Idle_Loop');
	let newDelay = $state(2.5);

	function addClipOnCreate() {
		if (!entityId) return;
		const next: EntityEvents = structuredClone(events ?? {});
		if (!next.alarm0) next.alarm0 = [];
		next.alarm0.push({ set: 'Mesh3DAnimator.clip', to: newClip });
		next.alarm0.push({ alarm: 0, in: newDelay });
		if (!next.create?.length) {
			next.create = [{ alarm: 0, in: newDelay }];
		}
		world.setEvents(entityId, next);
	}
</script>

<div class="behavior-drawer">
	<BehaviorScheduleStrip {events} />

	{#if alarmSlots.length > 0}
		<div class="lanes" aria-label="Alarm lanes">
			{#each alarmSlots as row (row.slot)}
				<BehaviorAlarmLane slot={row.slot} actions={row.actions} />
			{/each}
		</div>
	{/if}

	{#if events?.create?.length}
		<section class="create-lane" aria-label="Create handlers">
			<header>Create</header>
			<ol>
				{#each events.create as action, i (`create-${i}`)}
					<li>{actionSummary(action)}</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if entityId}
		<form
			class="add-step"
			aria-label="Add clip step"
			onsubmit={(e) => {
				e.preventDefault();
				addClipOnCreate();
			}}
		>
			<label>
				<span>Clip</span>
				<input type="text" bind:value={newClip} />
			</label>
			<label>
				<span>After (s)</span>
				<input type="number" min="0" step="0.1" bind:value={newDelay} />
			</label>
			<button type="submit">Add step</button>
		</form>
	{/if}
</div>

<style>
	.behavior-drawer {
		display: flex;
		flex-direction: column;
	}

	.lanes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
	}

	.create-lane {
		padding: 8px 12px;
		border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
	}

	.create-lane header {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 4px;
	}

	.create-lane ol {
		margin: 0;
		padding-left: 18px;
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.add-step {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-end;
		padding: 10px 12px;
		border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
	}

	.add-step label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.add-step input {
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: var(--background);
		font-size: 11px;
		min-width: 80px;
	}

	.add-step button {
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		border: 0;
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: 11px;
		cursor: pointer;
	}
</style>
