<script lang="ts">
	import { T } from '@threlte/core';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position } from '$lib/engine/render/access';
	import { ui } from '$lib/ui/ui.svelte';

	let { entity }: { entity: Entity } = $props();

	const light = $derived(comp<{ kind?: string; intensity?: number }>(entity, 'Light') ?? {});
	const pos = $derived(position(entity));
	const kind = $derived(light.kind ?? 'ambient');
	const intensity = $derived(light.intensity ?? 1);
</script>

{#if kind === 'directional'}
	<T.DirectionalLight
		position={pos}
		{intensity}
		castShadow={ui.scene.shadows}
		shadow.mapSize.width={1024}
		shadow.mapSize.height={1024}
	/>
{:else}
	<T.AmbientLight {intensity} />
{/if}
