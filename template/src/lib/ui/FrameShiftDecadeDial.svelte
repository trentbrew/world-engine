<script lang="ts">
	import { session } from '$lib/engine/net/session.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const CLOCK_ID = 'entity:museum/clock';

	const visible = $derived(ui.shellMode === 'play' && !!world.getEntity(CLOCK_ID));
	const decade = $derived(Number(world.getEntity(CLOCK_ID)?.components?.MuseumEra?.decade ?? 1890));
	const canDial = $derived(session.isHost);

	function eraLabel(value: number): string {
		return value === 1960 ? '1960s' : '1890s';
	}

	function setDecade(value: number) {
		if (!canDial || value === decade) return;
		world.applyFieldLocal(CLOCK_ID, 'MuseumEra', 'decade', value);
	}
</script>

{#if visible}
	<div class="era-dial" data-testid="frame-shift-era-dial">
		<span class="era-label">{eraLabel(decade)}</span>
		<div class="era-buttons" role="group" aria-label="Decade dial">
			<button
				type="button"
				class="era-btn"
				class:active={decade === 1890}
				disabled={!canDial}
				title={canDial ? '1890s' : 'Host controls the decade dial'}
				data-era="1890"
				onclick={() => setDecade(1890)}
			>
				1890
			</button>
			<button
				type="button"
				class="era-btn"
				class:active={decade === 1960}
				disabled={!canDial}
				title={canDial ? '1960s' : 'Host controls the decade dial'}
				data-era="1960"
				onclick={() => setDecade(1960)}
			>
				1960
			</button>
		</div>
	</div>
{/if}

<style>
	.era-dial {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 8px 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--background) 82%, transparent);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		backdrop-filter: blur(8px);
		font-size: 12px;
		color: var(--foreground);
	}

	.era-label {
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.era-buttons {
		display: flex;
		gap: 4px;
	}

	.era-btn {
		min-width: 44px;
		height: 28px;
		padding: 0 8px;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--background);
		color: var(--foreground);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.era-btn:hover:not(:disabled) {
		background: var(--accent);
	}

	.era-btn.active {
		background: var(--primary);
		color: var(--primary-foreground);
		border-color: transparent;
	}

	.era-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
