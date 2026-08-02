<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { camera, DEFAULT_CONTROL_PREFS, DEFAULT_LENS } from '$lib/engine/render/camera.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import InspectorField from '$lib/ui/InspectorField.svelte';

	const projectionOptions = [
		{ value: 'perspective', label: 'Perspective' },
		{ value: 'orthographic', label: 'Orthographic' }
	];
</script>

<InspectorField
	id="cam-projection"
	label="projection"
	kind="select"
	value={camera.projection}
	options={projectionOptions}
	onChange={(value) =>
		(camera.projection = value === 'orthographic' ? 'orthographic' : 'perspective')}
/>
<InspectorField
	id="cam-nudge-space"
	label="arrow nudge"
	kind="select"
	value={camera.nudgeSpace}
	options={[
		{ value: 'camera', label: 'Camera-relative' },
		{ value: 'world', label: 'World axes' }
	]}
	onChange={(value) => (camera.nudgeSpace = value === 'world' ? 'world' : 'camera')}
/>
{#if camera.projection === 'perspective'}
	<InspectorField
		id="cam-fov"
		label="fov"
		kind="slider"
		min={20}
		max={120}
		step={1}
		defaultValue={DEFAULT_LENS.fov}
		value={camera.fov}
		onChange={(value) => (camera.fov = Number(value))}
	/>
{/if}
<InspectorField
	id="cam-near"
	label="near"
	kind="slider"
	min={0.01}
	max={5}
	step={0.01}
	defaultValue={DEFAULT_LENS.near}
	value={camera.near}
	onChange={(value) => (camera.near = Number(value))}
/>
<InspectorField
	id="cam-far"
	label="far"
	kind="slider"
	min={50}
	max={1000}
	step={10}
	defaultValue={DEFAULT_LENS.far}
	value={camera.far}
	onChange={(value) => (camera.far = Number(value))}
/>

<p class="group-label">Controls</p>
<InspectorField
	id="cam-rotate"
	label="rotate"
	kind="slider"
	min={0.1}
	max={2}
	step={0.1}
	defaultValue={DEFAULT_CONTROL_PREFS.rotateSpeed}
	value={camera.controls.rotateSpeed}
	onChange={(value) => (camera.controls.rotateSpeed = Number(value))}
/>
<InspectorField
	id="cam-dolly"
	label="zoom"
	kind="slider"
	min={0.1}
	max={3}
	step={0.1}
	defaultValue={DEFAULT_CONTROL_PREFS.dollySpeed}
	value={camera.controls.dollySpeed}
	onChange={(value) => (camera.controls.dollySpeed = Number(value))}
/>
<InspectorField
	id="cam-truck"
	label="pan"
	kind="slider"
	min={0.1}
	max={4}
	step={0.1}
	defaultValue={DEFAULT_CONTROL_PREFS.truckSpeed}
	value={camera.controls.truckSpeed}
	onChange={(value) => (camera.controls.truckSpeed = Number(value))}
/>
<InspectorField
	id="cam-smooth"
	label="smoothing"
	kind="slider"
	min={0}
	max={1}
	step={0.01}
	defaultValue={DEFAULT_CONTROL_PREFS.smoothTime}
	value={camera.controls.smoothTime}
	onChange={(value) => (camera.controls.smoothTime = Number(value))}
/>

<p class="group-label">Limits</p>
<InspectorField
	id="cam-min-dist"
	label="min dist"
	kind="slider"
	min={0.5}
	max={20}
	step={0.5}
	defaultValue={DEFAULT_CONTROL_PREFS.minDistance}
	value={camera.controls.minDistance}
	onChange={(value) => (camera.controls.minDistance = Number(value))}
/>
<InspectorField
	id="cam-max-dist"
	label="max dist"
	kind="slider"
	min={10}
	max={2000}
	step={10}
	defaultValue={DEFAULT_CONTROL_PREFS.maxDistance}
	value={camera.controls.maxDistance}
	onChange={(value) => (camera.controls.maxDistance = Number(value))}
/>
<InspectorField
	id="cam-min-polar"
	label="min angle"
	kind="slider"
	min={0}
	max={89}
	step={1}
	defaultValue={DEFAULT_CONTROL_PREFS.minPolarDeg}
	value={camera.controls.minPolarDeg}
	onChange={(value) => (camera.controls.minPolarDeg = Number(value))}
/>
<InspectorField
	id="cam-max-polar"
	label="max angle"
	kind="slider"
	min={1}
	max={89}
	step={1}
	defaultValue={DEFAULT_CONTROL_PREFS.maxPolarDeg}
	value={camera.controls.maxPolarDeg}
	onChange={(value) => (camera.controls.maxPolarDeg = Number(value))}
/>
<InspectorField
	id="cam-dolly-cursor"
	label="to cursor"
	kind="boolean"
	value={camera.controls.dollyToCursor}
	onChange={(value) => (camera.controls.dollyToCursor = Boolean(value))}
/>
<InspectorField
	id="cam-infinity"
	label="∞ dolly"
	kind="boolean"
	value={camera.controls.infinityDolly}
	onChange={(value) => (camera.controls.infinityDolly = Boolean(value))}
/>
<InspectorField
	id="cam-invert-y"
	label="invert Y"
	kind="boolean"
	value={camera.controls.invertY}
	onChange={(value) => (camera.controls.invertY = Boolean(value))}
/>

<div class="button-row">
	<Button variant="outline" size="sm" class="flex-1" onclick={() => camera.resetView()}>
		Reset view
	</Button>
	<Button
		variant="outline"
		size="sm"
		class="flex-1"
		disabled={!world.selectedEntity}
		onclick={() => camera.focusSelection()}
	>
		Focus
	</Button>
</div>
<Button
	variant="ghost"
	size="sm"
	class="reset-defaults"
	onclick={() => camera.resetControlDefaults()}
>
	Reset control defaults
</Button>

<style>
	.group-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 10px 0 6px;
	}

	.button-row {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}

	:global(.reset-defaults) {
		width: 100%;
		margin-top: 6px;
		font-size: 11px;
	}
</style>
