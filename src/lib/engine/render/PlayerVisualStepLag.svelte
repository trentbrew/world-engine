<script lang="ts">
	import { useTask } from '@threlte/core';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { stepPlayerVisualStepLag } from '$lib/engine/player/playerVisualStepLag';
	import type { Group } from 'three';

	interface Props {
		entity: Entity;
		visualRoot: Group | undefined;
		playing: boolean;
	}

	let { entity, visualRoot, playing }: Props = $props();

	useTask((dt) => {
		if (!playing || !visualRoot) return;
		visualRoot.position.y = stepPlayerVisualStepLag(entity, dt);
	});
</script>
