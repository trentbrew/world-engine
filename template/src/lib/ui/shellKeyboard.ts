/** Keyboard helpers for shell shortcuts. */

import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
import { editHistory } from '$lib/engine/authoring/editHistory.svelte';
import { eventMatchesAction } from '$lib/engine/input/shortcutBinding';
import { camera } from '$lib/engine/render/camera.svelte';
import { viewportCamera } from '$lib/engine/render/viewportCamera.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { entityDestroy } from '$lib/ui/entityDestroy.svelte';
import { ui } from '$lib/ui/ui.svelte';

const FREE_NUDGE_STEP = 0.1;

const TRANSFORM_NUDGE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function isFormFieldFocused(): boolean {
	if (typeof document === 'undefined') return false;
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	return (el as HTMLElement).isContentEditable;
}

export function isModKey(event: KeyboardEvent): boolean {
	return event.metaKey || event.ctrlKey;
}

export function isBackslashShortcut(event: KeyboardEvent): boolean {
	return event.key === '\\' || event.code === 'Backslash';
}

/** Arrow up/down nudge for inspector numeric fields. Returns true when handled. */
export function handleNumberNudgeKeydown(
	event: KeyboardEvent,
	current: number,
	onCommit: (next: number) => void
): boolean {
	if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;

	event.preventDefault();

	const direction = event.key === 'ArrowUp' ? 1 : -1;
	let step = 1;
	if (event.shiftKey) step = 10;
	else if (event.altKey) step = 0.1;

	onCommit(current + direction * step);
	return true;
}

export function canNudgeSelectedTransform(): boolean {
	if (ui.placementDraft || ui.shellMode !== 'edit') return false;
	const entity = world.selectedEntity;
	if (!entity || !world.canTransformEntity(entity.id)) return false;
	const transform = entity.components.Transform as { position?: [number, number, number] } | undefined;
	return Array.isArray(transform?.position);
}

/** M/R/S or G/R/S — switch transform gizmo mode in edit mode. */
export function setTransformGizmoModeFromKey(event: KeyboardEvent): boolean {
	if (ui.placementDraft || ui.shellMode !== 'edit') return false;
	if (isFormFieldFocused() || isModKey(event)) return false;

	const bindings = inputPrefs.shortcuts;
	const mode = eventMatchesAction(event, 'gizmoTranslate', bindings)
		? 'translate'
		: eventMatchesAction(event, 'gizmoRotate', bindings)
			? 'rotate'
			: eventMatchesAction(event, 'gizmoScale', bindings)
				? 'scale'
				: null;
	if (!mode) return false;

	const entity = world.selectedEntity;
	if (!entity || !world.canTransformEntity(entity.id)) return false;

	ui.setTransformGizmoMode(mode);
	event.preventDefault();
	return true;
}

function nudgeStep(event: KeyboardEvent): number {
	const base = ui.chrome.grid ? ui.grid.cellSize : FREE_NUDGE_STEP;
	if (event.shiftKey) return base * 10;
	if (event.altKey) return base * 0.1;
	return base;
}

function applyWorldNudge(
	event: KeyboardEvent,
	x: number,
	y: number,
	z: number,
	step: number
): [number, number, number] | null {
	if (worldProfile.is2d && worldProfile.profile.plane === 'xy') {
		if (event.key === 'ArrowLeft') return [x - step, y, z];
		if (event.key === 'ArrowRight') return [x + step, y, z];
		if (event.key === 'ArrowUp') return [x, y + step, z];
		if (event.key === 'ArrowDown') return [x, y - step, z];
		return null;
	}

	if (event.altKey) {
		if (event.key === 'ArrowUp') return [x, y + step, z];
		if (event.key === 'ArrowDown') return [x, y - step, z];
		return null;
	}

	if (event.key === 'ArrowLeft') return [x - step, y, z];
	if (event.key === 'ArrowRight') return [x + step, y, z];
	if (event.key === 'ArrowUp') return [x, y, z - step];
	if (event.key === 'ArrowDown') return [x, y, z + step];
	return null;
}

function applyCameraNudge(
	event: KeyboardEvent,
	x: number,
	y: number,
	z: number,
	step: number
): [number, number, number] | null {
	if (worldProfile.is2d && worldProfile.profile.plane === 'xy') {
		return applyWorldNudge(event, x, y, z, step);
	}

	if (event.altKey) {
		if (event.key === 'ArrowUp') return [x, y + step, z];
		if (event.key === 'ArrowDown') return [x, y - step, z];
		return null;
	}

	const forward = viewportCamera.forwardXZ;
	const right = viewportCamera.rightXZ;
	if (!forward || !right) {
		return applyWorldNudge(event, x, y, z, step);
	}

	let alongRight = 0;
	let alongForward = 0;

	if (event.key === 'ArrowLeft') alongRight = -1;
	else if (event.key === 'ArrowRight') alongRight = 1;
	else if (event.key === 'ArrowUp') alongForward = 1;
	else if (event.key === 'ArrowDown') alongForward = -1;
	else return null;

	const dx = (right[0] * alongRight + forward[0] * alongForward) * step;
	const dz = (right[1] * alongRight + forward[1] * alongForward) * step;
	return [x + dx, y, z + dz];
}

/**
 * Arrow keys nudge selected entity Transform.position.
 * World: ±X / ±Z (Alt+↑↓ for Y). Camera: screen-relative on XZ (Alt+↑↓ for Y).
 */
export function nudgeSelectedPosition(event: KeyboardEvent): boolean {
	if (!TRANSFORM_NUDGE_KEYS.has(event.key)) return false;
	if (!canNudgeSelectedTransform()) return false;
	if (isFormFieldFocused()) return false;

	const entity = world.selectedEntity;
	if (!entity) return false;

	const transform = entity.components.Transform as { position?: [number, number, number] };
	const [x, y, z] = transform.position ?? [0, 0, 0];
	const step = nudgeStep(event);

	const next =
		camera.nudgeSpace === 'camera'
			? applyCameraNudge(event, x, y, z, step)
			: applyWorldNudge(event, x, y, z, step);

	if (!next) return false;

	event.preventDefault();
	world.setField(entity.id, 'Transform', 'position', next);
	return true;
}

export function handleShellKeydown(event: KeyboardEvent): boolean {
	if (inputPrefs.recordingAction) {
		return inputPrefs.commitRecording(event);
	}

	const bindings = inputPrefs.shortcuts;

	if (eventMatchesAction(event, 'toggleSidebars', bindings)) {
		if (ui.shellMode === 'edit') {
			ui.toggleSidebars();
			event.preventDefault();
			return true;
		}
	}

	if (event.key === 'Escape' && ui.shellMode === 'edit') {
		if (ui.railRoute === 'object') {
			if (ui.bottomPaneOpen) {
				ui.toggleBottomPane(false);
			} else {
				ui.exitObject();
			}
			event.preventDefault();
			return true;
		}
	}

	if (event.key === 'Escape') return false;

	if (ui.shellMode === 'play') return false;

	if (isFormFieldFocused()) return false;

	if (setTransformGizmoModeFromKey(event)) return true;

	if (eventMatchesAction(event, 'undo', bindings)) {
		if (editHistory.undo()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'redo', bindings)) {
		if (editHistory.redo()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'copy', bindings)) {
		if (world.copySelection()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'paste', bindings)) {
		if (world.pasteClipboard()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'duplicate', bindings)) {
		if (world.duplicateSelection()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'cut', bindings)) {
		if (world.cutSelection()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'delete', bindings)) {
		if (entityDestroy.open) return false;
		if (entityDestroy.request()) {
			event.preventDefault();
			return true;
		}
		return false;
	}

	if (eventMatchesAction(event, 'togglePlay', bindings)) {
		ui.togglePlay();
		event.preventDefault();
		return true;
	}

	if (event.key === '/' && ui.railRoute === 'object') {
		ui.toggleBottomPane();
		event.preventDefault();
		return true;
	}

	return false;
}

/** Capture-phase handler — wins over focused entity list rows. */
export function handleShellKeydownCapture(event: KeyboardEvent): boolean {
	if (ui.shellMode === 'play') return false;
	if (!nudgeSelectedPosition(event)) return false;
	event.stopPropagation();
	return true;
}
