/** Pointer placement session — arm from Rooms Objects (types) or Assets (mesh), raycast ground, snap, commit. */

import type { IntersectionEvent } from '@threlte/extras';
import type { MeshAnchor } from '$lib/engine/render/meshAnchor';
import { getType } from '$lib/engine/ontology/registry';
import { world } from '$lib/engine/runtime/world.svelte';
import { isRiggedModel } from '$lib/engine/animation/clipCatalog';
import { positionFromPlacement } from '$lib/engine/world/worldProfile';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { toast } from '$lib/ui/toast.svelte';

export type MeshPlacementDraft = {
	kind: 'mesh';
	mesh: string;
	anchor?: MeshAnchor;
	label: string;
	source: 'shape' | 'model';
};

export type TypePlacementDraft = {
	kind: 'type';
	typeName: string;
	label: string;
};

export type PlacementDraft = MeshPlacementDraft | TypePlacementDraft;

const DRAG_THRESHOLD_PX = 4;
const FREE_QUANTIZE = 0.1;
const FEET_ON_GROUND_TYPES = new Set(['Character', 'CharacterFemale', 'Player']);

/** Half-height for floor rest — matches MeshView primitive geometry. */
export function primitiveRestY(mesh: string): number {
	if (mesh === 'primitive:capsule') return 0.57;
	if (mesh === 'primitive:sphere') return 0.5;
	return 0.5;
}

/** Resolve default mesh URL for a type (thumb / ghost). */
export function resolveTypeMesh(typeName: string): string {
	const type = getType(typeName);
	if (!type) return 'primitive:box';
	const skinned = type.defaults?.SkinnedMesh?.mesh;
	if (typeof skinned === 'string' && skinned) return skinned;
	const render = type.defaults?.Render?.mesh;
	if (typeof render === 'string' && render) return render;
	const sprite = type.defaults?.Sprite?.texture;
	if (typeof sprite === 'string' && sprite) return sprite;
	if (type.components.includes('SkinnedMesh')) {
		return '/models/characters/mannequin.glb';
	}
	return 'primitive:box';
}

export function resolveTypeAnchor(typeName: string): MeshAnchor {
	const type = getType(typeName);
	if (!type) return 'origin';
	if (
		FEET_ON_GROUND_TYPES.has(typeName) ||
		type.components.includes('SkinnedMesh') ||
		type.components.includes('Player')
	) {
		return 'bottom';
	}
	const skinnedAnchor = type.defaults?.SkinnedMesh?.anchor;
	if (skinnedAnchor === 'bottom' || skinnedAnchor === 'center' || skinnedAnchor === 'origin') {
		return skinnedAnchor;
	}
	const renderAnchor = type.defaults?.Render?.anchor;
	if (renderAnchor === 'bottom' || renderAnchor === 'center' || renderAnchor === 'origin') {
		return renderAnchor;
	}
	return 'origin';
}

/** Mesh URL used by ghost / rest-Y for any draft kind. */
export function draftMesh(draft: PlacementDraft): string {
	if (draft.kind === 'mesh') return draft.mesh;
	return resolveTypeMesh(draft.typeName);
}

export function draftAnchor(draft: PlacementDraft): MeshAnchor {
	if (draft.kind === 'mesh') return draft.anchor ?? 'origin';
	return resolveTypeAnchor(draft.typeName);
}

export function snapUV(
	u: number,
	v: number,
	gridOn: boolean,
	cellSize: number
): [number, number] {
	if (gridOn) {
		return [Math.round(u / cellSize) * cellSize, Math.round(v / cellSize) * cellSize];
	}
	return [
		Math.round(u / FREE_QUANTIZE) * FREE_QUANTIZE,
		Math.round(v / FREE_QUANTIZE) * FREE_QUANTIZE
	];
}

/** @deprecated Use snapUV — kept for call sites that still name axes XZ. */
export function snapXZ(
	x: number,
	z: number,
	gridOn: boolean,
	cellSize: number
): [number, number] {
	return snapUV(x, z, gridOn, cellSize);
}

export function restPositionForDraft(
	draft: PlacementDraft,
	uv: [number, number]
): [number, number, number] {
	const [u, v] = uv;
	const plane = worldProfile.profile.plane;
	const mesh = draftMesh(draft);
	const anchor = draftAnchor(draft);
	if (plane === 'xy') {
		if (anchor === 'bottom') return positionFromPlacement(plane, u, v, 0);
		return positionFromPlacement(plane, u, v + primitiveRestY(mesh), 0);
	}
	if (anchor === 'bottom') return positionFromPlacement(plane, u, v, 0);
	return positionFromPlacement(plane, u, primitiveRestY(mesh), v);
}

export function canStartPlacement(): boolean {
	return ui.shellMode === 'edit' && ui.assetPickTarget === null;
}

export function startPlacement(draft: PlacementDraft) {
	if (!canStartPlacement()) return;
	ui.placementDraft = draft;
	ui.placementPosition = null;
	ui.placementTracking = false;
}

export function cancelPlacement() {
	if (!ui.placementDraft) return;
	ui.placementDraft = null;
	ui.placementPosition = null;
	ui.placementTracking = false;
	toast.success('Placement cancelled');
}

/** Clear draft without toast (route leave / silent cancel). */
export function clearPlacement() {
	if (!ui.placementDraft) return;
	ui.placementDraft = null;
	ui.placementPosition = null;
	ui.placementTracking = false;
}

export async function commitPlacement() {
	const draft = ui.placementDraft;
	const position = ui.placementPosition;
	if (!draft || !position) return;

	// Clear immediately so a second click during async rig-detection can't double-place.
	ui.placementDraft = null;
	ui.placementPosition = null;
	ui.placementTracking = false;

	if (draft.kind === 'type') {
		const entity = world.spawnFromType(draft.typeName, { position });
		if (entity) toast.success(`Placed ${draft.label}`);
		return;
	}

	// A rigged GLB becomes an animated Character; everything else is a static Prop.
	const rigged = draft.source === 'model' && (await isRiggedModel(draft.mesh));
	const entity = rigged
		? world.createCharacter({ mesh: draft.mesh, anchor: draft.anchor, position, label: draft.label })
		: world.createProp({ mesh: draft.mesh, anchor: draft.anchor, position, label: draft.label });

	if (entity) toast.success(`Placed ${draft.label}${rigged ? ' (animated)' : ''}`);
}

function updateFromHit(u: number, v: number) {
	const draft = ui.placementDraft;
	if (!draft) return;
	const uv = snapUV(u, v, ui.chrome.grid, ui.grid.cellSize);
	ui.placementPosition = restPositionForDraft(draft, uv);
}

let activePointerId: number | null = null;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerDragged = false;

export function onViewportEnter() {
	if (ui.placementDraft) ui.placementTracking = true;
}

export function onViewportLeave() {
	ui.placementTracking = false;
}

export function onPlacementPointerMove(event: IntersectionEvent<PointerEvent>) {
	if (!ui.placementDraft) return;
	ui.placementTracking = true;
	const plane = worldProfile.profile.plane;
	if (plane === 'xy') {
		updateFromHit(event.point.x, event.point.y);
	} else {
		updateFromHit(event.point.x, event.point.z);
	}

	const native = event.nativeEvent;
	if (activePointerId !== null && native.pointerId === activePointerId && !pointerDragged) {
		const dx = native.clientX - pointerStartX;
		const dy = native.clientY - pointerStartY;
		if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) pointerDragged = true;
	}
}

export function onPlacementPointerDown(event: IntersectionEvent<PointerEvent>) {
	if (!ui.placementDraft || !ui.placementTracking) return false;
	const native = event.nativeEvent;
	if (native.button !== 0) return false;
	const plane = worldProfile.profile.plane;
	if (plane === 'xy') {
		updateFromHit(event.point.x, event.point.y);
	} else {
		updateFromHit(event.point.x, event.point.z);
	}
	activePointerId = native.pointerId;
	pointerStartX = native.clientX;
	pointerStartY = native.clientY;
	pointerDragged = false;
	return true;
}

export function onPlacementPointerUp(event: IntersectionEvent<PointerEvent>) {
	if (!ui.placementDraft || !ui.placementTracking) return false;
	const native = event.nativeEvent;
	if (native.button !== 0 || native.pointerId !== activePointerId) return false;
	activePointerId = null;
	if (!pointerDragged && ui.placementPosition) commitPlacement();
	pointerDragged = false;
	return true;
}

export function draftFromShape(mesh: string, label: string): PlacementDraft {
	return { kind: 'mesh', mesh, label, source: 'shape' };
}

export function draftFromModel(url: string, name: string): PlacementDraft {
	return { kind: 'mesh', mesh: url, label: name, anchor: 'bottom', source: 'model' };
}

export function draftFromType(typeName: string, label?: string): PlacementDraft {
	return { kind: 'type', typeName, label: label ?? typeName };
}

/** Attach to any floor mesh (shadow catcher, Ground entity, etc.) during placement. */
export function placementSurfaceProps() {
	return {
		onpointermove: (event: IntersectionEvent<PointerEvent>) => onPlacementPointerMove(event),
		onpointerdown: (event: IntersectionEvent<PointerEvent>) => {
			if (onPlacementPointerDown(event)) event.stopPropagation();
		},
		onpointerup: (event: IntersectionEvent<PointerEvent>) => {
			if (onPlacementPointerUp(event)) event.stopPropagation();
		}
	};
}

export function updatePlacementFromXZ(x: number, z: number) {
	updateFromHit(x, z);
	ui.placementTracking = true;
}

export function bindPlacementSession(): () => void {
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || !ui.placementDraft || ui.shellMode !== 'edit') return;
		event.preventDefault();
		cancelPlacement();
	};
	window.addEventListener('keydown', onKey);
	return () => window.removeEventListener('keydown', onKey);
}
