<script lang="ts">
	import { T } from '@threlte/core';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position } from '$lib/engine/render/access';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	type LightConfig = {
		kind?: string;
		intensity?: number;
		color?: string;
		shadowMapSize?: number;
		shadowCamSize?: number;
		shadowBias?: number;
		shadowNormalBias?: number;
	};

	const light = $derived(comp<LightConfig>(entity, 'Light') ?? {});
	const pos = $derived(position(entity));
	const kind = $derived(light.kind ?? 'ambient');
	const intensity = $derived(light.intensity ?? 1);
	const color = $derived(light.color ?? '#ffffff');

	const shadowMapSize = $derived(light.shadowMapSize ?? 1024);
	// three's DirectionalLightShadow defaults to an ortho frustum of ±5 world
	// units. Anything larger than that — a wide ground plane, a grass field —
	// falls outside the shadow camera and silently loses its shadows.
	const shadowCamSize = $derived(light.shadowCamSize ?? 5);
	const shadowBias = $derived(light.shadowBias ?? 0);
	const shadowNormalBias = $derived(light.shadowNormalBias ?? 0);
</script>

{#if kind === 'directional'}
	<T.DirectionalLight
		position={pos}
		{intensity}
		{color}
		castShadow={ui.scene.shadows}
		shadow.mapSize.width={shadowMapSize}
		shadow.mapSize.height={shadowMapSize}
		shadow.bias={shadowBias}
		shadow.normalBias={shadowNormalBias}
		shadow.camera.left={-shadowCamSize}
		shadow.camera.right={shadowCamSize}
		shadow.camera.top={shadowCamSize}
		shadow.camera.bottom={-shadowCamSize}
	/>
{:else}
	<T.AmbientLight {intensity} {color} />
{/if}
