<script lang="ts">
	import { onMount } from 'svelte';
	import { gamepad, gamepadAxis, gamepadLookAxis } from '$lib/engine/player/gamepad.svelte';
	import { playInputState } from '$lib/engine/player/playInputState.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import GamepadLiveVisual from '$lib/ui/GamepadLiveVisual.svelte';

	let tick = $state(0);

	onMount(() => {
		let raf = 0;
		const loop = () => {
			tick++;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const playing = $derived(ui.shellMode === 'play');
	const activePad = $derived.by(() => {
		void tick;
		return gamepad.resolveActivePad();
	});

	const moveAxis = $derived.by(() => {
		void tick;
		return gamepadAxis();
	});

	const lookAxis = $derived.by(() => {
		void tick;
		return gamepadLookAxis();
	});

	const moveMag = $derived(Math.min(1, Math.hypot(moveAxis.x, moveAxis.z)));
	const lookMag = $derived(Math.min(1, Math.hypot(lookAxis.x, lookAxis.y)));
	const tier = $derived(playing ? playInputState.locomotion.tier : 'idle');

	const moveDot = $derived({
		x: 50 + moveAxis.x * 38,
		y: 50 + moveAxis.z * 38
	});
	const lookDot = $derived({
		x: 50 + lookAxis.x * 38,
		y: 50 + lookAxis.y * 38
	});

	const layoutLabel = $derived.by(() => {
		if (!activePad) return 'none';
		if (activePad.mapping === 'standard') return 'standard gamepad';
		if (activePad.buttons.length >= 12) return `${activePad.buttons.length}-button pad`;
		return 'basic controller';
	});
</script>

<div class="controls-preview" aria-label="Live input preview">
	<header class="preview-head">
		<div>
			<h2 class="preview-title">Live input</h2>
			<p class="preview-sub">
				{#if activePad}
					{gamepad.label ?? 'Controller'} · {layoutLabel} · slot {gamepad.memberSlot + 1}
				{:else if gamepad.connected}
					{gamepad.count} pad{gamepad.count === 1 ? '' : 's'} connected — waiting for your slot
				{:else}
					No controller — press a button on your pad to wake it
				{/if}
			</p>
		</div>
		<span class="source-pill" class:active={moveMag > 0.01 || lookMag > 0.01}>
			{layoutLabel}
		</span>
	</header>

	<GamepadLiveVisual
		pad={activePad}
		{moveMag}
		{lookMag}
		{moveDot}
		{lookDot}
		{tier}
	/>
</div>

<style>
	.controls-preview {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: 100%;
		padding: 28px 32px;
		background: var(--viewport);
		align-items: center;
	}

	.preview-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		max-width: 720px;
	}

	.preview-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.preview-sub {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.source-pill {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 3px 10px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--card) 60%, transparent);
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.source-pill.active {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--foreground) 30%, var(--border));
	}
</style>
