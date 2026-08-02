<script lang="ts">
	import { gamepad } from '$lib/engine/player/gamepad.svelte';

	interface Props {
		pad: globalThis.Gamepad | null;
		moveMag?: number;
		lookMag?: number;
		moveDot?: { x: number; y: number };
		lookDot?: { x: number; y: number };
		tier?: string;
	}

	let {
		pad,
		moveMag = 0,
		lookMag = 0,
		moveDot = { x: 50, y: 50 },
		lookDot = { x: 50, y: 50 },
		tier = 'idle'
	}: Props = $props();

	type FaceId = 'north' | 'south' | 'east' | 'west';

	const FACE: Record<FaceId, { index: number; label: string; grid: string }> = {
		north: { index: 3, label: 'Y', grid: 'face-y' },
		south: { index: 0, label: 'A', grid: 'face-a' },
		east: { index: 1, label: 'B', grid: 'face-b' },
		west: { index: 2, label: 'X', grid: 'face-x' }
	};

	const layout = $derived.by(() => {
		if (!pad) return 'empty' as const;
		if (pad.mapping === 'standard' || pad.buttons.length >= 12) return 'standard' as const;
		if (pad.buttons.length >= 4) return 'compact' as const;
		return 'minimal' as const;
	});

	function pressed(index: number): boolean {
		return pad?.buttons[index]?.pressed ?? false;
	}

	function triggerValue(index: number): number {
		return pad?.buttons[index]?.value ?? 0;
	}

	const showTriggers = $derived((pad?.buttons.length ?? 0) >= 8);
	const showMeta = $derived((pad?.buttons.length ?? 0) >= 10);
	const showShoulders = $derived((pad?.buttons.length ?? 0) >= 6);
	const showFace = $derived((pad?.buttons.length ?? 0) >= 4);
	const showDpad = $derived((pad?.buttons.length ?? 0) >= 14);
</script>

{#if layout === 'empty'}
	<div class="pad-empty">
		<p>No controller detected</p>
		<p class="hint">Press any button on your pad to wake it</p>
	</div>
{:else}
	<div class="pad-shell" data-layout={layout} aria-label="Controller live input">
		{#if showShoulders}
			<div class="shoulder-row">
				<button type="button" class="btn shoulder" class:pressed={pressed(4)} disabled>LB</button>
				{#if showTriggers}
					<span
						class="trigger lt"
						class:pressed={triggerValue(6) > 0.08}
						style="--fill: {Math.min(1, triggerValue(6))}"
					>
						LT
					</span>
					<span
						class="trigger rt"
						class:pressed={triggerValue(7) > 0.08}
						style="--fill: {Math.min(1, triggerValue(7))}"
					>
						RT
					</span>
				{/if}
				<button type="button" class="btn shoulder" class:pressed={pressed(5)} disabled>RB</button>
			</div>
		{/if}

		<div class="mid-row">
			<section class="stick-card" aria-label="Move stick">
				<span class="label">Move</span>
				<div class="stick-well" class:active={moveMag > 0.01}>
					<div class="stick-ring"></div>
					<div class="stick-dot" style="left:{moveDot.x}%;top:{moveDot.y}%"></div>
				</div>
				<span class="meta">{moveMag.toFixed(2)} · {tier}</span>
			</section>

			{#if showDpad}
				<div class="dpad" aria-label="D-pad">
					<button type="button" class="btn dpad-btn up" class:pressed={pressed(12)} disabled>▲</button>
					<button type="button" class="btn dpad-btn left" class:pressed={pressed(14)} disabled>◀</button>
					<button type="button" class="btn dpad-btn right" class:pressed={pressed(15)} disabled>▶</button>
					<button type="button" class="btn dpad-btn down" class:pressed={pressed(13)} disabled>▼</button>
				</div>
			{/if}

			{#if showFace}
				<div class="face-cluster" aria-label="Face buttons">
					{#each Object.values(FACE) as face (face.grid)}
						<button
							type="button"
							class="btn face {face.grid}"
							class:pressed={pressed(face.index)}
							disabled
						>
							{face.label}
						</button>
					{/each}
				</div>
			{/if}

			<section class="stick-card" aria-label="Look stick">
				<span class="label">Look</span>
				<div class="stick-well" class:active={lookMag > 0.01}>
					<div class="stick-ring"></div>
					<div class="stick-dot" style="left:{lookDot.x}%;top:{lookDot.y}%"></div>
				</div>
				<span class="meta">{lookMag.toFixed(2)}</span>
			</section>
		</div>

		{#if showMeta}
			<div class="meta-row">
				<button type="button" class="btn meta-btn" class:pressed={pressed(8)} disabled>−</button>
				<span class="pad-id">{gamepad.label ?? 'Controller'}</span>
				<button type="button" class="btn meta-btn" class:pressed={pressed(9)} disabled>+</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.pad-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 220px;
		border: 1px dashed var(--border);
		border-radius: 14px;
		color: var(--muted-foreground);
		font-size: 13px;
	}

	.hint {
		margin: 0;
		font-size: 11px;
		opacity: 0.85;
	}

	.pad-shell {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: color-mix(in srgb, var(--card) 36%, var(--viewport));
		max-width: 720px;
		width: 100%;
	}

	.shoulder-row,
	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.mid-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 14px;
		align-items: center;
	}

	.pad-shell[data-layout='compact'] .mid-row {
		grid-template-columns: 1fr 1fr;
	}

	.stick-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.stick-well {
		position: relative;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--viewport) 60%, var(--background));
		border: 1px solid var(--border);
	}

	.stick-well.active {
		border-color: color-mix(in srgb, var(--muted-foreground) 40%, var(--border));
	}

	.stick-ring {
		position: absolute;
		inset: 12px;
		border-radius: 50%;
		border: 1px dashed color-mix(in srgb, var(--muted-foreground) 32%, transparent);
	}

	.stick-dot {
		position: absolute;
		width: 14px;
		height: 14px;
		margin: -7px 0 0 -7px;
		border-radius: 50%;
		background: var(--foreground);
	}

	.stick-well:not(.active) .stick-dot {
		background: var(--muted-foreground);
	}

	.meta {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		text-align: center;
	}

	.btn {
		font-family: var(--font-mono);
		font-size: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--card) 55%, transparent);
		color: var(--muted-foreground);
		cursor: default;
	}

	.btn.pressed {
		background: var(--foreground);
		color: var(--viewport);
		border-color: var(--foreground);
	}

	.shoulder {
		min-width: 42px;
		padding: 8px 10px;
	}

	.trigger {
		flex: 1;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 8px 0;
		border-radius: 8px;
		border: 1px solid var(--border);
		color: var(--muted-foreground);
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--foreground) calc(var(--fill, 0) * 72%), transparent),
			color-mix(in srgb, var(--card) 55%, transparent) calc(var(--fill, 0) * 100%)
		);
	}

	.trigger.pressed {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--foreground) 40%, var(--border));
	}

	.dpad {
		display: grid;
		grid-template-columns: repeat(3, 30px);
		grid-template-rows: repeat(3, 30px);
		gap: 4px;
		justify-self: center;
	}

	.dpad-btn.up {
		grid-column: 2;
		grid-row: 1;
	}
	.dpad-btn.left {
		grid-column: 1;
		grid-row: 2;
	}
	.dpad-btn.right {
		grid-column: 3;
		grid-row: 2;
	}
	.dpad-btn.down {
		grid-column: 2;
		grid-row: 3;
	}

	.face-cluster {
		display: grid;
		grid-template-columns: repeat(3, 34px);
		grid-template-rows: repeat(3, 34px);
		gap: 4px;
		justify-self: center;
	}

	.face-y {
		grid-column: 2;
		grid-row: 1;
		border-radius: 50%;
	}
	.face-x {
		grid-column: 1;
		grid-row: 2;
		border-radius: 50%;
	}
	.face-a {
		grid-column: 2;
		grid-row: 3;
		border-radius: 50%;
	}
	.face-b {
		grid-column: 3;
		grid-row: 2;
		border-radius: 50%;
	}

	.meta-btn {
		min-width: 38px;
		padding: 6px 8px;
		border-radius: 999px;
	}

	.pad-id {
		flex: 1;
		text-align: center;
		font-size: 11px;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
