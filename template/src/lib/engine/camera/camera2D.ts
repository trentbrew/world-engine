/**
 * 2D play camera — orthographic follow with dead zone and smoothing.
 * Used when WorldProfile.dimensions === '2d' in play mode.
 */
import type { Camera } from 'three';
import { OrthographicCamera, Vector3 } from 'three';
import type { WorldPlane, WorldProfileData } from '$lib/engine/world/worldProfile';
import {
	normalizeOrthoZoom,
	syncOrthographicFrustum
} from '$lib/scene/orthographicCamera';

export type Camera2DConfig = {
	/** Orthographic zoom multiplier (higher = more zoomed in). */
	zoom: number;
	/** Half-width of the horizontal dead zone before the camera pans (world units). */
	deadZoneX: number;
	/** Half-height of the vertical dead zone before the camera pans (world units). */
	deadZoneY: number;
	/** Look-ahead along the primary travel axis (world units). */
	lookAhead: number;
	/** Exponential smoothing factor per frame (0–1; higher = snappier). */
	smoothing: number;
};

export const DEFAULT_CAMERA2D: Camera2DConfig = {
	zoom: 1.6,
	deadZoneX: 1.2,
	deadZoneY: 0.8,
	lookAhead: 0.6,
	smoothing: 0.12
};

export type Camera2DState = {
	focusX: number;
	focusY: number;
};

export function createCamera2DState(): Camera2DState {
	return { focusX: 0, focusY: 0 };
}

export function resetCamera2DState(state: Camera2DState): void {
	state.focusX = 0;
	state.focusY = 0;
}

const target = new Vector3();
const desired = new Vector3();

/**
 * Drive an orthographic camera for 2D play. Returns false if the write was skipped
 * (e.g. NaN guard).
 */
export function applyCamera2DFollow(
	cam: Camera,
	playerPos: [number, number, number] | undefined,
	profile: WorldProfileData,
	cfg: Camera2DConfig,
	state: Camera2DState,
	viewport?: { width: number; height: number }
): boolean {
	const px = playerPos?.[0] ?? 0;
	const py = playerPos?.[1] ?? 0;
	const pz = playerPos?.[2] ?? 0;

	const [focusU, focusV] = profile.plane === 'xy' ? [px, py] : [px, pz];

	const deltaU = focusU - state.focusX;
	const deltaV = focusV - state.focusY;

	if (Math.abs(deltaU) > cfg.deadZoneX) {
		state.focusX += deltaU - Math.sign(deltaU) * cfg.deadZoneX;
	}
	if (Math.abs(deltaV) > cfg.deadZoneY) {
		state.focusY += deltaV - Math.sign(deltaV) * cfg.deadZoneY;
	}

	const smooth = Math.min(1, Math.max(0, cfg.smoothing));
	state.focusX += (focusU + cfg.lookAhead - state.focusX) * smooth;
	state.focusY += (focusV - state.focusY) * smooth;

	if (profile.plane === 'xy') {
		desired.set(state.focusX, state.focusY + 2, 24);
		target.set(state.focusX, state.focusY, 0);
	} else {
		desired.set(state.focusX, 24, state.focusY);
		target.set(state.focusX, 0, state.focusY);
	}

	if (!Number.isFinite(desired.x + desired.y + desired.z)) return false;

	cam.position.copy(desired);
	cam.lookAt(target);
	cam.updateMatrixWorld();

	if (cam instanceof OrthographicCamera) {
		if (viewport) syncOrthographicFrustum(cam, viewport.width, viewport.height);
		const ppu = profile.pixelsPerUnit;
		const authored = cfg.zoom * (profile.unit === 'pixel' ? ppu / 64 : 1);
		cam.zoom = normalizeOrthoZoom(authored, viewport?.height ?? 600);
		cam.updateProjectionMatrix();
	} else if ('zoom' in cam) {
		const perspective = cam as Camera & { zoom: number; updateProjectionMatrix?: () => void };
		perspective.zoom = 1;
		perspective.updateProjectionMatrix?.();
	}

	return true;
}

export function camera2DPlaneLabel(plane: WorldPlane): string {
	return plane === 'xy' ? 'side-view (XY)' : 'top-down (XZ)';
}
