/**
 * Merge SkinnedMesh / Mesh3DAnimator bags on player entities — shared by net
 * spawn heal, durable defineType, and the pause-menu avatar picker.
 */
import { resolveCharacterDefaults, isConfiguredAvatarMesh } from '$lib/engine/animation/characterMeshDefaults';
import { warmLocomotionPack } from '$lib/engine/player/playerLocomotionClips';
import { renderBounds } from '$lib/engine/render/renderBounds.svelte';
import type { Entity } from '$lib/engine/ontology/schema';

export const PLAYER_AVATAR_VISUAL_COMPONENTS = ['SkinnedMesh', 'Mesh3DAnimator'] as const;

export type PlayerAvatarVisualComponents = Partial<
	Record<(typeof PLAYER_AVATAR_VISUAL_COMPONENTS)[number], Record<string, unknown>>
>;

/** SkinnedMesh + Mesh3DAnimator field bags for a configured playable mesh. */
export function avatarVisualFieldsForMesh(meshUrl: string): PlayerAvatarVisualComponents | null {
	if (!isConfiguredAvatarMesh(meshUrl)) return null;
	const defaults = resolveCharacterDefaults(meshUrl);
	const skinned: Record<string, unknown> = { mesh: meshUrl };
	if (defaults.forwardYaw !== undefined) skinned.forwardYaw = defaults.forwardYaw;
	if (defaults.rig) skinned.rig = defaults.rig;
	return {
		SkinnedMesh: skinned,
		Mesh3DAnimator: {
			catalog: defaults.catalog,
			clip: defaults.clip
		}
	};
}

/** Fold incoming visual bags into a live player entity; returns true when changed. */
export function mergePlayerAvatarVisual(
	entity: Entity,
	incoming: PlayerAvatarVisualComponents
): boolean {
	let changed = false;
	for (const component of PLAYER_AVATAR_VISUAL_COMPONENTS) {
		const next = incoming[component];
		if (!next || Object.keys(next).length === 0) continue;
		const bag = entity.components[component];
		if (!bag) continue;
		const merged = { ...bag, ...next };
		if (JSON.stringify(merged) === JSON.stringify(bag)) continue;
		entity.components[component] = merged;
		changed = true;
		if (component === 'SkinnedMesh' && ('mesh' in next || 'anchor' in next)) {
			renderBounds.clear(entity.id);
		}
		if (component === 'Mesh3DAnimator' && ('catalog' in next || 'locomotion' in next)) {
			warmLocomotionPack(entity);
		}
	}
	return changed;
}

/** Apply a configured avatar mesh to one player entity (pause menu / stored pref). */
export function applyPlayerAvatarMeshToEntity(entity: Entity, meshUrl: string): boolean {
	const visual = avatarVisualFieldsForMesh(meshUrl);
	if (!visual) return false;
	return mergePlayerAvatarVisual(entity, visual);
}

/** Pick SkinnedMesh / Mesh3DAnimator from a net spawn component bag. */
export function playerAvatarVisualFromComponents(
	components: Record<string, Record<string, unknown> | undefined> | undefined
): PlayerAvatarVisualComponents {
	const out: PlayerAvatarVisualComponents = {};
	if (!components) return out;
	for (const component of PLAYER_AVATAR_VISUAL_COMPONENTS) {
		const bag = components[component];
		if (bag && Object.keys(bag).length > 0) out[component] = { ...bag };
	}
	return out;
}
