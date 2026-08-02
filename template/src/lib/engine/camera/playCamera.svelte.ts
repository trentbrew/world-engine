/**
 * Play-mode camera bridge — camera-relative locomotion + gamepad look.
 * Configured from WorldScene where CameraControls lives.
 */
import type CameraControls from 'camera-controls';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { world } from '$lib/engine/runtime/world.svelte';

class PlayCameraState {
	active = false;
	trackRotation = false;

	#controls: CameraControls | null = null;
	#scratch = new Vector3();
	#forward = new Vector3();
	#right = new Vector3();
	#targetRight = new Vector3();
	#targetForward = new Vector3();
	#matrix = new Matrix4();
	#quat = new Quaternion();

	configure(opts: {
		controls: CameraControls | null;
		active: boolean;
		trackRotation?: boolean;
	}) {
		this.#controls = opts.controls;
		this.active = opts.active;
		this.trackRotation = opts.trackRotation ?? false;
	}

	/**
	 * Project stick/WASD input (x = strafe, z = −1 forward) into world XZ.
	 * Matches Threlte useFollow `getInputDirection` / `getTargetDirection`.
	 */
	projectMovement(inputX: number, inputZ: number): { x: number; z: number } {
		if (!this.active || (inputX === 0 && inputZ === 0)) {
			return { x: inputX, z: inputZ };
		}

		const forward = -inputZ;
		const out = this.#scratch.set(0, 0, 0);

		if (this.trackRotation) {
			const id = world.localPlayerId;
			const entity = id ? world.getEntity(id) : undefined;
			const rot = (
				entity?.components.Transform as { rotation?: [number, number, number, number] } | undefined
			)?.rotation;
			if (!rot || !this.#projectOnCharacter(inputX, forward, rot, out)) {
				return { x: inputX, z: inputZ };
			}
		} else if (!this.#projectOnCamera(inputX, forward, out)) {
			return { x: inputX, z: inputZ };
		}

		return { x: out.x, z: out.z };
	}

	applyLookDelta(azimuthDelta: number, polarDelta: number): void {
		if (!this.active || !this.#controls?.enabled) return;
		this.#controls.rotate(azimuthDelta, polarDelta, true);
	}

	#projectOnCamera(right: number, forward: number, out: Vector3): boolean {
		const cam = this.#controls?.camera;
		if (!cam) return false;

		cam.getWorldDirection(this.#forward);
		this.#forward.y = 0;
		if (this.#forward.lengthSq() < 1e-8) return false;

		this.#forward.normalize();
		this.#right.set(-this.#forward.z, 0, this.#forward.x);
		out.addScaledVector(this.#right, right).addScaledVector(this.#forward, forward);
		return true;
	}

	#projectOnCharacter(
		right: number,
		forward: number,
		rot: [number, number, number, number],
		out: Vector3
	): boolean {
		this.#quat.set(rot[0], rot[1], rot[2], rot[3]);
		this.#matrix.makeRotationFromQuaternion(this.#quat);
		this.#targetRight.setFromMatrixColumn(this.#matrix, 0);
		this.#targetForward.setFromMatrixColumn(this.#matrix, 2).negate();
		this.#targetRight.y = 0;
		this.#targetForward.y = 0;
		if (this.#targetForward.lengthSq() < 1e-8) return false;

		this.#targetRight.normalize();
		this.#targetForward.normalize();
		out.addScaledVector(this.#targetRight, right).addScaledVector(this.#targetForward, forward);
		return true;
	}
}

export const playCamera = new PlayCameraState();
