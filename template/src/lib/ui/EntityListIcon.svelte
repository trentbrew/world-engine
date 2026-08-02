<script lang="ts">
	import { loadModelThumbnail, peekModelThumbnail } from '$lib/assets/modelThumbnail';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp } from '$lib/engine/render/access';
	import { isGltfMesh, resolveMeshUrl } from '$lib/engine/render/meshRef';

	interface Props {
		entity: Entity;
		dotClass: string;
		dotStyle?: string;
	}

	let { entity, dotClass, dotStyle }: Props = $props();

	const render = $derived(comp<{ mesh?: string; color?: string }>(entity, 'Render'));
	const mesh = $derived(render?.mesh);
	const meshUrl = $derived(mesh && isGltfMesh(mesh) ? resolveMeshUrl(mesh) : null);

	let thumb = $state<string | null>(null);

	$effect(() => {
		const url = meshUrl;
		if (!url) {
			thumb = null;
			return;
		}

		thumb = peekModelThumbnail(url);
		if (thumb) return;

		let cancelled = false;
		void loadModelThumbnail(url, 32).then((result) => {
			if (!cancelled && result) thumb = result;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if thumb}
	<span class="entity-thumb" aria-hidden="true">
		<img src={thumb} alt="" />
	</span>
{:else}
	<span class="type-dot {dotClass}" style={dotStyle} aria-hidden="true"></span>
{/if}

<style>
	.entity-thumb {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		overflow: hidden;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--secondary) 40%, transparent);
	}

	.entity-thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.type-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.type-dot.player {
		background: var(--accent-entity);
	}

	.type-dot.ground {
		background: var(--accent-selection);
	}

	.type-dot.prop {
		background: var(--accent-entity);
	}

	.type-dot.spawn {
		background: var(--accent-spawn);
	}

	.type-dot.peer {
		background: var(--accent-entity);
	}
</style>
