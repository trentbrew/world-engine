import { position } from '$lib/engine/render/access';
import { isPlayerEntity } from '$lib/engine/player/access';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import type { Entity } from '$lib/engine/ontology/schema';

/** Head height for player name tags — just above default mannequin crown. */
const PLAYER_NAME_TAG_Y = 1.2;

/** Lift above AABB top for props / portals (meters). */
const PROP_TOP_LIFT = 0.18;

/** True when a non-player entity has a registered render AABB (portal prompts need this). */
export function hasPromptBounds(entity: Entity): boolean {
	if (isPlayerEntity(entity)) return true;
	return !!renderBounds.get(entity.id);
}

/** World-space anchor above an entity for a peer name badge / portal prompt. */
export function badgeAnchorForEntity(entity: Entity): [number, number, number] {
	const pos = position(entity);

	if (isPlayerEntity(entity)) {
		return [pos[0], pos[1] + PLAYER_NAME_TAG_Y, pos[2]];
	}
	const bounds = renderBounds.get(entity.id);
	if (bounds) {
		return [
			pos[0] + bounds.center[0],
			pos[1] + bounds.center[1] + bounds.size[1] / 2 + PROP_TOP_LIFT,
			pos[2] + bounds.center[2]
		];
	}

	if ('Ground' in entity.components) {
		return [pos[0], pos[1] + 0.08, pos[2]];
	}

	if ('Marker' in entity.components) {
		return [pos[0], pos[1] + 0.9, pos[2]];
	}

	const scale = (entity.components.Transform as { scale?: number[] } | undefined)?.scale ?? [
		1, 1, 1
	];
	const halfY = Math.max(scale[1] ?? 1, 0.5) * 0.5 + PROP_TOP_LIFT;
	return [pos[0], pos[1] + halfY, pos[2]];
}
