<script lang="ts">
	import { camera } from '$lib/engine/render/camera.svelte';
	import { gamepad } from '$lib/engine/player/gamepad.svelte';
	import { durableSession } from '$lib/engine/durable/session.svelte';
	import { session } from '$lib/engine/net/session.svelte';
	import { movementJank } from '$lib/engine/player/movementJank.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { scheduler } from '$lib/engine/systems';
	import { ui } from '$lib/ui/ui.svelte';

	const entityCount = $derived(world.selectableEntities.length);
	const projectionLabel = $derived(camera.projection === 'orthographic' ? 'Ortho' : 'Persp');
	const inPlay = $derived(ui.shellMode === 'play');
</script>

<div class="stat-grid">
	<div class="stat-row">
		<span class="label">Entities</span>
		<span class="val">{entityCount}</span>
	</div>
	<div class="stat-row">
		<span class="label">Tick</span>
		<span class="val">{scheduler.tick}</span>
	</div>
	{#if session.connected}
		<div class="stat-row">
			<span class="label">Peers</span>
			<span class="val">{session.peerCount}</span>
		</div>
		<div class="stat-row">
			<span class="label">Role</span>
			<span class="val">{session.isHost ? 'host' : 'viewer'}</span>
		</div>
		<div class="stat-row">
			<span class="label">Transport</span>
			<span class="val">{session.transportKind}</span>
		</div>
	{/if}
	{#if durableSession.mode === 'trellis'}
		<div class="stat-row">
			<span class="label">Durable</span>
			<span class="val">{durableSession.connected ? 'live' : 'offline'}</span>
		</div>
	{/if}
	<div class="stat-row">
		<span class="label">Controller</span>
		<span class="val">
			{gamepad.activeIndex !== null
				? (gamepad.label ?? `pad ${gamepad.activeIndex + 1}`)
				: gamepad.connected
					? `none (slot ${gamepad.memberSlot + 1})`
					: 'none'}
		</span>
	</div>
	<div class="stat-row">
		<span class="label">Projection</span>
		<span class="val">{projectionLabel}</span>
	</div>
	<div class="stat-row">
		<span class="label">Zoom</span>
		<span class="val">100%</span>
	</div>
	{#if inPlay}
		<div class="stat-row">
			<span class="label">Move score</span>
			<span class="val">{movementJank.score} · {movementJank.status}</span>
		</div>
		<div class="stat-row">
			<span class="label">Ground edges/s</span>
			<span class="val">{movementJank.groundedEdgesPerSec}</span>
		</div>
		<div class="stat-row">
			<span class="label">Y jitter rms</span>
			<span class="val">{movementJank.yJitterRms.toFixed(4)}</span>
		</div>
		<div class="stat-row">
			<span class="label">Last unground</span>
			<span class="val">{movementJank.lastUnground}</span>
		</div>
	{/if}
</div>

<style>
	.stat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 12px;
	}

	.stat-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.label {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.val {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		color: var(--foreground);
	}
</style>
