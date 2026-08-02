<script lang="ts">
	import BehaviorAlarmLane from '$lib/ui/BehaviorAlarmLane.svelte';
	import BehaviorScheduleStrip from '$lib/ui/BehaviorScheduleStrip.svelte';
	import { createTypeEventsEditorModel } from '$lib/ui/typeEventsEditorModel.svelte';

	interface Props {
		typeName: string;
		readonly?: boolean;
	}

	let { typeName, readonly: _readonly = false }: Props = $props();

	const model = createTypeEventsEditorModel(
		() => typeName,
		() => _readonly
	);
</script>

<section class="type-schedule" aria-label="Type schedule">
	<BehaviorScheduleStrip events={model.events} />

	{#if model.alarmSlots.length > 0}
		<div class="alarm-lanes" aria-label="Alarm lanes">
			{#each model.alarmSlots as row (row.slot)}
				<BehaviorAlarmLane slot={row.slot} actions={row.actions} />
			{/each}
		</div>
	{:else}
		<p class="empty">No alarm lanes yet.</p>
	{/if}
</section>

<style>
	.type-schedule {
		display: grid;
		align-content: start;
		gap: var(--spacing-sm);
		padding: 0;
	}

	.alarm-lanes {
		display: grid;
		gap: 6px;
	}

	.empty {
		margin: 0;
		padding: 8px 12px;
		font-size: 11px;
		color: var(--muted-foreground);
	}
</style>
