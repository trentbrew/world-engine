/** Orbit camera bearing on the XZ plane — for camera-relative transform nudges. */

import type CameraControls from 'camera-controls';
import { Vector3 } from 'three';

class ViewportCameraState {
	/** Unit look direction on XZ (camera → orbit target), or null when unavailable. */
	forwardXZ = $state<[number, number] | null>(null);
	/** Unit right direction on XZ, or null when unavailable. */
	rightXZ = $state<[number, number] | null>(null);

	#controls: CameraControls | null = null;
	#position = new Vector3();
	#target = new Vector3();
	#forward = new Vector3();
	#right = new Vector3();
	#up = new Vector3(0, 1, 0);

	bind(controls: CameraControls | null): void {
		this.#controls = controls;
		if (!controls) {
			this.forwardXZ = null;
			this.rightXZ = null;
		}
	}

	sync(): void {
		const controls = this.#controls;
		if (!controls) return;

		controls.getPosition(this.#position);
		controls.getTarget(this.#target);
		this.#forward.subVectors(this.#target, this.#position);
		this.#forward.y = 0;

		if (this.#forward.lengthSq() < 1e-8) {
			this.forwardXZ = null;
			this.rightXZ = null;
			return;
		}

		this.#forward.normalize();
		this.#right.crossVectors(this.#forward, this.#up).normalize();
		this.forwardXZ = [this.#forward.x, this.#forward.z];
		this.rightXZ = [this.#right.x, this.#right.z];
	}
}

export const viewportCamera = new ViewportCameraState();
