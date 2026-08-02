/** Defers viewport select/clear until pointerup unless the gesture becomes a drag. */

import { world } from '$lib/engine/runtime/world.svelte';
import { viewportFocus } from '$lib/scene/focusEntity';

const DRAG_THRESHOLD_PX = 4;

type PendingPick = { kind: 'select'; entityId: string } | { kind: 'clear' };

type PointerLike = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'button'>;

let activePointerId: number | null = null;
let startX = 0;
let startY = 0;
let dragged = false;
let pending: PendingPick | null = null;
let listening = false;

function ensureListeners() {
	if (listening || typeof window === 'undefined') return;
	listening = true;
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerCancel);
}

function resetGesture() {
	activePointerId = null;
	dragged = false;
	pending = null;
}

function commitPending() {
	if (dragged || !pending) return;
	const action = pending;
	pending = null;
	if (action.kind === 'select') {
		world.trySelect(action.entityId);
		return;
	}
	viewportFocus.cancel();
	world.select(null);
	world.setHover(null);
}

function onPointerMove(event: PointerEvent) {
	if (activePointerId === null || event.pointerId !== activePointerId) return;
	if (dragged) return;
	const dx = event.clientX - startX;
	const dy = event.clientY - startY;
	if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
		dragged = true;
		pending = null;
	}
}

function onPointerUp(event: PointerEvent) {
	if (activePointerId === null || event.pointerId !== activePointerId) return;
	commitPending();
	resetGesture();
}

function onPointerCancel(event: PointerEvent) {
	if (activePointerId === null || event.pointerId !== activePointerId) return;
	resetGesture();
}

/** Queue select/clear for pointerup; dropped if the pointer moves (orbit/pan) first. */
export function deferViewportPick(pick: PendingPick, event: PointerLike) {
	if (event.button !== 0) return;
	ensureListeners();
	activePointerId = event.pointerId;
	startX = event.clientX;
	startY = event.clientY;
	dragged = false;
	pending = pick;
}
