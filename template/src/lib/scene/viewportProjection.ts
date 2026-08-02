import type { PerspectiveCamera } from 'three';

/** Floating edit chrome that obscures a full-bleed canvas (px, viewport coords). */
export type ViewportChromeInsets = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

/**
 * Shift needed so world origin projects to the center of the *visible* canvas
 * (after left/right/top/bottom chrome overlays), in CSS pixels.
 *
 * When the canvas is already CSS-inset (e.g. Objects preview with
 * `--viewport-bottom-inset`), pass zeroed insets for those edges so we don't
 * double-count chrome and squash the projection aspect.
 */
export function computeProjectionCenterOffset(
	canvas: HTMLElement,
	insets: ViewportChromeInsets
): { x: number; y: number } {
	const rect = canvas.getBoundingClientRect();
	const winW = window.innerWidth;
	const winH = window.innerHeight;

	const visibleLeft = Math.max(rect.left, insets.left);
	const visibleRight = Math.min(rect.right, winW - insets.right);
	const visibleTop = Math.max(rect.top, insets.top);
	const visibleBottom = Math.min(rect.bottom, winH - insets.bottom);

	const visibleW = Math.max(1, visibleRight - visibleLeft);
	const visibleH = Math.max(1, visibleBottom - visibleTop);
	const visibleCenterX = visibleLeft + visibleW / 2;
	const visibleCenterY = visibleTop + visibleH / 2;
	const canvasCenterX = rect.left + rect.width / 2;
	const canvasCenterY = rect.top + rect.height / 2;

	return {
		x: visibleCenterX - canvasCenterX,
		y: visibleCenterY - canvasCenterY
	};
}

/**
 * Apply a pixel shift to perspective projection (Three.js setViewOffset).
 * `fullWidth` / `fullHeight` must match the canvas drawing buffer size — not
 * the window — or the frustum aspect stretches/squashes.
 */
export function applyPerspectiveViewOffset(
	camera: PerspectiveCamera,
	offsetX: number,
	offsetY: number,
	fullWidth: number,
	fullHeight: number
): void {
	const w = Math.max(1, Math.round(fullWidth));
	const h = Math.max(1, Math.round(fullHeight));
	if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) {
		camera.clearViewOffset();
		camera.updateProjectionMatrix();
		return;
	}
	camera.setViewOffset(w, h, offsetX, offsetY, w, h);
	camera.updateProjectionMatrix();
}
