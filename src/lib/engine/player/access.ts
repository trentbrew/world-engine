/** Player entity helpers — spawn ids, remote/local discrimination. */
import type { Entity } from '$lib/engine/ontology/schema';
import { canInspectField } from '$lib/engine/collab/editingPolicy';
import { world } from '$lib/engine/runtime/world.svelte';

const PLAYER_ID_PREFIX = 'entity:player/';

export function isPlayerEntity(entity: Entity): boolean {
	return 'Player' in entity.components;
}

/** Client id encoded in a spawned player entity id (`entity:player/{clientId}`). */
export function playerClientId(entity: Entity): string | null {
	if (!isPlayerEntity(entity)) return null;
	if (!entity.id.startsWith(PLAYER_ID_PREFIX)) return null;
	return entity.id.slice(PLAYER_ID_PREFIX.length);
}

/** A player avatar owned by another peer in this session. */
export function isRemotePlayerEntity(entity: Entity): boolean {
	if (!isPlayerEntity(entity)) return false;
	return entity.id !== world.localPlayerId;
}

const PEER_AUTHORING_TRANSFORM_FIELDS = new Set(['position', 'rotation']);

/** Transform fields any peer may author on a player avatar (edit mode). */
export function isPeerTransformAuthoring(
	entity: Entity,
	component: string,
	field: string
): boolean {
	if (!isPlayerEntity(entity)) return false;
	if (component !== 'Transform') return false;
	return PEER_AUTHORING_TRANSFORM_FIELDS.has(field);
}

/** Inspector fields shown as editable for the given entity. */
export function isPlayerInspectableField(
	entity: Entity,
	component: string,
	field: string
): boolean {
	return canInspectField(entity, component, field);
}
