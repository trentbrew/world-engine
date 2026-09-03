<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { createStylizedSky, type StylizedSkyHandle } from '$lib/scene/sky/skyDome';
	import type { SkyMode } from '$lib/scene/sky/stylizedSkyPresets';
	import { ui } from '$lib/ui/ui.svelte';

	let { mode = 'night' as SkyMode }: { mode?: SkyMode } = $props();

	const { camera, invalidate } = useThrelte();

	let handle = $state<StylizedSkyHandle | undefined>();
	let elapsed = 0;

	$effect(() => {
		const sky = createStylizedSky({ mode, radius: 400 });
		handle = sky;
		invalidate();
		return () => {
			sky.dispose();
			if (handle === sky) handle = undefined;
		};
	});

	$effect(() => {
		handle?.setMode(mode);
		invalidate();
	});

	/**
	 * Clouds drift, stars twinkle and the aurora moves, so this is a genuine
	 * per-frame animation — and the 3D editor viewport renders on demand. Same
	 * rule as the grass field: animate in play, hold still in edit unless the
	 * author asks otherwise, or the editor becomes a permanent 60fps loop.
	 *
	 * The dome still needs to FOLLOW the camera whenever the camera moves, but
	 * that path already invalidates, so a held-still dome repaints correctly.
	 */
	const animating = $derived(ui.shellMode === 'play');

	useTask(
		(delta) => {
			if (!handle) return;
			elapsed += delta;
			handle.update(elapsed, camera.current);
		},
		{ running: () => handle !== undefined && animating }
	);

	// Even when not animating, keep the dome centred on the camera.
	$effect(() => {
		const cam = camera.current;
		if (!handle || !cam) return;
		handle.update(elapsed, cam);
	});
</script>

{#if handle}
	<T is={handle.object3D} />
{/if}
