<script lang="ts">
	import { tick } from 'svelte';
	import { debugLog } from '$lib/ui/debug/debugLog.svelte';

	let scrollEl = $state<HTMLDivElement | null>(null);

	const entries = $derived(debugLog.entries);

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString(undefined, { hour12: false });
	}

	$effect(() => {
		entries;
		if (!debugLog.pinScroll || !scrollEl) return;
		tick().then(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});
</script>

<div class="logs-toolbar">
	<button
		type="button"
		class="toolbar-btn"
		class:on={debugLog.pinScroll}
		onclick={() => (debugLog.pinScroll = !debugLog.pinScroll)}
	>
		Pin scroll
	</button>
	<button type="button" class="toolbar-btn" onclick={() => debugLog.clear()}>Clear</button>
</div>

<div
	class="log-lines"
	bind:this={scrollEl}
	aria-live={debugLog.pinScroll ? 'polite' : 'off'}
>
	{#if entries.length === 0}
		<p class="empty">No logs yet</p>
	{:else}
		{#each entries as entry (entry.id)}
			<div class="log-line" class:warn={entry.level === 'warn'} class:err={entry.level === 'error'}>
				<span class="ts">{formatTime(entry.ts)}</span>{entry.text}
			</div>
		{/each}
	{/if}
</div>

<style>
	.logs-toolbar {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		margin-bottom: 8px;
	}

	.toolbar-btn {
		font: inherit;
		font-size: 10px;
		padding: 2px 8px;
		border-radius: var(--rounded-sm);
		border: 1px solid var(--border);
		background: var(--secondary);
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.toolbar-btn.on,
	.toolbar-btn:hover {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 80%, var(--foreground));
	}

	.toolbar-btn.on {
		border-color: var(--primary);
	}

	.log-lines {
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.55;
		color: var(--muted-foreground);
		max-height: 140px;
		overflow-y: auto;
	}

	.log-line {
		word-break: break-word;
	}

	.log-line.warn {
		color: oklch(0.75 0.12 85);
	}

	.log-line.err {
		color: var(--destructive);
	}

	.ts {
		opacity: 0.45;
		margin-right: 6px;
	}

	.empty {
		margin: 0;
		text-align: center;
		padding: 16px 0;
		font-size: 11px;
	}
</style>
