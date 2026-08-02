import { DEFAULT_CAMERA2D, type Camera2DConfig } from './camera2D';

/** Ephemeral per-viewer 2D play camera tuning — not synced to peers. */
class Camera2DStore {
	config = $state<Camera2DConfig>({ ...DEFAULT_CAMERA2D });
}

export const camera2D = new Camera2DStore();
