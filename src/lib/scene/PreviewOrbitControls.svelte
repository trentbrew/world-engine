<script lang="ts">
	/**
	 * Shared orbit camera for asset/object preview stages — same gestures as
	 * the rooms editor (bindViewportNavigation) plus corner axis gizmo.
	 * Zoom % is reported via onZoomPercent for an overlay outside <Canvas>.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { CameraControls, Gizmo } from '@threlte/extras';
	import type CameraControlsImpl from 'camera-controls';
	import type { PerspectiveCamera } from 'three';
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import { bindViewportNavigation } from '$lib/scene/viewportNavigation';
	import { DEFAULT_CONTROL_PREFS } from '$lib/engine/render/camera.svelte';
	import { useViewportProjectionAlign } from '$lib/scene/viewportProjectionAlign.svelte';

	interface Props {
		/** Initial camera world position. */
		position?: [number, number, number];
		fov?: number;
		/** Called when CameraControls is ready (and again if it remounts). */
		onControls?: (controls: CameraControlsImpl | undefined) => void;
		/** Fired while dollying / orbiting — percent relative to referenceDistance. */
		onZoomPercent?: (percent: number) => void;
		showGizmo?: boolean;
		/** Reference distance for 100% zoom (getDistance at framed pose). */
		referenceDistance?: number;
	}

	let {
		position = [3.6, 2.4, 4.2],
		fov = 42,
		onControls,
		onZoomPercent,
		showGizmo = true,
		referenceDistance = 5.5
	}: Props = $props();

	const { renderer, invalidate } = useThrelte();
	const cfg = DEFAULT_CONTROL_PREFS;

	let controls = $state<CameraControlsImpl | undefined>();
	let camera = $state<PerspectiveCamera>();

	useViewportProjectionAlign(() => camera);

	$effect(() => {
		onControls?.(controls);
		return () => onControls?.(undefined);
	});

	function refreshZoom() {
		if (!controls || !onZoomPercent) return;
		const dist = controls.distance;
		if (!Number.isFinite(dist) || dist <= 0) return;
		const pct = Math.round((referenceDistance / dist) * 100);
		onZoomPercent(Math.max(5, Math.min(800, pct)));
		invalidate();
	}

	$effect(() => {
		const ctrl = controls;
		if (!ctrl) return;
		const onControl = () => refreshZoom();
		ctrl.addEventListener('control', onControl);
		ctrl.addEventListener('update', onControl);
		return () => {
			ctrl.removeEventListener('control', onControl);
			ctrl.removeEventListener('update', onControl);
		};
	});

	$effect(() => {
		if (!controls) return;
		return bindViewportNavigation({
			controls,
			dom: renderer.domElement,
			isOrtho: false,
			scheme: inputPrefs.navigationScheme,
			enabled: () => controls?.enabled ?? false
		});
	});
</script>

<T.PerspectiveCamera makeDefault bind:ref={camera} {position} {fov} />

{#if camera}
	<CameraControls
		bind:ref={controls}
		{camera}
		minDistance={cfg.minDistance}
		maxDistance={cfg.maxDistance}
		dollySpeed={cfg.dollySpeed}
		truckSpeed={cfg.truckSpeed}
		smoothTime={cfg.smoothTime}
		draggingSmoothTime={cfg.draggingSmoothTime}
		dollyToCursor={cfg.dollyToCursor}
		infinityDolly={cfg.infinityDolly}
	/>
{/if}

{#if showGizmo && controls}
	<Gizmo
		{controls}
		className="viewport-gizmo preview-orbit-gizmo"
		placement="bottom-left"
		size={56}
		offset={{ left: 12, bottom: 12 }}
		background={{ enabled: false }}
	/>
{/if}
