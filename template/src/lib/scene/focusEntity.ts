import { comp, position } from '$lib/engine/render/access';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import type { Entity } from '$lib/engine/ontology/schema';
import { Vector3 } from 'three';
import type CameraControls from 'camera-controls';
import { isOrthographicCamera } from '$lib/scene/orthographicCamera';

/** Pull-back multiplier — higher = wider framing. */
export const FOCUS_DISTANCE_SCALE = 5.25;
export const FOCUS_MIN_DISTANCE = 5;

/** Default reset pose (matches the camera's initial framing). */
export const RESET_POSITION: [number, number, number] = [10, 8, 10];
export const RESET_TARGET: [number, number, number] = [0, 0, 0];
export const RESET_ORTHO_ZOOM = 1;

export type FocusTarget = {
	center: Vector3;
	radius: number;
};

export function entityFocusTarget(entity: Entity): FocusTarget {
	const [x, y, z] = position(entity);
	const bounds = renderBounds.get(entity.id);

	if (bounds) {
		return {
			center: new Vector3(
				x + bounds.center[0],
				y + bounds.center[1],
				z + bounds.center[2]
			),
			radius: Math.max(bounds.size[0], bounds.size[1], bounds.size[2]) * 0.55
		};
	}

	if ('Ground' in entity.components) {
		const size = comp<{ size?: number }>(entity, 'Ground')?.size ?? 20;
		return { center: new Vector3(x, y, z), radius: size * 0.35 };
	}

	if ('Marker' in entity.components) {
		return { center: new Vector3(x, y + 0.15, z), radius: 0.85 };
	}

	return { center: new Vector3(x, y + 0.5, z), radius: 1.1 };
}

const _pos = new Vector3();
const _target = new Vector3();
const _offset = new Vector3();

/**
 * Viewport focus/reset driver backed by @threlte/extras <CameraControls>.
 * Transitions are animated internally by camera-controls (smoothTime), so no
 * per-frame tick is needed. WorldScene binds the live controls ref.
 */
class ViewportFocus {
	#controls: CameraControls | null = null;

	bind(controls: CameraControls | null): void {
		this.#controls = controls;
	}

	get active(): boolean {
		return this.#controls !== null;
	}

	reset(): void {
		const controls = this.#controls;
		if (!controls) return;
		controls.setLookAt(
			RESET_POSITION[0],
			RESET_POSITION[1],
			RESET_POSITION[2],
			RESET_TARGET[0],
			RESET_TARGET[1],
			RESET_TARGET[2],
			true
		);
		if (isOrthographicCamera(controls.camera)) {
			controls.zoomTo(RESET_ORTHO_ZOOM, true);
		}
	}

	focus(entity: Entity): void {
		const controls = this.#controls;
		if (!controls) return;

		const { center, radius } = entityFocusTarget(entity);
		const distance = Math.max(radius * FOCUS_DISTANCE_SCALE, FOCUS_MIN_DISTANCE);

		controls.getPosition(_pos);
		controls.getTarget(_target);
		_offset.subVectors(_pos, _target);
		if (_offset.lengthSq() < 0.001) _offset.set(1, 0.75, 1);
		_offset.normalize().multiplyScalar(distance);

		controls.setLookAt(
			center.x + _offset.x,
			center.y + _offset.y,
			center.z + _offset.z,
			center.x,
			center.y,
			center.z,
			true
		);
	}

	/** Halt any in-flight transition (e.g. user clears the selection). */
	cancel(): void {
		this.#controls?.stop();
	}
}

export const viewportFocus = new ViewportFocus();
