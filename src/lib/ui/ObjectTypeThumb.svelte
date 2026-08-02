<script lang="ts">
	import { loadModelThumbnail, peekModelThumbnail } from '$lib/assets/modelThumbnail';
	import BoxIcon from '@lucide/svelte/icons/box';

	interface Props {
		/** Mesh/texture URL from the type's SkinnedMesh/Render/Sprite defaults (null → placeholder). */
		mesh: string | null;
	}

	let { mesh }: Props = $props();

	const isModel = $derived(!!mesh && /\.(glb|gltf)$/i.test(mesh));
	// Sprite textures are plain images — render them directly.
	const isImage = $derived(!!mesh && !isModel && !mesh.startsWith('primitive:'));

	let modelThumb = $state<string | null>(mesh && isModel ? peekModelThumbnail(mesh) : null);

	$effect(() => {
		if (!mesh || !isModel) {
			modelThumb = null;
			return;
		}
		const url = mesh;
		modelThumb = peekModelThumbnail(url);
		if (modelThumb) return;

		let cancelled = false;
		void loadModelThumbnail(url, 64).then((result) => {
			if (!cancelled && result) modelThumb = result;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if isImage}
	<img src={mesh} alt="" loading="lazy" decoding="async" />
{:else if modelThumb}
	<img src={modelThumb} alt="" />
{:else}
	<BoxIcon class="type-thumb-icon" aria-hidden="true" />
{/if}

<style>
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	:global(.type-thumb-icon) {
		width: 16px;
		height: 16px;
		opacity: 0.5;
		color: var(--muted-foreground);
	}
</style>
