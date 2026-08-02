<script lang="ts">
	/**
	 * Photoscanned Gaussian splat set-piece.
	 * - `.spz` (World Labs Marble halls) → @sparkjsdev/spark SplatMesh + SparkRendererHost
	 * - `.splat` (legacy nike demo) → @pmndrs/vanilla SplatLoader
	 *
	 * Spark meshes are soft-cached by URL so decade swaps reuse decoded SPZs.
	 */
	import { useThrelte } from '@threlte/core';
	import { T } from '@threlte/core';
	import { Splat, SplatLoader } from '@pmndrs/vanilla';
	import type { SplatMesh } from '@sparkjsdev/spark';
	import type { Group, Object3D } from 'three';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { comp, position, rotationQuat, scaleVec } from '$lib/engine/render/access';
	import {
		acquireSplatMesh,
		prefetchSplatMeshes
	} from '$lib/engine/render/splatMeshCache';
	import { splatReady } from '$lib/engine/render/splatReady.svelte';

	let { entity }: { entity: Entity } = $props();

	type Cfg = {
		src?: string;
		alphaTest?: number;
		toneMapped?: boolean;
		metricScale?: number;
		prefetch?: unknown;
	};
	const cfg = $derived(comp<Cfg>(entity, 'GaussianSplat') ?? {});
	const src = $derived(cfg.src ?? '/splats/nike.splat');
	const alphaTest = $derived(cfg.alphaTest ?? 0.1);
	const toneMapped = $derived(cfg.toneMapped ?? true);
	const metricScale = $derived(Number(cfg.metricScale ?? 1));
	const useSpark = $derived(src.toLowerCase().endsWith('.spz'));
	const prefetchUrls = $derived.by((): string[] => {
		const raw = cfg.prefetch;
		if (!Array.isArray(raw)) return [];
		return raw.filter((u): u is string => typeof u === 'string' && u.length > 0);
	});

	const pos = $derived(position(entity));
	const rot = $derived(rotationQuat(entity));
	const scale = $derived.by((): [number, number, number] => {
		const s = scaleVec(entity);
		return [s[0] * metricScale, s[1] * metricScale, s[2] * metricScale];
	});

	const { renderer, camera, invalidate } = useThrelte();

	let splatRoot = $state<Group | undefined>(undefined);
	let vanillaSplat = $state<Splat | undefined>(undefined);
	let sparkSplat = $state<SplatMesh | undefined>(undefined);

	// Spark path — World Labs `.spz` halls (soft-cached by URL).
	$effect(() => {
		if (!useSpark) return;
		const url = src;
		if (!url) return;

		let cancelled = false;
		let active: SplatMesh | undefined;
		void acquireSplatMesh(url, () => invalidate())
			.then((mesh) => {
				if (cancelled) return;
				active = mesh;
				sparkSplat = mesh;
				splatReady.markReady();
				invalidate();
				const siblings = prefetchUrls.filter((u) => u !== url);
				prefetchSplatMeshes(siblings, () => invalidate());
			})
			.catch((err) => {
				console.warn('[GaussianSplat] failed to load SPZ', url, err);
				// Unblock Render.deferUntilSplat props even if the hall fails.
				if (!cancelled) splatReady.markReady();
			});

		return () => {
			cancelled = true;
			// Detach only — keep mesh in cache for era swap / remount.
			if (active?.parent) active.parent.remove(active);
			if (sparkSplat === active) sparkSplat = undefined;
		};
	});

	// Vanilla path — self-hosted `.splat` assets.
	$effect(() => {
		if (useSpark) return;
		const gl = renderer;
		const cam = camera.current;
		const url = src;
		if (!gl || !cam || !url) return;

		let cancelled = false;
		let splat: Splat | undefined;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let shared: any;
		const loader = new SplatLoader(gl);
		loader
			.loadAsync(url)
			.then((s) => {
				if (cancelled) return;
				shared = s;
				splat = new Splat(s, cam, { alphaTest, toneMapped });
				vanillaSplat = splat;
				splatReady.markReady();
				invalidate();
			})
			.catch((err) => console.warn('[GaussianSplat] failed to load splat', url, err));

		return () => {
			cancelled = true;
			if (splat) {
				splat.parent?.remove(splat);
				splat.geometry?.dispose?.();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(splat.material as any)?.dispose?.();
			}
			shared?.worker?.terminate?.();
			if (vanillaSplat === splat) vanillaSplat = undefined;
		};
	});

	$effect(() => {
		const root = splatRoot;
		const loaded = useSpark ? sparkSplat : vanillaSplat;
		if (!root || !loaded) return;
		const object = loaded as Object3D;
		if (object.parent && object.parent !== root) {
			object.parent.remove(object);
		}
		if (object.parent !== root) {
			root.add(object);
			invalidate();
		}
	});

	$effect(() => {
		if (!splatRoot) return;
		splatRoot.position.set(pos[0], pos[1], pos[2]);
		splatRoot.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
		splatRoot.scale.set(scale[0], scale[1], scale[2]);
		invalidate();
	});
</script>

<T.Group bind:ref={splatRoot} />
