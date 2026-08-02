<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button/index.js';
	import { camera } from '$lib/engine/render/camera.svelte';
	import {
		FOLLOW_CAMERA_PRESET_OPTIONS,
		followCameraPreset,
		type FollowCameraConfig,
		type FollowCameraPresetId
	} from '$lib/engine/player/playInput';
	import { playInputState } from '$lib/engine/player/playInputState.svelte';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorField from '$lib/ui/InspectorField.svelte';
	import InspectorAccordion from '$lib/ui/InspectorAccordion.svelte';

	let expanded = $state(false);
	let controlsOpen = $state(true);
	let followOpen = $state(true);

	const cam = $derived(playInputState.config.followCamera);
	const following = $derived(camera.mode === 'follow');
	const presetLabel = $derived(
		FOLLOW_CAMERA_PRESET_OPTIONS.find((option) => option.value === cam.preset)?.label ??
			cam.preset
	);

	function patchFollow(partial: Partial<FollowCameraConfig>) {
		playInputState.applyConfig({
			...playInputState.config,
			followCamera: { ...playInputState.config.followCamera, ...partial }
		});
	}

	function setPreset(value: string | number | boolean) {
		const preset = String(value) as FollowCameraPresetId;
		if (!FOLLOW_CAMERA_PRESET_OPTIONS.some((option) => option.value === preset)) return;
		playInputState.applyConfig({
			...playInputState.config,
			followCamera: followCameraPreset(preset)
		});
	}

	function setLookAtAxis(axis: 0 | 1 | 2, raw: string) {
		const next: [number, number, number] = [
			cam.lookAtOffset[0],
			cam.lookAtOffset[1],
			cam.lookAtOffset[2]
		];
		next[axis] = Number(raw) || 0;
		patchFollow({ lookAtOffset: next });
	}

	function setDeadZoneAxis(axis: 0 | 1, raw: string) {
		const next: [number, number] = [cam.deadZone[0], cam.deadZone[1]];
		next[axis] = Number(raw) || 0;
		patchFollow({ deadZone: next });
	}

	function resetPreset() {
		playInputState.applyConfig({
			...playInputState.config,
			followCamera: followCameraPreset(cam.preset)
		});
	}

	function collapse() {
		expanded = false;
	}

	$effect(() => {
		if (!expanded) return;
		const handler = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopImmediatePropagation();
			collapse();
		};
		window.addEventListener('keydown', handler, true);
		return () => window.removeEventListener('keydown', handler, true);
	});
</script>

<div class="camera-controls" role="group">
	<button
		type="button"
		class="camera-pill"
		aria-expanded={expanded}
		aria-label={`Camera controls, ${presetLabel}, ${expanded ? 'collapse' : 'expand'}`}
		onclick={() => (expanded = !expanded)}
	>
		<CameraIcon class="pill-icon" aria-hidden="true" />
		<span class="pill-tab">Camera</span>
		<span class="pill-sep" aria-hidden="true">·</span>
		<span class="pill-metric">{presetLabel}</span>
		<ChevronDownIcon class="pill-chev" aria-hidden="true" />
	</button>

	{#if expanded}
		<div class="camera-panel" role="region" aria-label="Camera controls">
			<div class="panel-header">
				<span class="panel-title">Camera</span>
				<button type="button" class="collapse-btn" aria-label="Collapse" onclick={collapse}>
					−
				</button>
			</div>
			<div class="panel-body">
				<InspectorField
					id="play-cam-preset"
					label="preset"
					kind="select"
					value={cam.preset}
					options={FOLLOW_CAMERA_PRESET_OPTIONS.map((option) => ({
						value: option.value,
						label: option.label
					}))}
					onChange={setPreset}
				/>

				<InspectorAccordion title="CameraControls" bind:open={controlsOpen}>
					<InspectorField
						id="play-cam-smooth"
						label="smoothTime"
						kind="slider"
						min={0}
						max={1}
						step={0.01}
						defaultValue={0.2}
						value={cam.smoothTime}
						onChange={(value) => patchFollow({ smoothTime: Number(value) })}
					/>
					<InspectorField
						id="play-cam-distance"
						label="distance"
						kind="slider"
						min={1}
						max={30}
						step={0.1}
						defaultValue={6}
						value={cam.distance}
						onChange={(value) => patchFollow({ distance: Number(value) })}
					/>
					<InspectorField
						id="play-cam-min-polar"
						label="minPolarAngle"
						kind="slider"
						min={0}
						max={Math.PI}
						step={0.01}
						defaultValue={0.3}
						value={cam.minPolarAngle}
						onChange={(value) => patchFollow({ minPolarAngle: Number(value) })}
					/>
					<InspectorField
						id="play-cam-max-polar"
						label="maxPolarAngle"
						kind="slider"
						min={0}
						max={Math.PI}
						step={0.01}
						defaultValue={1.5}
						value={cam.maxPolarAngle}
						onChange={(value) => patchFollow({ maxPolarAngle: Number(value) })}
					/>
					<InspectorField
						id="play-cam-azimuth-locked"
						label="azimuthLocked"
						kind="boolean"
						value={cam.azimuthLocked}
						onChange={(value) => patchFollow({ azimuthLocked: Boolean(value) })}
					/>
					<InspectorField
						id="play-cam-pointer-lock"
						label="pointerLock"
						kind="boolean"
						value={cam.pointerLock}
						onChange={(value) => patchFollow({ pointerLock: Boolean(value) })}
					/>
				</InspectorAccordion>

				<InspectorAccordion title="useFollow" bind:open={followOpen}>
					<div class="vec-field">
						<span class="vec-label">lookAtOffset</span>
						<div class="vec-inputs">
							<FieldWell>
								<input
									class="vec-input"
									type="number"
									step="0.01"
									aria-label="lookAtOffset X"
									value={cam.lookAtOffset[0]}
									oninput={(event) => setLookAtAxis(0, event.currentTarget.value)}
								/>
							</FieldWell>
							<FieldWell>
								<input
									class="vec-input"
									type="number"
									step="0.01"
									aria-label="lookAtOffset Y"
									value={cam.lookAtOffset[1]}
									oninput={(event) => setLookAtAxis(1, event.currentTarget.value)}
								/>
							</FieldWell>
							<FieldWell>
								<input
									class="vec-input"
									type="number"
									step="0.01"
									aria-label="lookAtOffset Z"
									value={cam.lookAtOffset[2]}
									oninput={(event) => setLookAtAxis(2, event.currentTarget.value)}
								/>
							</FieldWell>
						</div>
					</div>

					<div class="vec-field">
						<span class="vec-label">deadZone</span>
						<div class="vec-inputs">
							<FieldWell>
								<input
									class="vec-input"
									type="number"
									step="0.01"
									aria-label="deadZone X"
									value={cam.deadZone[0]}
									oninput={(event) => setDeadZoneAxis(0, event.currentTarget.value)}
								/>
							</FieldWell>
							<FieldWell>
								<input
									class="vec-input"
									type="number"
									step="0.01"
									aria-label="deadZone Y"
									value={cam.deadZone[1]}
									oninput={(event) => setDeadZoneAxis(1, event.currentTarget.value)}
								/>
							</FieldWell>
						</div>
					</div>

					<InspectorField
						id="play-cam-look-ahead"
						label="lookAhead"
						kind="slider"
						min={0}
						max={4}
						step={0.05}
						defaultValue={0}
						value={cam.lookAhead}
						onChange={(value) => patchFollow({ lookAhead: Number(value) })}
					/>
					<InspectorField
						id="play-cam-follow-smooth"
						label="followSmoothTime"
						kind="slider"
						min={0}
						max={1}
						step={0.01}
						defaultValue={0.15}
						value={cam.followSmoothTime}
						onChange={(value) => patchFollow({ followSmoothTime: Number(value) })}
					/>
					<InspectorField
						id="play-cam-track-rotation"
						label="trackRotation"
						kind="boolean"
						value={cam.trackRotation}
						onChange={(value) => patchFollow({ trackRotation: Boolean(value) })}
					/>
					<InspectorField
						id="play-cam-track-rot-smooth"
						label="trackRotationSmoothTime"
						kind="slider"
						min={0}
						max={1}
						step={0.01}
						defaultValue={0}
						value={cam.trackRotationSmoothTime}
						onChange={(value) => patchFollow({ trackRotationSmoothTime: Number(value) })}
					/>
					<InspectorField
						id="play-cam-track-rot-offset"
						label="trackRotationOffset"
						kind="slider"
						min={-Math.PI}
						max={Math.PI}
						step={0.01}
						defaultValue={0}
						value={cam.trackRotationOffset}
						onChange={(value) => patchFollow({ trackRotationOffset: Number(value) })}
					/>
					<InspectorField
						id="play-cam-following"
						label="following"
						kind="boolean"
						value={following}
						onChange={(value) => camera.setMode(value ? 'follow' : 'orbit')}
					/>
				</InspectorAccordion>

				<Button variant="outline" size="sm" class="reset-preset" onclick={resetPreset}>
					Reset preset
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.camera-controls {
		display: flex;
		flex-direction: column-reverse;
		align-items: flex-start;
		gap: 8px;
		pointer-events: auto;
	}

	.camera-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 10px 0 8px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.24);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.camera-pill:hover {
		background: var(--secondary);
	}

	.camera-pill:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	:global(.pill-icon) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		opacity: 0.85;
	}

	.pill-tab {
		color: var(--muted-foreground);
	}

	.pill-sep {
		color: var(--muted-foreground);
		opacity: 0.5;
	}

	.pill-metric {
		font-family: var(--font-mono);
		font-weight: 500;
	}

	:global(.pill-chev) {
		width: 14px;
		height: 14px;
		opacity: 0.5;
		margin-left: 2px;
	}

	.camera-panel {
		display: flex;
		flex-direction: column;
		width: 300px;
		max-height: min(62vh, 520px);
		border-radius: var(--rounded-lg);
		border: 1px solid var(--border);
		background: var(--card);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.28);
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		padding: 0 4px 0 var(--spacing-sm);
		flex-shrink: 0;
		min-height: 36px;
	}

	.panel-title {
		font-size: 11px;
		font-weight: 600;
		color: var(--foreground);
	}

	.collapse-btn {
		width: 28px;
		height: 28px;
		margin: 4px 4px 4px 0;
		border: none;
		border-radius: var(--rounded-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		flex-shrink: 0;
	}

	.collapse-btn:hover {
		background: var(--secondary);
		color: var(--foreground);
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 8px 10px 12px;
	}

	.vec-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 8px 0;
	}

	.vec-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.vec-inputs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}

	.vec-inputs:has(:nth-child(2):last-child) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.vec-input {
		width: 100%;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 4px 6px;
	}

	.vec-input:focus {
		outline: none;
	}

	:global(.reset-preset) {
		width: 100%;
		margin-top: 10px;
	}

	@media (prefers-reduced-motion: reduce) {
		.camera-pill,
		.camera-panel {
			transition: none;
		}
	}
</style>

