/** Screen → play-plane raycast for HTML5 asset drag onto the viewport. */

import type { Camera } from 'three';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import {
	placementUV,
	type WorldPlane
} from '$lib/engine/world/worldProfile';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';

let camera: Camera | null = null;
let canvas: HTMLCanvasElement | null = null;

const plane = new Plane();
const raycaster = new Raycaster();
const pointer = new Vector2();
const hit = new Vector3();

function syncPlane(planeId: WorldPlane) {
	if (planeId === 'xy') {
		plane.setComponents(0, 0, 1, 0);
	} else {
		plane.setComponents(0, 1, 0, 0);
	}
}

export function registerPlacementRaycast(cam: Camera, el: HTMLCanvasElement) {
	camera = cam;
	canvas = el;
	syncPlane(worldProfile.profile.plane);
}

export function clearPlacementRaycast() {
	camera = null;
	canvas = null;
}

/** Raycast client coords to play-plane UV coordinates. */
export function groundPointFromClient(clientX: number, clientY: number): [number, number] | null {
	if (!camera || !canvas) return null;

	const rect = canvas.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;

	syncPlane(worldProfile.profile.plane);

	pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
	pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

	raycaster.setFromCamera(pointer, camera);
	if (!raycaster.ray.intersectPlane(plane, hit)) return null;
	return placementUV(worldProfile.profile.plane, hit);
}
