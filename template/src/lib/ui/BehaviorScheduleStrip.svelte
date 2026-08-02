<script lang="ts">
	import { analyzeClipSchedule } from '$lib/engine/events/scheduleAnalysis';
	import type { EntityEvents } from '$lib/engine/ontology/schema';

	interface Props {
		events: EntityEvents | undefined;
	}

	let { events }: Props = $props();

	const analysis = $derived(analyzeClipSchedule(events));
</script>

<section class="schedule-strip" aria-label="Clip schedule">
	<header>
		<span class="title">Schedule</span>
		{#if analysis.partial}
			<span class="badge partial">partial</span>
		{/if}
	</header>
	{#if analysis.chips.length > 0}
		<div class="chips">
			{#each analysis.chips as chip, i (i)}
				<div class="chip">
					<span class="at">+{chip.atSec.toFixed(1)}s</span>
					<span class="arrow">→</span>
					<span class="clip">{chip.clip}</span>
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty">No clip schedule — add alarm handlers with set Mesh3DAnimator.clip.</p>
	{/if}
</section>

<style>
	.schedule-strip {
		padding: 10px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
	}

	header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.title {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.badge.partial {
		font-size: 9px;
		padding: 1px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted-foreground) 20%, transparent);
		color: var(--muted-foreground);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--viewport) 40%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.at {
		color: var(--muted-foreground);
	}

	.arrow {
		color: var(--accent-entity);
	}

	.clip {
		color: var(--foreground);
	}

	.empty {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}
</style>
