import type { WorldPlane } from '$lib/engine/world/worldProfile';
import type { ControlPrefs } from '$lib/engine/render/camera.svelte';
import type { Camera, OrthographicCamera } from 'three';
import type CameraControlsImpl from 'camera-controls';
import { syncOrthographicFrustum } from '$lib/scene/orthographicCamera';
import {
	RESET_ORTHO_ZOOM,
	RESET_POSITION,
	RESET_TARGET
} from '$lib/scene/focusEntity';

const LAYER_OFFSET = 0.03;
/** Rotation for meshes that lie on the active play plane (sprites, ground, grids). */
export function playPlaneMeshRotation(plane: WorldPlane): [number, number, number] {
	return plane === 'xy' ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
}

export function playPlaneBackdropPosition(plane: WorldPlane): [number, number, number] {
	return plane === 'xy' ? [0, 0, -0.001] : [0, -0.001, 0];
}

export function editorGridPlane(plane: WorldPlane): 'xy' | 'xz' {
	return plane === 'xy' ? 'xy' : 'xz';
}

/** Slight offset along the play-plane normal so grids draw above the backdrop. */
export function editorGridPosition(plane: WorldPlane): [number, number, number] {
	return plane === 'xy' ? [0, 0, LAYER_OFFSET] : [0, LAYER_OFFSET, 0];
}

/** Default orbit rig when authoring a 2D world in edit mode. */
export function editCameraPose(plane: WorldPlane): {
	position: [number, number, number];
	target: [number, number, number];
} {
	if (plane === 'xy') {
		return { position: [0, 2, 24], target: [0, 0, 0] };
	}
	return { position: [0, 24, 0.01], target: [0, 0, 0] };
}

/** Pan/zoom only — no orbit off the play plane in 2D edit mode. */
export function edit2dCameraControlPrefs(prefs: ControlPrefs): ControlPrefs {
	return {
		...prefs,
		rotateSpeed: 0
	};
}

/** Snap the editor camera to the 2D play-plane view. */
export function seed2dEditorCamera(
	controls: CameraControlsImpl | null,
	plane: WorldPlane,
	zoom = 1.6,
	orthoCam?: OrthographicCamera,
	viewport?: { width: number; height: number }
): void {
	if (orthoCam && viewport) {
		seedOrthographicViewport(orthoCam, viewport.width, viewport.height, controls, {
			is2d: true,
			plane,
			zoom
		});
		return;
	}

	const { position, target } = editCameraPose(plane);
	if (controls) {
		controls.setLookAt(
			position[0],
			position[1],
			position[2],
			target[0],
			target[1],
			target[2],
			false
		);
		controls.update(0);
	}
	const cam = (controls?.camera ?? orthoCam) as
		| (Camera & { zoom?: number; updateProjectionMatrix?: () => void })
		| undefined;
	if (cam) {
		cam.position.set(position[0], position[1], position[2]);
		cam.lookAt(target[0], target[1], target[2]);
		if ('zoom' in cam) {
			cam.zoom = cam.type === 'OrthographicCamera' ? zoom : 1;
		}
		cam.updateMatrixWorld();
		cam.updateProjectionMatrix?.();
	}
}

/** Point an orthographic viewport at the scene and sync its frustum. */
export function seedOrthographicViewport(
	orthoCam: OrthographicCamera,
	width: number,
	height: number,
	controls: CameraControlsImpl | null,
	options: {
		is2d?: boolean;
		plane?: WorldPlane;
		zoom?: number;
	} = {}
): void {
	syncOrthographicFrustum(orthoCam, width, height);

	const zoom = options.zoom ?? RESET_ORTHO_ZOOM;
	const pose =
		options.is2d && options.plane
			? editCameraPose(options.plane)
			: { position: RESET_POSITION, target: RESET_TARGET };

	if (controls) {
		controls.setLookAt(
			pose.position[0],
			pose.position[1],
			pose.position[2],
			pose.target[0],
			pose.target[1],
			pose.target[2],
			false
		);
		controls.zoomTo(zoom, false);
		controls.update(0);
	}

	orthoCam.position.set(pose.position[0], pose.position[1], pose.position[2]);
	orthoCam.lookAt(pose.target[0], pose.target[1], pose.target[2]);
	orthoCam.zoom = zoom;
	orthoCam.updateMatrixWorld();
	orthoCam.updateProjectionMatrix();
}

/** Restore a saved orbit pose without resetting the frustum extent. */
export function restoreOrthographicViewport(
	orthoCam: OrthographicCamera,
	controls: CameraControlsImpl | null,
	snap: {
		position: [number, number, number];
		target: [number, number, number];
		zoom?: number;
	}
): void {
	const zoom = snap.zoom ?? orthoCam.zoom;

	if (controls) {
		controls.setLookAt(
			snap.position[0],
			snap.position[1],
			snap.position[2],
			snap.target[0],
			snap.target[1],
			snap.target[2],
			false
		);
		controls.zoomTo(zoom, false);
		controls.update(0);
	}

	orthoCam.position.set(snap.position[0], snap.position[1], snap.position[2]);
	orthoCam.lookAt(snap.target[0], snap.target[1], snap.target[2]);
	orthoCam.zoom = zoom;
	orthoCam.updateMatrixWorld();
	orthoCam.updateProjectionMatrix();
}

export function gizmoAxisVisibility(plane: WorldPlane): {
	showX: boolean;
	showY: boolean;
	showZ: boolean;
} {
	return plane === 'xy'
		? { showX: true, showY: true, showZ: false }
		: { showX: true, showY: false, showZ: true };
}

/** Lock transform position to the play plane (layer axis zeroed). */
export function clampPositionToPlane(
	plane: WorldPlane,
	pos: [number, number, number]
): [number, number, number] {
	return plane === 'xy' ? [pos[0], pos[1], 0] : [pos[0], 0, pos[2]];
}

/** Group rotation for flat selection / placement overlays on the play plane. */
export function overlayGroupRotation(plane: WorldPlane): [number, number, number] {
	return plane === 'xy' ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
}

/** World position for placement cell highlight on the play plane. */
export function placementHighlightPosition(
	plane: WorldPlane,
	placement: [number, number, number]
): [number, number, number] {
	if (plane === 'xy') {
		return [placement[0], placement[1], LAYER_OFFSET];
	}
	return [placement[0], LAYER_OFFSET, placement[2]];
}

/** Border line geometry in the overlay group's local space (XZ floor by default). */
export function overlayBorderGeometry(size: number, plane: WorldPlane): Float32Array {
	return overlayRectBorderGeometry(size, size, plane);
}

export function overlayRectBorderGeometry(
	width: number,
	depth: number,
	plane: WorldPlane
): Float32Array {
	const hw = width / 2;
	const hd = depth / 2;
	if (plane === 'xy') {
		return new Float32Array([
			-hw, -hd, 0, hw, -hd, 0, hw, hd, 0, -hw, hd, 0, -hw, -hd, 0
		]);
	}
	return new Float32Array([
		-hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd, -hw, 0, -hd
	]);
}

export function overlayCircleBorderGeometry(
	radius: number,
	plane: WorldPlane,
	segments = 48
): Float32Array {
	const positions = new Float32Array((segments + 1) * 3);
	for (let i = 0; i <= segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		const c = Math.cos(angle) * radius;
		const s = Math.sin(angle) * radius;
		if (plane === 'xy') {
			positions[i * 3] = c;
			positions[i * 3 + 1] = s;
			positions[i * 3 + 2] = 0;
		} else {
			positions[i * 3] = c;
			positions[i * 3 + 1] = 0;
			positions[i * 3 + 2] = s;
		}
	}
	return positions;
}

