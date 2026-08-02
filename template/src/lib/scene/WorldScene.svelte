<script lang="ts">
	import { tick } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { CameraControls, Gizmo, interactivity, Sky, Suspense } from '@threlte/extras';
	import EditorGrid from '$lib/scene/EditorGrid.svelte';
	import GridCellHighlight from '$lib/scene/GridCellHighlight.svelte';
	import SelectionFootprints from '$lib/scene/SelectionFootprints.svelte';
	import PlacementGhost from '$lib/scene/PlacementGhost.svelte';
	import { SKY_PRESETS } from '$lib/scene/skyPresets';
	import { TONE_MAPPING } from '$lib/scene/toneMapping';
	import type CameraControlsImpl from 'camera-controls';
	import type { IntersectionEvent } from '@threlte/extras';
	import type { PerspectiveCamera, OrthographicCamera } from 'three';
	import { Group, Vector3 } from 'three';
	import Thing from '$lib/engine/render/Thing.svelte';
	import PhysicsWorld from '$lib/scene/PhysicsWorld.svelte';
	import SparkRendererHost from '$lib/scene/SparkRendererHost.svelte';
	import PeerSelectionLabelProjector from '$lib/scene/PeerSelectionLabelProjector.svelte';
	import RoomPortalPromptProjector from '$lib/scene/RoomPortalPromptProjector.svelte';
	import PlayerSpawnRings from '$lib/scene/PlayerSpawnRings.svelte';
	import ViewportComposer from '$lib/scene/ViewportComposer.svelte';
	import {
		applyOrthographicZoom,
		isOrthographicCamera,
		normalizeOrthoZoom,
		ORTHO_DOLLY_SPEED_MULT,
		orthoZoomForPerspectiveFraming,
		syncOrthographicFrustum
	} from '$lib/scene/orthographicCamera';
	import { RESET_ORTHO_ZOOM, viewportFocus } from '$lib/scene/focusEntity';
	import { viewportCamera } from '$lib/engine/render/viewportCamera.svelte';
	import { bindViewportNavigation } from '$lib/scene/viewportNavigation';
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import { OUTLINE_COMPOSER_TASK } from '$lib/scene/viewportRenderTasks';
	import { deferViewportPick } from '$lib/scene/viewportPick';
	import {
		onPlacementPointerDown,
		onPlacementPointerMove,
		onPlacementPointerUp
	} from '$lib/scene/placementSession';
	import OriginAxes from '$lib/scene/OriginAxes.svelte';
	import {
		clearPlacementRaycast,
		registerPlacementRaycast
	} from '$lib/scene/placementRaycast';
	import {
		edit2dCameraControlPrefs,
		editorGridPlane,
		editorGridPosition,
		playPlaneBackdropPosition,
		playPlaneMeshRotation,
		restoreOrthographicViewport,
		seed2dEditorCamera,
		seedOrthographicViewport
	} from '$lib/scene/playPlane';
	import { registerPlayEditCameraBridge } from '$lib/scene/playEditCamera';
	import CameraControlsLib from 'camera-controls';
	import { BACKDROP_POLYGON_OFFSET } from '$lib/scene/backdropDepth';
	import { useFollow } from '$lib/engine/camera/useFollow.svelte';
	import { playCamera } from '$lib/engine/camera/playCamera.svelte';
	import { gamepadLookAxis } from '$lib/engine/player/gamepad.svelte';
	import { playInputState } from '$lib/engine/player/playInputState.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { camera, DEG2RAD } from '$lib/engine/render/camera.svelte';
	import { sceneLoading } from '$lib/ui/sceneLoading.svelte';
	import {
		peekOrbitRestore,
		registerOrbitCapture,
		saveOrbit
	} from '$lib/engine/dev/editorSession';
	import { applyCamera2DFollow, createCamera2DState, resetCamera2DState } from '$lib/engine/camera/camera2D';
	import { camera2D } from '$lib/engine/camera/camera2D.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { WORLD_PROFILE_ENTITY_ID } from '$lib/engine/world/worldConstants';
	import { ui } from '$lib/ui/ui.svelte';
	import type { ViewportGizmo } from 'three-viewport-gizmo';

	interactivity();

	const { renderer, invalidate, renderStage, camera: threlteCamera, size, scene, autoRender, dom } =
		useThrelte();

	let perspectiveCam = $state<PerspectiveCamera>();
	let orthoCam = $state<OrthographicCamera>();
	let controls = $state<CameraControlsImpl | undefined>();

	const childIds = $derived(new Set(world.entities.flatMap((e) => e.children ?? [])));
	const roots = $derived(world.entities.filter((e) => !childIds.has(e.id)));
	/** Spark only when this world has a Gaussian splat — avoids perpetual watch RAF elsewhere. */
	const hasGaussianSplat = $derived(world.query('GaussianSplat').length > 0);

	const isOrtho = $derived(camera.projection === 'orthographic');
	const activeCam = $derived(isOrtho ? orthoCam : perspectiveCam);
	const use2dEdit = $derived(worldProfile.is2d && ui.shellMode === 'edit');
	const use2dPlay = $derived(worldProfile.is2d && ui.shellMode === 'play');
	const useOrbitControls = $derived(camera.mode === 'orbit');
	/** Follow rig only runs in play — edit mode always keeps orbit controls. */
	const useFollowCam = $derived(
		camera.mode === 'follow' && ui.shellMode === 'play' && !use2dPlay
	);
	const playPlane = $derived(worldProfile.profile.plane);
	const showGizmo = $derived(ui.shellMode === 'edit');
	const gizmoOffset = $derived(ui.viewportGizmoOffset);
	let viewportGizmo = $state<ViewportGizmo | undefined>();

	$effect(() => {
		const g = viewportGizmo;
		if (!g) return;
		const offset = ui.viewportGizmoOffset;
		const el = dom.querySelector<HTMLElement>('.viewport-gizmo');
		if (el) {
			el.style.margin = `${offset.top}px ${offset.right}px ${offset.bottom}px ${offset.left}px`;
		}
		g.domUpdate();
		invalidate();
	});
	const showEditorGrid = $derived(
		ui.shellMode === 'edit' && ui.chrome.grid && (!worldProfile.is2d || playPlane === 'xz')
	);
	const show2dPlaneGrid = $derived(worldProfile.is2d && ui.shellMode === 'edit' && ui.chrome.grid);
	const skyProps = $derived(SKY_PRESETS[ui.scene.sky.preset]);
	const cfg = $derived(
		use2dEdit ? edit2dCameraControlPrefs(camera.controls) : camera.controls
	);
	const polarRotateSpeed = $derived((cfg.invertY ? -1 : 1) * cfg.rotateSpeed);
	const followCfg = $derived(playInputState.config.followCamera);
	const usePlayCameraControls = $derived(
		(useOrbitControls || useFollowCam) && ui.shellMode === 'play' && !use2dPlay
	);
	const useEditOrbitControls = $derived(ui.shellMode === 'edit');
	const useViewportNavigation = $derived(
		useEditOrbitControls || (useOrbitControls && ui.shellMode === 'play')
	);

	const playerFollowTarget = new Group();
	const orbitPos = new Vector3();
	const orbitTarget = new Vector3();
	const camera2dState = createCamera2DState();
	let orbitRestored = false;

	const backdropRotation = $derived(playPlaneMeshRotation(playPlane));
	const backdropPosition = $derived(playPlaneBackdropPosition(playPlane));
	const editorGridPos = $derived(editorGridPosition(playPlane));

	const camera2dConfig = $derived.by(() => {
		const entity = world.getEntity(WORLD_PROFILE_ENTITY_ID);
		const cam2d = entity?.components.Camera2D as
			| {
					deadZoneX?: number;
					deadZoneY?: number;
					lookAhead?: number;
					zoom?: number;
			  }
			| undefined;
		return {
			...camera2D.config,
			deadZoneX: cam2d?.deadZoneX ?? camera2D.config.deadZoneX,
			deadZoneY: cam2d?.deadZoneY ?? camera2D.config.deadZoneY,
			lookAhead: cam2d?.lookAhead ?? camera2D.config.lookAhead,
			zoom: cam2d?.zoom ?? camera2D.config.zoom
		};
	});

	/** Primitive zoom — avoids re-seeding the 2D editor camera on unrelated entity edits. */
	const editor2dSeedZoom = $derived.by(() => {
		const cam2d = world.getEntity(WORLD_PROFILE_ENTITY_ID)?.components.Camera2D as
			| { zoom?: number }
			| undefined;
		return cam2d?.zoom ?? camera2D.config.zoom;
	});

	let editor2dSeedSignature = '';

	function apply2dPlayCamera() {
		if (!use2dPlay) return false;

		const cam = threlteCamera.current;
		if (!cam) return false;

		const id = world.localPlayerId;
		const entity = id ? world.getEntity(id) : undefined;
		const pos = (entity?.components.Transform as { position?: [number, number, number] })
			?.position;

		const applied = applyCamera2DFollow(
			cam,
			pos,
			worldProfile.profile,
			camera2dConfig,
			camera2dState,
			size.current
		);
		if (applied) invalidate();
		return applied;
	}

	function resolveOrthoZoom(distance?: number): number {
		if (worldProfile.is2d) return normalizeOrthoZoom(editor2dSeedZoom, size.current.height);
		if (distance !== undefined && distance > 0.01) {
			return orthoZoomForPerspectiveFraming(distance, size.current.height, camera.fov);
		}
		return RESET_ORTHO_ZOOM;
	}

	/** CameraControls keeps `_zoom` from the perspective camera (usually 1) across swaps. */
	function ensureOrthoZoom(zoom: number) {
		if (!orthoCam) return;
		const { width, height } = size.current;
		syncOrthographicFrustum(orthoCam, width, height);
		applyOrthographicZoom(orthoCam, zoom, controls ?? null);
	}

	function activateOrthographicViewport() {
		if (!orthoCam) return;
		const cam = orthoCam;

		const ctrl = controls;
		if (ctrl) {
			ctrl.getPosition(orbitPos);
			ctrl.getTarget(orbitTarget);
		}
		const distance = ctrl ? orbitPos.distanceTo(orbitTarget) : undefined;
		const zoom = resolveOrthoZoom(distance);

		const syncPoseAndZoom = () => {
			if (ctrl) {
				cam.position.copy(orbitPos);
				cam.lookAt(orbitTarget);
				cam.updateMatrixWorld();
			}
			ensureOrthoZoom(zoom);
			if (ctrl) {
				// Always push pose + zoom into CameraControls — it may still be
				// holding the perspective camera for a tick; zoomTo is projection-agnostic.
				ctrl.setLookAt(
					orbitPos.x,
					orbitPos.y,
					orbitPos.z,
					orbitTarget.x,
					orbitTarget.y,
					orbitTarget.z,
					false
				);
				ctrl.update(0);
			}
		};

		// Pose may already be restored from a perspective session — still must set zoom
		// and re-bind the orbit pose onto the ortho camera / controls.
		if (orbitRestored) {
			syncPoseAndZoom();
			invalidate();
			return;
		}

		const saved = peekOrbitRestore();
		if (saved) {
			restoreOrthographicViewport(cam, controls ?? null, {
				...saved,
				zoom: saved.zoom ?? zoom
			});
			orbitRestored = true;
			invalidate();
			return;
		}

		const { width, height } = size.current;
		seedOrthographicViewport(cam, width, height, null, {
			is2d: worldProfile.is2d,
			plane: playPlane,
			zoom
		});

		if (
			!Number.isFinite(cam.position.x + cam.position.y + cam.position.z + cam.zoom)
		) {
			return;
		}

		syncPoseAndZoom();
	}

	function seedFollowCamera(ctrl: CameraControlsImpl) {
		const fc = playInputState.config.followCamera;
		ctrl.smoothTime = fc.smoothTime;
		ctrl.minDistance = fc.minDistance;
		ctrl.maxDistance = fc.maxDistance;
		ctrl.minPolarAngle = fc.minPolarAngle;
		ctrl.maxPolarAngle = fc.maxPolarAngle;
		if (fc.azimuthLocked) {
			ctrl.minAzimuthAngle = fc.azimuthAngle;
			ctrl.maxAzimuthAngle = fc.azimuthAngle;
		} else {
			ctrl.minAzimuthAngle = Number.NEGATIVE_INFINITY;
			ctrl.maxAzimuthAngle = Number.POSITIVE_INFINITY;
		}
		ctrl.polarAngle = fc.polarAngle;
		if (fc.azimuthLocked) ctrl.azimuthAngle = fc.azimuthAngle;
		void ctrl.dollyTo(fc.distance, false);
		// Dolly only changes spherical radius; ortho framing is zoom.
		if (camera.projection === 'orthographic' && orthoCam) {
			ensureOrthoZoom(resolveOrthoZoom(fc.distance));
		}
		ctrl.update(0);
	}

	function syncPlayerFollowTarget() {
		const id = world.localPlayerId;
		const entity = id ? world.getEntity(id) : undefined;
		const transform = entity?.components.Transform as
			| { position?: [number, number, number]; rotation?: [number, number, number, number] }
			| undefined;
		if (!transform?.position) return;

		playerFollowTarget.position.set(
			transform.position[0],
			transform.position[1],
			transform.position[2]
		);
		const rot = transform.rotation;
		if (rot) {
			playerFollowTarget.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
		} else {
			playerFollowTarget.quaternion.set(0, 0, 0, 1);
		}
	}

	useFollow(() => {
		if (!useFollowCam || ui.shellMode !== 'play') {
			return { target: undefined, controls: undefined };
		}
		return {
			target: playerFollowTarget,
			controls: controls ?? null,
			lookAtOffset: followCfg.lookAtOffset,
			deadZone: followCfg.deadZone,
			lookAhead: followCfg.lookAhead,
			lookAheadSmoothTime: followCfg.lookAheadSmoothTime,
			followSmoothTime: followCfg.followSmoothTime,
			trackRotation: followCfg.trackRotation,
			trackRotationSmoothTime: followCfg.trackRotationSmoothTime,
			trackRotationOffset: followCfg.trackRotationOffset,
			prepareTarget: syncPlayerFollowTarget
		};
	});

	$effect(() => {
		playCamera.configure({
			controls: controls ?? null,
			active: usePlayCameraControls,
			trackRotation: useFollowCam && followCfg.trackRotation
		});
	});

	// Right stick orbits the play camera (follow + orbit play modes).
	useTask(
		(delta) => {
			if (!usePlayCameraControls || !controls?.enabled) return;

			const look = gamepadLookAxis();
			if (look.x === 0 && look.y === 0) return;

			const invertY = cfg.invertY ? -1 : 1;
			const speed = 2.8 * cfg.rotateSpeed;
			playCamera.applyLookDelta(look.x * speed * delta, -look.y * invertY * speed * delta);
			invalidate();
		},
		{
			autoInvalidate: false,
			running: () => usePlayCameraControls && ui.shellMode === 'play'
		}
	);

	// Threlte uses on-demand rendering; play mode must keep the render stage alive.
	useTask(
		() => {
			if (!useFollowCam) return;
			invalidate();
		},
		{
			stage: renderStage,
			autoInvalidate: true,
			running: () => ui.shellMode === 'play' && useFollowCam
		}
	);

	// 2D play follow rig (CameraControls disabled).
	useTask(
		() => {
			if (!use2dPlay) return;
			if (controls) controls.enabled = false;
			apply2dPlayCamera();
		},
		{
			stage: renderStage,
			autoInvalidate: true,
			running: () => use2dPlay
		}
	);

	// Follow mode uses CameraControls + useFollow; snapshot orbit on entry and restore on exit.
	let wasFollowing = false;
	let followSeedKey = '';
	$effect(() => {
		if (!controls) return;
		const nextSeed = useFollowCam
			? [
					followCfg.preset,
					followCfg.smoothTime,
					followCfg.distance,
					followCfg.minDistance,
					followCfg.maxDistance,
					followCfg.minPolarAngle,
					followCfg.maxPolarAngle,
					followCfg.polarAngle,
					followCfg.azimuthLocked,
					followCfg.azimuthAngle
				].join(':')
			: '';
		if (useFollowCam && !wasFollowing) {
			controls.saveState();
			seedFollowCamera(controls);
			followSeedKey = nextSeed;
			invalidate();
		} else if (!useFollowCam && wasFollowing) {
			void controls.reset(false);
			followSeedKey = '';
			invalidate();
		} else if (useFollowCam && nextSeed !== followSeedKey) {
			seedFollowCamera(controls);
			followSeedKey = nextSeed;
			invalidate();
		}
		wasFollowing = useFollowCam;
		if (!worldProfile.is2d || ui.shellMode !== 'play') {
			controls.enabled = useEditOrbitControls || usePlayCameraControls;
		}
	});

	$effect(() => {
		if (ui.shellMode !== 'play') return;
		if (use2dPlay) {
			if (controls) controls.enabled = false;
			apply2dPlayCamera();
		}
		invalidate();
	});

	$effect(() => {
		if (!controls || !use2dEdit) return;

		const activeControls = controls;
		const savedLeft = controls.mouseButtons.left;
		const savedRight = controls.mouseButtons.right;
		controls.mouseButtons.left = CameraControlsLib.ACTION.TRUCK;
		controls.mouseButtons.right = CameraControlsLib.ACTION.TRUCK;

		return () => {
			activeControls.mouseButtons.left = savedLeft;
			activeControls.mouseButtons.right = savedRight;
		};
	});

	$effect(() => {
		if (!use2dEdit || isOrtho || !controls) {
			if (!use2dEdit) editor2dSeedSignature = '';
			return;
		}
		if (orbitRestored || peekOrbitRestore()) return;
		const signature = `${playPlane}:${editor2dSeedZoom}`;
		if (signature === editor2dSeedSignature) return;
		editor2dSeedSignature = signature;
		seed2dEditorCamera(controls, playPlane, editor2dSeedZoom);
		invalidate();
	});

	$effect(() => {
		const activeControls = useViewportNavigation ? (controls ?? null) : null;
		viewportFocus.bind(activeControls);
		viewportCamera.bind(activeControls);
		return () => {
			viewportFocus.bind(null);
			viewportCamera.bind(null);
		};
	});

	useTask(
		() => {
			if (!useViewportNavigation || !controls) return;
			viewportCamera.sync();
		},
		{ stage: renderStage, autoInvalidate: false }
	);

	let orthoSessionActive = false;
	$effect(() => {
		if (camera.projection !== 'orthographic' || !orthoCam) {
			orthoSessionActive = false;
			return;
		}
		if (orthoSessionActive) return;
		orthoSessionActive = true;
		void tick().then(async () => {
			if (camera.projection !== 'orthographic' || !orthoCam) return;
			activateOrthographicViewport();
			// CameraControls may still hold the perspective camera for one more tick.
			if (controls && !isOrthographicCamera(controls.camera)) {
				await tick();
				if (camera.projection !== 'orthographic' || !orthoCam) return;
				const distance = controls
					? (() => {
							controls.getPosition(orbitPos);
							controls.getTarget(orbitTarget);
							return orbitPos.distanceTo(orbitTarget);
						})()
					: undefined;
				ensureOrthoZoom(resolveOrthoZoom(distance));
			}
			invalidate();
		});
	});

	$effect(() => {
		if (!isOrtho || !orthoCam) return;
		const { width, height } = size.current;
		syncOrthographicFrustum(orthoCam, width, height);
		orthoCam.updateProjectionMatrix();
		invalidate();
	});

	$effect.pre(() => {
		// Composer owns perspective rendering; ortho uses the explicit task below.
		if (isOrtho) autoRender.set(false);
	});

	// Orthographic: explicit render — composer disables autoRender for outline passes.
	useTask(
		() => {
			if (!isOrtho) return;
			const cam = orthoCam ?? threlteCamera.current;
			if (!isOrthographicCamera(cam)) return;
			const px = cam.position.x + cam.position.y + cam.position.z;
			if (!Number.isFinite(px + cam.zoom)) return;
			cam.updateMatrixWorld();
			cam.updateProjectionMatrix();
			renderer.render(scene, cam);
		},
		{
			stage: renderStage,
			after: OUTLINE_COMPOSER_TASK,
			autoInvalidate: true
		}
	);

	$effect(() => {
		camera.projection;
		invalidate();
	});

	$effect(() => {
		if (!controls || !useViewportNavigation) return;

		const scheme = inputPrefs.navigationScheme;

		return bindViewportNavigation({
			controls,
			dom: renderer.domElement,
			isOrtho,
			scheme,
			enabled: () => useViewportNavigation && (controls?.enabled ?? false)
		});
	});

	$effect(() => {
		registerPlacementRaycast(threlteCamera.current, renderer.domElement);
		return () => clearPlacementRaycast();
	});

	$effect(() => {
		const style = ui.scene.style;
		renderer.toneMapping = TONE_MAPPING[style.toneMapping];
		const skyExposure = ui.scene.sky.enabled ? skyProps.exposure : 1;
		renderer.toneMappingExposure = style.exposure * skyExposure;
		invalidate();
	});

	$effect(() => {
		const cmd = camera.viewCommand;
		if (!cmd || !controls) return;

		if (cmd.kind === 'reset') {
			viewportFocus.reset();
			invalidate();
			return;
		}

		if (cmd.kind === 'focus' && world.selectedEntity) {
			viewportFocus.focus(world.selectedEntity);
			invalidate();
		}
	});

	function captureOrbitSnapshot() {
		if (controls) {
			controls.getPosition(orbitPos);
			controls.getTarget(orbitTarget);
			const snap = {
				position: [orbitPos.x, orbitPos.y, orbitPos.z] as [number, number, number],
				target: [orbitTarget.x, orbitTarget.y, orbitTarget.z] as [number, number, number]
			};
			if (isOrthographicCamera(controls.camera)) {
				return { ...snap, zoom: controls.camera.zoom };
			}
			return snap;
		}

		const cam = threlteCamera.current;
		if (!cam) return null;

		cam.getWorldDirection(orbitPos);
		orbitTarget.copy(cam.position).add(orbitPos);
		const snap = {
			position: [cam.position.x, cam.position.y, cam.position.z] as [number, number, number],
			target: [orbitTarget.x, orbitTarget.y, orbitTarget.z] as [number, number, number]
		};
		if (isOrthographicCamera(cam)) {
			return { ...snap, zoom: cam.zoom };
		}
		return snap;
	}

	function restoreOrbitSnapshot(snap: {
		position: [number, number, number];
		target: [number, number, number];
		zoom?: number;
	}) {
		if (isOrtho && orthoCam) {
			restoreOrthographicViewport(orthoCam, controls ?? null, snap);
		} else if (controls) {
			controls.setLookAt(
				snap.position[0],
				snap.position[1],
				snap.position[2],
				snap.target[0],
				snap.target[1],
				snap.target[2],
				false
			);
			if (snap.zoom !== undefined && isOrthographicCamera(controls.camera)) {
				controls.zoomTo(snap.zoom, false);
			}
			controls.update(0);
		}
		invalidate();
	}

	function restoreOrbitFromSession() {
		if (!controls || orbitRestored || !useOrbitControls) return;
		const snap = peekOrbitRestore();
		if (!snap) return;
		restoreOrbitSnapshot(snap);
		orbitRestored = true;
	}

	$effect(() => {
		registerPlayEditCameraBridge({
			capture: captureOrbitSnapshot,
			restore: restoreOrbitSnapshot,
			resetPlayRig: () => resetCamera2DState(camera2dState)
		});
		return () => registerPlayEditCameraBridge(null);
	});

	$effect(() => {
		if (!controls || !useOrbitControls) {
			registerOrbitCapture(null);
			return;
		}

		registerOrbitCapture(captureOrbitSnapshot);
		if (!orbitRestored) {
			restoreOrbitFromSession();
		} else {
			const saved = peekOrbitRestore();
			if (saved) restoreOrbitSnapshot(saved);
		}

		const onControlEnd = () => {
			if (ui.shellMode !== 'edit') return;
			saveOrbit(captureOrbitSnapshot());
		};
		controls.addEventListener('controlend', onControlEnd);
		const activeControls = controls;

		return () => {
			activeControls.removeEventListener('controlend', onControlEnd);
			registerOrbitCapture(null);
		};
	});
</script>

{#snippet orbitControls()}
	{#if (useEditOrbitControls || usePlayCameraControls) && activeCam}
		<CameraControls
			bind:ref={controls}
			camera={activeCam}
			minDistance={useFollowCam ? followCfg.minDistance : cfg.minDistance}
			maxDistance={useFollowCam ? followCfg.maxDistance : cfg.maxDistance}
			minPolarAngle={useFollowCam ? followCfg.minPolarAngle : cfg.minPolarDeg * DEG2RAD}
			maxPolarAngle={useFollowCam ? followCfg.maxPolarAngle : cfg.maxPolarDeg * DEG2RAD}
			azimuthRotateSpeed={cfg.rotateSpeed}
			polarRotateSpeed={polarRotateSpeed}
			dollySpeed={isOrtho ? cfg.dollySpeed * ORTHO_DOLLY_SPEED_MULT : cfg.dollySpeed}
			truckSpeed={cfg.truckSpeed}
			smoothTime={useFollowCam ? followCfg.smoothTime : cfg.smoothTime}
			draggingSmoothTime={cfg.draggingSmoothTime}
			dollyToCursor={cfg.dollyToCursor}
			infinityDolly={cfg.infinityDolly}
		/>
	{/if}
	{#if showGizmo && controls}
		<Gizmo
			bind:ref={viewportGizmo}
			{controls}
			className="viewport-gizmo"
			placement="bottom-left"
			size={64}
			offset={gizmoOffset}
			background={{ enabled: false }}
			renderTask={{ stage: renderStage, after: OUTLINE_COMPOSER_TASK }}
		/>
	{/if}
{/snippet}

<T.Color attach="background" args={[ui.scene.background]} />

{#if ui.scene.style.fog.enabled}
	<T.Fog
		attach="fog"
		color={ui.scene.style.fog.color}
		near={ui.scene.style.fog.near}
		far={ui.scene.style.fog.far}
	/>
{/if}

{#if ui.scene.sky.enabled && !worldProfile.is2d}
	<Sky
		setEnvironment={ui.scene.sky.setEnvironment}
		azimuth={skyProps.azimuth}
		elevation={skyProps.elevation}
		mieCoefficient={skyProps.mieCoefficient}
		mieDirectionalG={skyProps.mieDirectionalG}
		rayleigh={skyProps.rayleigh}
		turbidity={skyProps.turbidity}
	/>
{/if}

<T.PerspectiveCamera
	bind:ref={perspectiveCam}
	makeDefault={!isOrtho}
	position={[10, 8, 10]}
	fov={camera.fov}
	near={camera.near}
	far={camera.far}
/>

<T.OrthographicCamera
	bind:ref={orthoCam}
	makeDefault={isOrtho}
	zoom={RESET_ORTHO_ZOOM}
	near={camera.near}
	far={Math.max(camera.far, 500)}
/>

{@render orbitControls()}

{#if worldProfile.is2d}
	<T.AmbientLight intensity={0.9} />
{/if}

<Suspense
	final
	onsuspend={() => {
		sceneLoading.noteSuspend();
	}}
	onload={() => {
		sceneLoading.noteLoad();
		if (orbitRestored) {
			invalidate();
			return;
		}
		const saved = peekOrbitRestore();
		if (saved) {
			if (isOrtho && orthoCam) {
				restoreOrthographicViewport(orthoCam, controls ?? null, saved);
			} else {
				restoreOrbitSnapshot(saved);
			}
			orbitRestored = true;
			invalidate();
			return;
		}
		if (isOrtho && orthoCam) {
			const { width, height } = size.current;
			seedOrthographicViewport(orthoCam, width, height, controls ?? null, {
				is2d: worldProfile.is2d,
				plane: playPlane,
				zoom: worldProfile.is2d ? camera2dConfig.zoom : undefined
			});
			invalidate();
		} else if (ui.shellMode === 'edit' && worldProfile.is2d && controls) {
			seed2dEditorCamera(controls, playPlane, camera2dConfig.zoom);
			invalidate();
		}
	}}
>
	{#if hasGaussianSplat}
		<SparkRendererHost />
	{/if}
	<PhysicsWorld>
		{#each roots as entity (entity.id)}
			<Thing {entity} />
		{/each}
		<PlayerSpawnRings />
	</PhysicsWorld>

	<T.Mesh
		rotation={backdropRotation}
		receiveShadow={ui.shellMode === 'play' && ui.scene.shadows}
		position={backdropPosition}
		onpointermove={(event: IntersectionEvent<PointerEvent>) => {
			if (ui.shellMode === 'edit' && ui.placementDraft) onPlacementPointerMove(event);
		}}
		onpointerdown={(event: IntersectionEvent<PointerEvent>) => {
			if (ui.shellMode !== 'edit') return;
			if (ui.placementDraft && ui.placementTracking) {
				if (onPlacementPointerDown(event)) event.stopPropagation();
				return;
			}
			event.stopPropagation();
			deferViewportPick({ kind: 'clear' }, event.nativeEvent);
		}}
		onpointerup={(event: IntersectionEvent<PointerEvent>) => {
			if (ui.shellMode !== 'edit') return;
			if (ui.placementDraft && ui.placementTracking) {
				if (onPlacementPointerUp(event)) event.stopPropagation();
			}
		}}
	>
		<T.PlaneGeometry args={[50, 50]} />
		{#if worldProfile.is2d}
			<T.MeshBasicMaterial color="#12121a" depthWrite={false} {...BACKDROP_POLYGON_OFFSET} />
		{:else}
			<T.ShadowMaterial
				opacity={ui.shellMode === 'play' && ui.scene.shadows ? 0.15 : 0}
				depthWrite={ui.shellMode === 'play' && ui.scene.shadows}
				{...(ui.shellMode === 'play' && ui.scene.shadows ? BACKDROP_POLYGON_OFFSET : {})}
			/>
		{/if}
	</T.Mesh>

	{#if show2dPlaneGrid}
		<EditorGrid
			position.x={editorGridPos[0]}
			position.y={editorGridPos[1]}
			position.z={editorGridPos[2]}
			renderOrder={2}
			plane={editorGridPlane(playPlane)}
			gridSize={[40, 40]}
			cellSize={ui.grid.cellSize}
			sectionSize={ui.grid.sectionSize}
			cellColor={ui.grid.cellColor}
			sectionColor={ui.grid.sectionColor}
			cellThickness={0.6}
			sectionThickness={1}
			fadeDistance={80}
			infiniteGrid={false}
		/>
	{/if}

	{#if showEditorGrid}
		<EditorGrid
			position.x={editorGridPos[0]}
			position.y={editorGridPos[1]}
			position.z={editorGridPos[2]}
			renderOrder={2}
			plane={editorGridPlane(playPlane)}
			cellSize={ui.grid.cellSize}
			sectionSize={ui.grid.sectionSize}
			cellColor={ui.grid.cellColor}
			sectionColor={ui.grid.sectionColor}
			cellThickness={0.6}
			sectionThickness={1}
			fadeDistance={ui.grid.fadeDistance}
			infiniteGrid={ui.grid.infinite}
			followCamera={ui.grid.infinite}
		/>
	{/if}

	{#if ui.shellMode === 'edit'}
		<GridCellHighlight />
		<SelectionFootprints />
		<PlacementGhost />
		<OriginAxes />
	{/if}

	<PeerSelectionLabelProjector />
	<RoomPortalPromptProjector />
	<ViewportComposer />
</Suspense>

