<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Float32BufferAttribute, type Line } from 'three';
	import {
		overlayBorderGeometry,
		overlayGroupRotation,
		placementHighlightPosition
	} from '$lib/scene/playPlane';
	import { readAccentEntityColor } from '$lib/scene/placementAccent';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const visible = $derived(
		ui.chrome.grid && ui.placementTracking && ui.placementPosition !== null
	);
	const cellSize = $derived(ui.grid.cellSize);
	const playPlane = $derived(worldProfile.profile.plane);
	const placement = $derived<[number, number, number]>(ui.placementPosition ?? [0, 0, 0]);
	const groupPosition = $derived(placementHighlightPosition(playPlane, placement));
	const groupRotation = $derived(overlayGroupRotation(playPlane));

	let accentColor = $state(readAccentEntityColor());

	$effect(() => {
		if (!visible) return;
		accentColor = readAccentEntityColor();
	});

	function borderGeometry(size: number) {
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			'position',
			new Float32BufferAttribute(overlayBorderGeometry(size, playPlane), 3)
		);
		return geometry;
	}

	function onBorderLineCreate(line: Line) {
		line.computeLineDistances();
	}
</script>

{#if visible}
	<T.Group position={groupPosition} renderOrder={3}>
		<T.Group rotation={groupRotation}>
			<T.Mesh>
				<T.PlaneGeometry args={[cellSize, cellSize]} />
				<T.MeshBasicMaterial
					color={accentColor}
					transparent
					opacity={0.2}
					depthTest={false}
					depthWrite={false}
				/>
			</T.Mesh>
		</T.Group>
		<T.Line geometry={borderGeometry(cellSize)} oncreate={onBorderLineCreate}>
			<T.LineDashedMaterial
				color={accentColor}
				dashSize={0.12}
				gapSize={0.08}
				transparent
				opacity={0.85}
				depthTest={false}
				depthWrite={false}
			/>
		</T.Line>
	</T.Group>
{/if}
