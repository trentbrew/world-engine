<!-- Fork of @threlte/extras Grid — snap-to-cell follow + depth fixes for editor floor grid. -->
<script lang="ts">
	import { isInstanceOf, T, useTask, useThrelte, type Props } from '@threlte/core';
	import {
		BackSide,
		Color,
		Mesh,
		Plane,
		Uniform,
		Vector3,
		type ColorRepresentation,
		type ShaderMaterial,
		type Side
	} from 'three';
	import { fragmentShader, vertexShader } from '$lib/scene/gridShaders';
	import { ui } from '$lib/ui/ui.svelte';

	type EditorGridProps = Props<Mesh> & {
		cellSize?: number;
		sectionSize?: number;
		cellColor?: ColorRepresentation;
		sectionColor?: ColorRepresentation;
		backgroundColor?: ColorRepresentation;
		backgroundOpacity?: number;
		fadeDistance?: number;
		fadeStrength?: number;
		cellThickness?: number;
		sectionThickness?: number;
		plane?: 'xz' | 'xy' | 'zy';
		gridSize?: number | [number, number];
		followCamera?: boolean;
		infiniteGrid?: boolean;
		fadeOrigin?: Vector3 | [number, number, number];
		side?: Side;
	};

	let {
		cellSize = 1,
		sectionSize = 10,
		cellColor = '#000000',
		sectionColor = '#0000ee',
		backgroundColor = '#dadada',
		backgroundOpacity = 0,
		fadeDistance = 100,
		fadeStrength = 1,
		cellThickness = 1,
		sectionThickness = 2,
		plane = 'xz',
		gridSize = [2, 2],
		followCamera = false,
		infiniteGrid = false,
		fadeOrigin,
		side = BackSide,
		ref = $bindable(),
		...props
	}: EditorGridProps = $props();

	const mesh = new Mesh();
	const defaultRaycast = Mesh.prototype.raycast.bind(mesh);

	const { invalidate, camera } = useThrelte();

	const gridPlane = new Plane();
	const gridPlaneNormal = new Vector3(0, 1, 0);
	const zeroVector = new Vector3(0, 0, 0);

	const axisToInt = { x: 0, y: 1, z: 2 } as const;

	const planeConfig = {
		xz: { axes: 'xzy', normal: [0, 1, 0] },
		xy: { axes: 'xyz', normal: [0, 0, 1] },
		zy: { axes: 'zyx', normal: [1, 0, 0] }
	} as const;

	const uniforms = {
		cellSize: new Uniform(1),
		sectionSize: new Uniform(10),
		cellColor: new Uniform(new Color('#000000')),
		sectionColor: new Uniform(new Color('#0000ee')),
		backgroundColor: new Uniform(new Color('#dadada')),
		backgroundOpacity: new Uniform(0),
		fadeDistance: new Uniform(100),
		fadeStrength: new Uniform(1),
		fadeOrigin: new Uniform(new Vector3()),
		cellThickness: new Uniform(1),
		sectionThickness: new Uniform(2),
		infiniteGrid: new Uniform(false),
		followCamera: new Uniform(false),
		coord0: new Uniform(0),
		coord1: new Uniform(2),
		coord2: new Uniform(1),
		gridType: new Uniform<number>(0),
		lineGridCoord: new Uniform<number>(0),
		circleGridMaxRadius: new Uniform(0),
		polarCellDividers: new Uniform(6),
		polarSectionDividers: new Uniform(2),
		worldCamProjPosition: new Uniform(new Vector3()),
		worldPlanePosition: new Uniform(new Vector3())
	};

	function snapAxis(value: number, step: number): number {
		if (step <= 0) return value;
		return Math.floor(value / step) * step;
	}

	$effect.pre(() => {
		const { axes, normal } = planeConfig[plane];
		const c0 = axes.charAt(0) as 'x' | 'y' | 'z';
		const c1 = axes.charAt(1) as 'x' | 'y' | 'z';
		const c2 = axes.charAt(2) as 'x' | 'y' | 'z';
		uniforms.coord0.value = axisToInt[c0];
		uniforms.coord1.value = axisToInt[c1];
		uniforms.coord2.value = axisToInt[c2];
		gridPlaneNormal.set(normal[0], normal[1], normal[2]);
		invalidate();
	});

	$effect.pre(() => {
		uniforms.cellSize.value = cellSize;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.sectionSize.value = sectionSize;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.cellColor.value.set(cellColor);
		invalidate();
	});
	$effect.pre(() => {
		uniforms.sectionColor.value.set(sectionColor);
		invalidate();
	});
	$effect.pre(() => {
		uniforms.backgroundColor.value.set(backgroundColor);
		invalidate();
	});
	$effect.pre(() => {
		uniforms.backgroundOpacity.value = backgroundOpacity;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.fadeDistance.value = fadeDistance;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.fadeStrength.value = fadeStrength;
		invalidate();
	});
	$effect.pre(() => {
		if (fadeOrigin) {
			if (isInstanceOf(fadeOrigin, 'Vector3')) {
				uniforms.fadeOrigin.value.copy(fadeOrigin);
			} else {
				uniforms.fadeOrigin.value.fromArray(fadeOrigin);
			}
		}
		invalidate();
	});
	$effect.pre(() => {
		uniforms.cellThickness.value = cellThickness;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.sectionThickness.value = sectionThickness;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.followCamera.value = followCamera;
		invalidate();
	});
	$effect.pre(() => {
		uniforms.infiniteGrid.value = infiniteGrid;
		invalidate();
	});

	useTask(
		() => {
			gridPlane
				.setFromNormalAndCoplanarPoint(gridPlaneNormal, zeroVector)
				.applyMatrix4(mesh.matrixWorld);

			const material = mesh.material as ShaderMaterial;
			const worldCamProjPosition = material.uniforms.worldCamProjPosition as Uniform<Vector3>;
			const worldPlanePosition = material.uniforms.worldPlanePosition as Uniform<Vector3>;
			const uFadeOrigin = material.uniforms.fadeOrigin as Uniform<Vector3>;

			gridPlane.projectPoint(camera.current.position, worldCamProjPosition.value);

			if (followCamera) {
				worldCamProjPosition.value.x = snapAxis(worldCamProjPosition.value.x, cellSize);
				worldCamProjPosition.value.z = snapAxis(worldCamProjPosition.value.z, cellSize);
				worldPlanePosition.value.set(0, 0, 0).applyMatrix4(mesh.matrixWorld);
			}

			if (!fadeOrigin) {
				uFadeOrigin.value.copy(worldCamProjPosition.value);
			}

			if (followCamera) {
				invalidate();
			}
		},
		{ autoInvalidate: false, running: () => followCamera || !fadeOrigin }
	);
	$effect(() => {
		mesh.raycast = ui.placementDraft ? () => {} : defaultRaycast;
	});
</script>

<T is={mesh} bind:ref frustumCulled={false} {...props}>
	<T.ShaderMaterial
		{fragmentShader}
		{vertexShader}
		{uniforms}
		transparent
		depthWrite={false}
		{side}
	/>
	<T.PlaneGeometry args={typeof gridSize === 'number' ? [gridSize, gridSize] : gridSize} />
</T>
