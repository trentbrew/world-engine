import { Euler, Object3D, Quaternion, Vector3, type Vector2Tuple, type Vector3Tuple } from 'three';
import { useTask, useThrelte } from '@threlte/core';
import type CameraControls from 'camera-controls';

export interface UseFollowOptions {
	target?: Object3D | undefined | null;

	/**
	 * The `CameraControls` instance from `<CameraControls>` that the follow
	 * behavior is attached to. The hook is a no-op while this is falsy.
	 */
	controls?: CameraControls | null;

	/** @default [0, 0, 0] */
	lookAtOffset?: Vector3Tuple;

	/** @default [0, 0] */
	deadZone?: Vector2Tuple;

	/** @default 0 */
	lookAhead?: number;

	/** @default 0.15 */
	lookAheadSmoothTime?: number;

	/** @default 0 */
	followSmoothTime?: number;

	/** @default false */
	trackRotation?: boolean;

	/** @default 0 */
	trackRotationSmoothTime?: number;

	/** @default 0 */
	trackRotationOffset?: number;

	/** Runs at the start of each follow tick (e.g. sync target transform). */
	prepareTarget?: () => void;
}

const EPSILON = 1e-6;

/** Vendored from @threlte/extras (unreleased in installed build). */
export const useFollow = (optionsFn?: () => UseFollowOptions) => {
	const { invalidate } = useThrelte();

	const {
		target,
		controls,
		deadZone,
		lookAtOffset,
		lookAheadSmoothTime = 0.15,
		lookAhead = 0,
		trackRotation = false,
		trackRotationOffset = 0,
		trackRotationSmoothTime = 0,
		followSmoothTime = 0,
		prepareTarget
	} = $derived(optionsFn?.() ?? {});
	const deadZoneX = $derived(deadZone?.[0] ?? 0);
	const deadZoneY = $derived(deadZone?.[1] ?? 0);

	let initialized = false;
	let smoothingInitialized = false;
	let prevTarget: Object3D | null = null;

	const targetWorld = new Vector3();
	const lastTargetWorld = new Vector3();
	const velocity = new Vector3();
	const smoothedVelocity = new Vector3();
	const trackedTarget = new Vector3();
	const lookAtPoint = new Vector3();
	const tempDiff = new Vector3();
	const cameraRight = new Vector3();
	const cameraUp = new Vector3();
	const cameraForward = new Vector3();
	const inputForward = new Vector3();
	const inputRight = new Vector3();
	const smoothedTracked = new Vector3();
	const lag = new Vector3();
	const smoothedLookAt = new Vector3();
	const targetQuat = new Quaternion();
	const trackEuler = new Euler(0, 0, 0, 'YXZ');
	const targetForward = new Vector3();
	const targetRight = new Vector3();
	const scratchScale = new Vector3();

	const { task } = useTask(
		Symbol('useFollow'),
		(delta) => {
			if (target !== prevTarget) {
				initialized = false;
				smoothingInitialized = false;
				prevTarget = target ?? null;
			}

			if (!controls || !target) return;

			prepareTarget?.();
			target.updateWorldMatrix(true, false);
			if (trackRotation) {
				target.matrixWorld.decompose(targetWorld, targetQuat, scratchScale);
			} else {
				targetWorld.setFromMatrixPosition(target.matrixWorld);
			}

			if (lookAhead !== 0 && initialized && delta > 0) {
				velocity.subVectors(targetWorld, lastTargetWorld).divideScalar(delta);
				const scaledLookAheadSmoothTime = Math.max(0.001, lookAheadSmoothTime);
				const velT = 1 - Math.exp(-delta / scaledLookAheadSmoothTime);
				smoothedVelocity.lerp(velocity, velT);
			} else {
				velocity.set(0, 0, 0);
				smoothedVelocity.set(0, 0, 0);
			}

			lastTargetWorld.copy(targetWorld);

			if (!initialized) {
				trackedTarget.copy(targetWorld);
			} else if (deadZoneX > 0 || deadZoneY > 0) {
				const cam = controls.camera;
				cameraRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
				cameraUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
				cameraForward.setFromMatrixColumn(cam.matrixWorld, 2).negate().normalize();

				tempDiff.subVectors(targetWorld, trackedTarget);
				const dx = tempDiff.dot(cameraRight);
				const dy = tempDiff.dot(cameraUp);
				const dz = tempDiff.dot(cameraForward);

				if (deadZoneX > 0) {
					if (Math.abs(dx) > deadZoneX) {
						trackedTarget.addScaledVector(cameraRight, dx > 0 ? dx - deadZoneX : dx + deadZoneX);
					}
				} else {
					trackedTarget.addScaledVector(cameraRight, dx);
				}

				if (deadZoneY > 0) {
					if (Math.abs(dy) > deadZoneY) {
						trackedTarget.addScaledVector(cameraUp, dy > 0 ? dy - deadZoneY : dy + deadZoneY);
					}
				} else {
					trackedTarget.addScaledVector(cameraUp, dy);
				}

				trackedTarget.addScaledVector(cameraForward, dz);
			} else {
				trackedTarget.copy(targetWorld);
			}

			lookAtPoint.copy(trackedTarget);
			if (lookAtOffset) {
				lookAtPoint.x += lookAtOffset[0] ?? 0;
				lookAtPoint.y += lookAtOffset[1] ?? 0;
				lookAtPoint.z += lookAtOffset[2] ?? 0;
			}

			if (lookAhead !== 0 && smoothedVelocity.lengthSq() > EPSILON) {
				lookAtPoint.addScaledVector(smoothedVelocity, lookAhead);
			}

			if (!smoothingInitialized) {
				smoothedTracked.copy(trackedTarget);
				smoothingInitialized = true;
			}

			if (followSmoothTime > EPSILON) {
				const t = 1 - Math.exp(-delta / followSmoothTime);
				smoothedTracked.lerp(trackedTarget, t);

				lag.subVectors(smoothedTracked, trackedTarget);
				smoothedLookAt.copy(lookAtPoint).add(lag);
				controls.moveTo(smoothedLookAt.x, smoothedLookAt.y, smoothedLookAt.z, false);
			} else {
				smoothedTracked.copy(trackedTarget);
				controls.moveTo(lookAtPoint.x, lookAtPoint.y, lookAtPoint.z, false);
			}

			if (trackRotation) {
				trackEuler.setFromQuaternion(targetQuat, 'YXZ');
				const targetAzimuth = trackEuler.y + trackRotationOffset;
				const current = controls.azimuthAngle;
				let arc = targetAzimuth - current;
				arc = Math.atan2(Math.sin(arc), Math.cos(arc));
				const rotSmooth = Math.max(0, trackRotationSmoothTime);
				const rotT = rotSmooth <= EPSILON ? 1 : 1 - Math.exp(-delta / rotSmooth);
				controls.azimuthAngle = current + arc * rotT;
			}

			initialized = true;

			invalidate();
		},
		{ autoInvalidate: false }
	);

	const getInputDirection = (right: number, forward: number, out: Vector3): Vector3 => {
		const cam = controls?.camera;
		out.set(0, 0, 0);
		if (!cam) return out;
		cam.getWorldDirection(inputForward);
		inputForward.y = 0;
		if (inputForward.lengthSq() < EPSILON) return out;
		inputForward.normalize();
		inputRight.set(-inputForward.z, 0, inputForward.x);
		return out.addScaledVector(inputRight, right).addScaledVector(inputForward, forward);
	};

	const getTargetDirection = (right: number, forward: number, out: Vector3): Vector3 => {
		out.set(0, 0, 0);

		if (!target) return out;
		target.updateWorldMatrix(true, false);
		targetRight.setFromMatrixColumn(target.matrixWorld, 0);
		targetForward.setFromMatrixColumn(target.matrixWorld, 2);
		targetRight.y = 0;
		targetForward.y = 0;
		if (targetForward.lengthSq() < EPSILON) return out;
		targetRight.normalize();
		targetForward.normalize();
		return out.addScaledVector(targetRight, right).addScaledVector(targetForward, forward);
	};

	return { task, getInputDirection, getTargetDirection };
};

export type UseFollowReturn = ReturnType<typeof useFollow>;
