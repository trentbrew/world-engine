<script lang="ts">
	import { durableSession } from '$lib/engine/durable/session.svelte';
	import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';

	interface Props {
		entityId?: string | null;
	}

	let { entityId = null }: Props = $props();

	const durableLive = $derived(
		durableSession.mode === 'trellis' && durableSession.connected
	);

	const entityOps = $derived(
		entityId ? durableSession.ops.filter((op) => op.entityId === entityId) : []
	);

	function formatRelativeTime(at: number): string {
		const sec = Math.floor((Date.now() - at) / 1000);
		if (sec < 60) return `${sec}s ago`;
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		return `${Math.floor(min / 60)}h ago`;
	}

	function formatValuePreview(value: unknown): string {
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		return text.length > 32 ? `${text.slice(0, 32)}…` : text;
	}

	function formatOpSummary(op: (typeof durableSession.ops)[number]): string {
		switch (op.kind) {
			case 'setField':
				return `${op.component}.${op.field} → ${formatValuePreview(op.value)}`;
			case 'setComponent':
				return `+ ${op.component} ${formatValuePreview(op.value)}`;
			case 'removeComponent':
				return `− ${op.component}`;
			case 'setEntity':
				return 'entity JSON';
			case 'defineType': {
				const val = op.value as { name?: string; components?: number } | undefined;
				if (val?.name) return `${val.name} · ${val.components ?? 0} components`;
				return 'defineType';
			}
			default:
				return op.kind;
		}
	}
</script>

<div class="ops-panel">
	{#if !entityId}
		<InspectorEmptyState
			title="No ops log"
			hint="Durable history requires ?durable=trellis and a running Trellis server."
		/>
	{:else if !durableLive}
		<InspectorEmptyState
			title="No ops log"
			hint="Durable history requires ?durable=trellis and a running Trellis server."
		/>
	{:else if entityOps.length === 0}
		<InspectorEmptyState title="No ops recorded for this entity" />
	{:else}
		{#each entityOps as op (op.id)}
			<div class="ops-row" title={op.id}>
				<span><strong>{op.kind}</strong> {formatOpSummary(op)}</span>
				<span class="ops-time">{formatRelativeTime(op.at)}</span>
			</div>
		{/each}
	{/if}
</div>

<style>
	.ops-panel {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-sm) var(--spacing-md);
	}

	.ops-row {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 6px 0 6px 10px;
		border-left: 2px solid var(--border);
		margin-bottom: 8px;
		color: var(--muted-foreground);
		line-height: 1.4;
	}

	.ops-row strong {
		color: var(--foreground);
		font-weight: 500;
	}

	.ops-time {
		display: block;
		margin-top: 2px;
		opacity: 0.7;
	}
</style>
