<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, LineSegments } from 'three';
	import { useRapier } from '@threlte/rapier';
	import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

	let { ref = $bindable(new LineSegments()) } = $props();

	const { world, debug } = useRapier();
	const enabled = $derived(viewportDebug.showColliders);

	const geometry = new BufferGeometry();
	let positionAttribute = new BufferAttribute(new Float32Array(0), 3);
	let colorAttribute = new BufferAttribute(new Float32Array(0), 4);
	geometry.setAttribute('position', positionAttribute);
	geometry.setAttribute('color', colorAttribute);

	$effect(() => {
		debug.set(enabled);
		return () => debug.set(false);
	});

	useTask(() => {
		if (!enabled) return;
		const { vertices, colors } = world.debugRender();

		if (positionAttribute.array.length === vertices.length) {
			positionAttribute.array.set(vertices);
			colorAttribute.array.set(colors);
			positionAttribute.needsUpdate = true;
			colorAttribute.needsUpdate = true;
		} else {
			geometry.dispose();
			positionAttribute = new BufferAttribute(vertices, 3);
			colorAttribute = new BufferAttribute(colors, 4);
			geometry.setAttribute('position', positionAttribute);
			geometry.setAttribute('color', colorAttribute);
		}
	});
</script>

<T is={LineSegments} bind:ref visible={enabled} frustumCulled={false} renderOrder={Infinity}>
	<T is={geometry} />
	<T.LineBasicMaterial vertexColors />
</T>
