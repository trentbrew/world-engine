/**
 * Play ↔ edit camera boundary — capture the edit viewport before play mutates it,
 * restore on exit so repeated toggles are idempotent.
 */
import type { OrbitCameraSnapshot } from '$lib/engine/dev/editorSession';

export type PlayEditCameraBridge = {
	capture: () => OrbitCameraSnapshot | null;
	restore: (snap: OrbitCameraSnapshot) => void;
	/** Reset transient 2D play-follow smoothing when entering play. */
	resetPlayRig: () => void;
};

let bridge: PlayEditCameraBridge | null = null;

export function registerPlayEditCameraBridge(next: PlayEditCameraBridge | null): void {
	bridge = next;
}

export function captureEditCameraSnapshot(): OrbitCameraSnapshot | null {
	return bridge?.capture() ?? null;
}

export function restoreEditCameraSnapshot(snap: OrbitCameraSnapshot | null): void {
	if (!snap || !bridge) return;
	bridge.restore(snap);
}

export function resetPlayCameraRig(): void {
	bridge?.resetPlayRig();
}
