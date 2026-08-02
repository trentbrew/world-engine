<script lang="ts">
	/** One SparkRenderer per Threlte scene — required for World Labs .spz backdrops. */
	import { useThrelte } from '@threlte/core';
	import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
	import { installSparkRendererGuards } from '$lib/scene/sparkRendererLifecycle';

	const { renderer, scene, invalidate } = useThrelte();

	$effect(() => {
		const gl = renderer;
		const sc = scene;
		if (!gl || !sc) return;

		const spark = new SparkRenderer({
			renderer: gl,
			autoUpdate: false,
			onDirty: () => invalidate()
		});
		const releaseGuards = installSparkRendererGuards(spark);
		sc.add(spark);

		let cancelled = false;
		let watchRaf = 0;

		const enableAutoUpdate = () => {
			if (cancelled) return;
			const s = spark as SparkRenderer & { autoUpdate: boolean };
			if (s.autoUpdate) return;
			s.autoUpdate = true;
			invalidate();
		};

		const watchForSplats = () => {
			if (cancelled) return;
			let hasSplatMesh = false;
			sc.traverse((node) => {
				if (node instanceof SplatMesh) hasSplatMesh = true;
			});
			if (hasSplatMesh) {
				enableAutoUpdate();
				return;
			}
			watchRaf = requestAnimationFrame(watchForSplats);
		};
		watchRaf = requestAnimationFrame(watchForSplats);

		return () => {
			cancelled = true;
			cancelAnimationFrame(watchRaf);
			releaseGuards();
			sc.remove(spark);
			try {
				spark.dispose?.();
			} catch {
				// Worker may already be terminated during HMR / rapid scene teardown.
			}
		};
	});
</script>
