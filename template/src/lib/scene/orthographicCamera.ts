import type { Camera, OrthographicCamera } from 'three';
import type CameraControls from 'camera-controls';

/**
 * Base half-height of the ortho view at zoom=1, in world units.
 * Pixel-sized frustums (±width/2) break Three.js frustum culling once zoom
 * is applied — keep the clip volume in world space instead.
 */
export const ORTHO_BASE_HALF_HEIGHT = 10;

/** Scroll/pinch zoom feels slower in ortho than perspective dolly — boost it. */
export const ORTHO_DOLLY_SPEED_MULT = 2.75;

/**
 * Extra vertical extent (biased downward in view space) so a tilted orbit
 * that fits horizontally still shows the ground along the bottom edge.
 */
const BOTTOM_PADDING = 1.22;

export function isOrthographicCamera(
	camera: Camera | null | undefined
): camera is OrthographicCamera {
	return (
		!!camera &&
		'isOrthographicCamera' in camera &&
		!!(camera as OrthographicCamera).isOrthographicCamera
	);
}

export function syncOrthographicFrustum(
	camera: OrthographicCamera,
	width: number,
	height: number
): void {
	const w = width > 0 ? width : 800;
	const h = height > 0 ? height : 600;
	const aspect = w / h;
	const halfH = ORTHO_BASE_HALF_HEIGHT;
	const halfW = halfH * aspect;

	camera.left = -halfW;
	camera.right = halfW;
	camera.top = halfH;
	camera.bottom = -halfH * BOTTOM_PADDING;
	camera.updateProjectionMatrix();
}

/**
 * Match perspective framing when switching to ortho.
 * Visible world height ≈ 2 * distance * tan(fov/2);
 * at zoom Z, ortho shows (2 * ORTHO_BASE_HALF_HEIGHT) / Z.
 */
export function orthoZoomForPerspectiveFraming(
	distance: number,
	_viewportHeight: number,
	fovDeg: number
): number {
	const d = Math.max(distance, 0.01);
	const visibleHeight = 2 * d * Math.tan((fovDeg * Math.PI) / 360);
	if (visibleHeight <= 0) return 1;
	return Math.max(0.05, (2 * ORTHO_BASE_HALF_HEIGHT) / visibleHeight);
}

/**
 * Older pixel-frustum zooms were typically 20–80. Convert them to world-frustum zoom
 * so authored Camera2D values and session snapshots keep framing.
 */
export function normalizeOrthoZoom(zoom: number, viewportHeight = 600): number {
	if (!Number.isFinite(zoom) || zoom <= 0) return 1;
	if (zoom <= 10) return zoom;
	const h = viewportHeight > 0 ? viewportHeight : 600;
	return Math.max(0.05, (zoom * 2 * ORTHO_BASE_HALF_HEIGHT) / h);
}

/**
 * CameraControls keeps an internal `_zoom` (usually 1 from PerspectiveCamera) and
 * writes it onto the camera every update — setting `camera.zoom` alone does not stick.
 * Always call `zoomTo` on controls when present (safe for either projection).
 */
export function applyOrthographicZoom(
	orthoCam: OrthographicCamera,
	zoom: number,
	controls: CameraControls | null | undefined
): void {
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	orthoCam.zoom = z;
	orthoCam.updateProjectionMatrix();
	if (controls) {
		controls.zoomTo(z, false);
		controls.update(0);
	}
}
