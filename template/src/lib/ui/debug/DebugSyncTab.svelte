<script lang="ts">
	import { collab } from '$lib/engine/collab/collab.svelte';
	import { durableSession } from '$lib/engine/durable/session.svelte';
	import { session } from '$lib/engine/net/session.svelte';

	const clientSuffix = $derived(session.clientId.slice(-8));
</script>

<div class="sync-list">
	<div class="sync-row">
		<span class="k">Room</span>
		<span class="v">{collab.roomAlias || collab.roomId || '—'}</span>
	</div>
	{#if collab.roomId}
		<div class="sync-row">
			<span class="k">Room id</span>
			<span class="v mono">{collab.roomId}</span>
		</div>
	{/if}
	<div class="sync-row">
		<span class="k">Transport</span>
		<span class="v">{session.connected ? session.transportKind : 'offline'}</span>
	</div>
	<div class="sync-row">
		<span class="k">Role</span>
		<span class="v">{session.connected ? (session.isHost ? 'host' : 'viewer') : '—'}</span>
	</div>
	<div class="sync-row">
		<span class="k">Peers</span>
		<span class="v">{session.connected ? `${session.peerCount} connected` : '0'}</span>
	</div>
	{#if durableSession.mode === 'trellis'}
		<div class="sync-row">
			<span class="k">Durable</span>
			<span class="v" class:live={durableSession.connected}>
				{durableSession.connected ? 'live' : 'offline'}
			</span>
		</div>
	{/if}
	{#if session.clientId}
		<div class="sync-row">
			<span class="k">Client</span>
			<span class="v mono">…{clientSuffix}</span>
		</div>
	{/if}
</div>

<style>
	.sync-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sync-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	.k {
		font-size: 11px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.v {
		font-size: 11px;
		text-align: right;
		color: var(--foreground);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.v.mono {
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.v.live {
		color: var(--success);
		font-weight: 500;
	}
</style>
