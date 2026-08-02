<script lang="ts">
	import {
		ART_STYLE_LABELS,
		defaultSceneStyle,
		type ArtStyleId,
		type MaterialMode,
		type ToneMappingId
	} from '$lib/scene/artStyles';
	import InspectorField from '$lib/ui/InspectorField.svelte';
	import { NONE_ON_OPTIONS, boolToNoneOn, noneOnToBool } from '$lib/ui/inspectorOptions';
	import { ui } from '$lib/ui/ui.svelte';

	const artStyleOptions: Exclude<ArtStyleId, 'custom'>[] = [
		'realistic',
		'toon',
		'ink',
		'clay',
		'noir'
	];

	const materialOptions = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'toon', label: 'Toon' }
	];

	const toneMappingOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'linear', label: 'Linear' },
		{ value: 'reinhard', label: 'Reinhard' },
		{ value: 'cineon', label: 'Cineon' },
		{ value: 'aces', label: 'ACES' },
		{ value: 'agx', label: 'AgX' },
		{ value: 'neutral', label: 'Neutral' }
	];

	const styleDefaults = defaultSceneStyle();

	function editStyle(mutate: () => void) {
		mutate();
		ui.touchStyleCustom();
	}
</script>

<p class="group-label">Art style</p>
<div class="style-grid">
	{#each artStyleOptions as id (id)}
		<button
			type="button"
			class="style-btn"
			class:active={ui.scene.style.artStyle === id}
			onclick={() => ui.setArtStyle(id)}
		>
			{ART_STYLE_LABELS[id]}
		</button>
	{/each}
</div>
{#if ui.scene.style.artStyle === 'custom'}
	<p class="custom-hint">Custom — edited from a preset</p>
{/if}

<p class="group-label">Surface</p>
<InspectorField
	id="style-material"
	label="material"
	kind="select"
	value={ui.scene.style.materialMode}
	options={materialOptions}
	onChange={(value) => editStyle(() => (ui.scene.style.materialMode = value as MaterialMode))}
/>
<InspectorField
	id="style-tonemap"
	label="tone map"
	kind="select"
	value={ui.scene.style.toneMapping}
	options={toneMappingOptions}
	onChange={(value) => editStyle(() => (ui.scene.style.toneMapping = value as ToneMappingId))}
/>
<InspectorField
	id="style-exposure"
	label="exposure"
	kind="slider"
	min={0.1}
	max={2}
	step={0.05}
	defaultValue={styleDefaults.exposure}
	value={ui.scene.style.exposure}
	onChange={(value) => editStyle(() => (ui.scene.style.exposure = Number(value)))}
/>

<p class="group-label">Fog</p>
<InspectorField
	id="style-fog"
	label="fog"
	kind="select"
	value={boolToNoneOn(ui.scene.style.fog.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.fog.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.fog.enabled}
	<InspectorField
		id="style-fog-color"
		label="color"
		kind="color"
		value={ui.scene.style.fog.color}
		onChange={(value) => editStyle(() => (ui.scene.style.fog.color = String(value)))}
	/>
	<InspectorField
		id="style-fog-near"
		label="near"
		kind="slider"
		min={0}
		max={100}
		step={1}
		defaultValue={styleDefaults.fog.near}
		value={ui.scene.style.fog.near}
		onChange={(value) => editStyle(() => (ui.scene.style.fog.near = Number(value)))}
	/>
	<InspectorField
		id="style-fog-far"
		label="far"
		kind="slider"
		min={20}
		max={400}
		step={5}
		defaultValue={styleDefaults.fog.far}
		value={ui.scene.style.fog.far}
		onChange={(value) => editStyle(() => (ui.scene.style.fog.far = Number(value)))}
	/>
{/if}

<p class="group-label">Bloom</p>
<InspectorField
	id="style-bloom"
	label="bloom"
	kind="select"
	value={boolToNoneOn(ui.scene.style.bloom.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.bloom.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.bloom.enabled}
	<InspectorField
		id="style-bloom-intensity"
		label="intensity"
		kind="slider"
		min={0}
		max={3}
		step={0.05}
		defaultValue={styleDefaults.bloom.intensity}
		value={ui.scene.style.bloom.intensity}
		onChange={(value) => editStyle(() => (ui.scene.style.bloom.intensity = Number(value)))}
	/>
	<InspectorField
		id="style-bloom-threshold"
		label="threshold"
		kind="slider"
		min={0}
		max={1}
		step={0.01}
		defaultValue={styleDefaults.bloom.threshold}
		value={ui.scene.style.bloom.threshold}
		onChange={(value) => editStyle(() => (ui.scene.style.bloom.threshold = Number(value)))}
	/>
{/if}

<p class="group-label">Vignette</p>
<InspectorField
	id="style-vignette"
	label="vignette"
	kind="select"
	value={boolToNoneOn(ui.scene.style.vignette.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.vignette.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.vignette.enabled}
	<InspectorField
		id="style-vignette-darkness"
		label="darkness"
		kind="slider"
		min={0}
		max={1}
		step={0.05}
		defaultValue={styleDefaults.vignette.darkness}
		value={ui.scene.style.vignette.darkness}
		onChange={(value) => editStyle(() => (ui.scene.style.vignette.darkness = Number(value)))}
	/>
{/if}

<p class="group-label">Grain</p>
<InspectorField
	id="style-grain"
	label="grain"
	kind="select"
	value={boolToNoneOn(ui.scene.style.grain.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.grain.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.grain.enabled}
	<InspectorField
		id="style-grain-opacity"
		label="opacity"
		kind="slider"
		min={0}
		max={1}
		step={0.02}
		defaultValue={styleDefaults.grain.opacity}
		value={ui.scene.style.grain.opacity}
		onChange={(value) => editStyle(() => (ui.scene.style.grain.opacity = Number(value)))}
	/>
{/if}

<p class="group-label">Outline</p>
<InspectorField
	id="style-outline"
	label="outline"
	kind="select"
	value={boolToNoneOn(ui.scene.style.outline.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.outline.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.outline.enabled}
	<InspectorField
		id="style-outline-color"
		label="color"
		kind="color"
		value={ui.scene.style.outline.color}
		onChange={(value) => editStyle(() => (ui.scene.style.outline.color = String(value)))}
	/>
	<InspectorField
		id="style-outline-thickness"
		label="thickness"
		kind="slider"
		min={1}
		max={6}
		step={0.5}
		defaultValue={styleDefaults.outline.thickness}
		value={ui.scene.style.outline.thickness}
		onChange={(value) => editStyle(() => (ui.scene.style.outline.thickness = Number(value)))}
	/>
{/if}

<p class="group-label">Sketch</p>
<InspectorField
	id="style-sketch"
	label="sketch"
	kind="select"
	value={boolToNoneOn(ui.scene.style.sketch.enabled)}
	options={[...NONE_ON_OPTIONS]}
	onChange={(value) => editStyle(() => (ui.scene.style.sketch.enabled = noneOnToBool(value)))}
/>
{#if ui.scene.style.sketch.enabled}
	<InspectorField
		id="style-sketch-intensity"
		label="intensity"
		kind="slider"
		min={0}
		max={1}
		step={0.05}
		defaultValue={styleDefaults.sketch.intensity}
		value={ui.scene.style.sketch.intensity}
		onChange={(value) => editStyle(() => (ui.scene.style.sketch.intensity = Number(value)))}
	/>
{/if}

<style>
	.group-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		margin: 10px 0 6px;
	}

	.style-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin-bottom: 6px;
	}

	.style-btn {
		font-family: inherit;
		font-size: 11px;
		padding: 6px 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--viewport);
		color: var(--muted-foreground);
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease;
	}

	.style-btn:hover {
		color: var(--foreground);
		border-color: var(--ring);
	}

	.style-btn.active {
		background: var(--card);
		color: var(--foreground);
		border-color: var(--ring);
	}

	.custom-hint {
		font-size: 10px;
		color: var(--muted-foreground);
		margin: 0 0 6px;
		font-style: italic;
	}
</style>
