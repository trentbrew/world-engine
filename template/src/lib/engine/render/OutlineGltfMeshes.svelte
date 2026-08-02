<script lang="ts">
	import { Mesh, type Object3D } from 'three';
	import { outlineRegistry } from '$lib/engine/render/outlineRegistry.svelte';

	let { entityId, root }: { entityId: string; root: Object3D } = $props();

	$effect(() => {
		if (!root) return;
		const meshes: Mesh[] = [];
		root.traverse((child) => {
			if (child instanceof Mesh) meshes.push(child);
		});
		const unsubs = meshes.map((mesh) => outlineRegistry.register(entityId, mesh));
		return () => {
			for (const unsub of unsubs) unsub();
		};
	});
</script>
