import type CameraControlsImpl from 'camera-controls';

/** Svelte context key — WorldScene provides the active orbit camera controls. */
export const VIEWPORT_CAMERA_CONTROLS = Symbol('viewport-camera-controls');

export type ViewportCameraControls = () => CameraControlsImpl | undefined;
