<script lang="ts">
	import { scheduler } from '$lib/engine/systems';
	import { input } from '$lib/engine/player/input';
	import { gamepad } from '$lib/engine/player/gamepad.svelte';
	import { playInputState } from '$lib/engine/player/playInputState.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const playing = $derived(ui.shellMode === 'play');
	const tick = $derived(scheduler.tick);

	const axis = $derived.by(() => {
		void tick;
		return input.axis();
	});

	const keys = $derived.by(() => {
		void tick;
		return {
			w: input.anyPressed('w', 'arrowup'),
			a: input.anyPressed('a', 'arrowleft'),
			s: input.anyPressed('s', 'arrowdown'),
			d: input.anyPressed('d', 'arrowright')
		};
	});

	const magnitude = $derived(Math.min(1, Math.hypot(axis.x, axis.z)));
	const tier = $derived(playInputState.locomotion.tier);
	const source = $derived(
		gamepad.activeIndex !== null && (axis.x !== 0 || axis.z !== 0) ? 'gamepad' : 'keyboard'
	);
	const stickDot = $derived({
		x: 50 + axis.x * 32,
		y: 50 + axis.z * 32
	});
</script>

{#if !playing}
	<p class="idle-msg">Start play to stream input</p>
{:else}
	<header class="hud-head">
		<span class="hud-label">Input</span>
		<span class="hud-source" class:gamepad={source === 'gamepad'}>{source}</span>
	</header>

	<div class="hud-body">
		<div class="stick-well" class:active={magnitude > 0.01}>
			<div class="stick-ring"></div>
			<div class="stick-dot" style="left:{stickDot.x}%;top:{stickDot.y}%"></div>
		</div>

		<div class="key-cluster">
			<span class="key k-w" class:pressed={keys.w}>W</span>
			<span class="key k-a" class:pressed={keys.a}>A</span>
			<span class="key k-s" class:pressed={keys.s}>S</span>
			<span class="key k-d" class:pressed={keys.d}>D</span>
		</div>
	</div>

	<footer class="hud-foot">
		<label class="invert-toggle">
			<input type="checkbox" bind:checked={gamepad.invertStickX} onchange={() => gamepad.savePrefs()} />
			<span>Invert move X</span>
		</label>
		<label class="invert-toggle">
			<input type="checkbox" bind:checked={gamepad.invertStickY} onchange={() => gamepad.savePrefs()} />
			<span>Invert move Y</span>
		</label>
		<label class="invert-toggle">
			<input type="checkbox" bind:checked={gamepad.invertLookY} onchange={() => gamepad.savePrefs()} />
			<span>Invert look Y</span>
		</label>
		<span class="hud-tier" class:active={tier !== 'idle'}>{tier}</span>
		<span class="hud-mag-track" aria-hidden="true">
			<span class="hud-mag-fill" style="width:{magnitude * 100}%"></span>
		</span>
		<span class="hud-mag-val">{magnitude.toFixed(2)}</span>
	</footer>
{/if}

<style>
	.idle-msg {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
		text-align: center;
		padding: 24px 8px;
	}

	.hud-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.hud-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.hud-source {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 1px 7px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--card) 60%, transparent);
	}

	.hud-source.gamepad {
		color: var(--foreground);
	}

	.hud-body {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.stick-well {
		position: relative;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--viewport) 60%, var(--background));
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.stick-well.active {
		border-color: color-mix(in srgb, var(--muted-foreground) 40%, var(--border));
	}

	.stick-ring {
		position: absolute;
		inset: 7px;
		border-radius: 50%;
		border: 1px dashed color-mix(in srgb, var(--muted-foreground) 32%, transparent);
	}

	.stick-dot {
		position: absolute;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border-radius: 50%;
		background: var(--foreground);
	}

	.stick-well:not(.active) .stick-dot {
		background: var(--muted-foreground);
	}

	.key-cluster {
		display: grid;
		grid-template-columns: repeat(3, 20px);
		grid-template-rows: repeat(2, 20px);
		gap: 3px;
	}

	.key {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 50%, transparent);
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--muted-foreground);
	}

	.key.pressed {
		background: var(--foreground);
		color: var(--viewport);
		border-color: var(--foreground);
	}

	.k-w {
		grid-column: 2;
		grid-row: 1;
	}
	.k-a {
		grid-column: 1;
		grid-row: 2;
	}
	.k-s {
		grid-column: 2;
		grid-row: 2;
	}
	.k-d {
		grid-column: 3;
		grid-row: 2;
	}

	.hud-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.invert-toggle {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		color: var(--muted-foreground);
		cursor: pointer;
		user-select: none;
	}

	.invert-toggle input {
		margin: 0;
	}

	.hud-tier {
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		color: var(--muted-foreground);
		min-width: 42px;
	}

	.hud-tier.active {
		color: var(--foreground);
	}

	.hud-mag-track {
		flex: 1;
		height: 3px;
		border-radius: var(--rounded-pill);
		background: color-mix(in srgb, var(--card) 70%, transparent);
		overflow: hidden;
	}

	.hud-mag-fill {
		display: block;
		height: 100%;
		background: var(--foreground);
	}

	.hud-mag-val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		min-width: 30px;
		text-align: right;
	}
</style>
