/**
 * Platform editing permissions — configured per deployment / URL, not ontology.
 *
 * Default: `shared` — any connected peer may author the scene in edit mode.
 * Strict: `?editing=owner` (alias `?perms=host`) — host-owned world entities only;
 * players remain collaboratively positionable (spawn layout).
 *
 * Play-mode simulation ownership (`world.isOwner`) is unchanged.
 */
import type { Entity } from '$lib/engine/ontology/schema';
import { isGroundEntity } from '$lib/engine/render/access';
import { isPlayerEntity } from '$lib/engine/player/access';

export type EditingPolicy = 'shared' | 'owner';

const DEFAULT: EditingPolicy = 'shared';

let mode: EditingPolicy = DEFAULT;

export function initEditingPolicy(search?: URLSearchParams) {
	const params =
		search ??
		new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
	const raw = params.get('editing') ?? params.get('perms');
	if (raw === 'owner' || raw === 'host') mode = 'owner';
	else mode = DEFAULT;
}

export function editingMode(): EditingPolicy {
	return mode;
}

export function sharedEditing(): boolean {
	return mode === 'shared';
}

/** Edit-mode select / transform / inspect (viewport + inspector). */
export function canAuthorEntity(
	entity: Entity,
	isOwner: (entityId: string) => boolean
): boolean {
	if (sharedEditing()) return true;
	if (isGroundEntity(entity)) return false;
	if (isPlayerEntity(entity)) return true;
	return isOwner(entity.id);
}

/** Realtime Transform edits replicated in shared edit mode (gizmo drags). */
export function collaborativeAuthoringField(
	entity: Entity,
	component: string,
	field: string
): boolean {
	if (!sharedEditing()) return false;
	if (component !== 'Transform') return false;
	return field === 'position' || field === 'rotation' || field === 'scale';
}

/** Inspector field editable for this entity in the current policy. */
export function canInspectField(entity: Entity, component: string, field: string): boolean {
	if (sharedEditing()) return true;
	if (!isPlayerEntity(entity)) return true;
	return component === 'Transform' && ['position', 'rotation', 'scale'].includes(field);
}
