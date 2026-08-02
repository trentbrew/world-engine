<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import type CameraControlsImpl from 'camera-controls';
	import { Color } from 'three';
	import Thing from '$lib/engine/render/Thing.svelte';
	import type { Entity } from '$lib/engine/ontology/schema';
	import { OBJECT_STAGE_KEY, type ObjectStageContext } from '$lib/scene/objectStage';
	import PreviewOrbitControls from '$lib/scene/PreviewOrbitControls.svelte';
	import { setContext } from 'svelte';

	interface Props {
		entity: Entity;
		onZoomPercent?: (percent: number) => void;
	}

	let { entity, onZoomPercent }: Props = $props();

	interactivity();
	const { invalidate } = useThrelte();

	let controls = $state<CameraControlsImpl | undefined>();
	let frameDistance = $state(5.5);

	setContext<ObjectStageContext>(OBJECT_STAGE_KEY, {
		atOrigin: true,
		previewPlaying: true,
		skipPhysics: true
	});

	$effect(() => {
		void entity.id;
		void entity.components;
		if (!controls) return;
		void controls.setLookAt(4.2, 2.6, 4.6, 0, 0.85, 0, false);
		frameDistance = controls.distance || 6.5;
		onZoomPercent?.(100);
		invalidate();
	});
</script>

<PreviewOrbitControls
	position={[4.2, 2.6, 4.6]}
	referenceDistance={frameDistance}
	onControls={(c) => (controls = c)}
	{onZoomPercent}
/>

<T.AmbientLight intensity={0.55} />
<T.DirectionalLight position={[4, 8, 3]} intensity={1.1} castShadow />

<T.Mesh rotation.x={-Math.PI / 2} position.y={0} receiveShadow>
	<T.CircleGeometry args={[5, 48]} />
	<T.MeshStandardMaterial color={new Color('#141414')} />
</T.Mesh>

<Thing {entity} />
