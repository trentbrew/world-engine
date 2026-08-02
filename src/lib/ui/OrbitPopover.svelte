<script lang="ts">
	import { camera, DEFAULT_CONTROL_PREFS } from '$lib/engine/render/camera.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';

	const disabled = $derived(camera.mode !== 'orbit');

	function resetControl(field: 'rotateSpeed' | 'dollySpeed') {
		camera.controls[field] = DEFAULT_CONTROL_PREFS[field];
	}
</script>

<div class="popover-panel" role="dialog" aria-label="Navigation">
	<div class="popover-title">Navigation</div>
	{#if disabled}
		<p class="hint">Switch to Orbit camera to adjust navigation.</p>
	{:else}
		<div class="slider-row" title="Double-click to reset">
			<Label for="orbit-speed">Orbit speed</Label>
			<div
				class="slider-reset"
				ondblclick={(event) => {
					event.preventDefault();
					resetControl('rotateSpeed');
				}}
			>
				<Slider
					id="orbit-speed"
					type="single"
					min={0.1}
					max={2}
					step={0.1}
					value={camera.controls.rotateSpeed}
					onValueChange={(value) => {
						camera.controls.rotateSpeed = value ?? DEFAULT_CONTROL_PREFS.rotateSpeed;
					}}
				/>
			</div>
		</div>
		<div class="slider-row" title="Double-click to reset">
			<Label for="zoom-speed">Zoom speed</Label>
			<div
				class="slider-reset"
				ondblclick={(event) => {
					event.preventDefault();
					resetControl('dollySpeed');
				}}
			>
				<Slider
					id="zoom-speed"
					type="single"
					min={0.1}
					max={3}
					step={0.1}
					value={camera.controls.dollySpeed}
					onValueChange={(value) => {
						camera.controls.dollySpeed = value ?? DEFAULT_CONTROL_PREFS.dollySpeed;
					}}
				/>
			</div>
		</div>
		<div class="check-row">
			<Switch
				checked={camera.controls.invertY}
				size="sm"
				onCheckedChange={(checked) => {
					camera.controls.invertY = checked;
				}}
			/>
			<span>Invert Y axis</span>
		</div>
		<Button variant="outline" size="sm" class="reset-btn" onclick={() => camera.resetControlDefaults()}>
			Reset defaults
		</Button>
	{/if}
</div>

<style>
	.popover-panel {
		width: var(--popover-width);
		padding: 12px;
		background: var(--secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 32px rgb(0 0 0 / 0.45);
	}

	.popover-title {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin-bottom: 10px;
	}

	.hint {
		font-size: 11px;
		color: var(--muted-foreground);
		margin: 0;
	}

	.slider-row {
		margin-bottom: 10px;
	}

	.slider-row :global(label) {
		display: block;
		font-size: 11px;
		color: var(--muted-foreground);
		margin-bottom: 8px;
	}

	.check-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		margin-bottom: 10px;
	}

	:global(.reset-btn) {
		width: 100%;
		font-size: 11px;
	}
</style>
