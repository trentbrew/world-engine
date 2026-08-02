<script lang="ts">
	import { T } from '@threlte/core';
	import { toonGradientMap } from '$lib/engine/render/toonGradient';
	import { ui } from '$lib/ui/ui.svelte';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

	let {
		color,
		emissive,
		emissiveIntensity = 1
	}: { color: string; emissive?: string; emissiveIntensity?: number } = $props();

	const toon = $derived(ui.scene.style.materialMode === 'toon');
	const wireframe = $derived(viewportDebug.wireframe);
	const emissiveColor = $derived(emissive ?? '#000000');
	const emissiveAmount = $derived(emissive ? emissiveIntensity : 1);
</script>

{#if toon}
	<T.MeshToonMaterial
		{color}
		{wireframe}
		gradientMap={toonGradientMap()}
		emissive={emissiveColor}
		emissiveIntensity={emissiveAmount}
	/>
{:else}
	<T.MeshStandardMaterial
		{color}
		{wireframe}
		emissive={emissiveColor}
		emissiveIntensity={emissiveAmount}
	/>
{/if}
