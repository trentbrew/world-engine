/**
 * Per-client avatar mesh preference (pause menu) — survives play reset / reload.
 */
import { world } from '$lib/engine/runtime/world.svelte';
import type { Entity } from '$lib/engine/ontology/schema';
import { applyPlayerAvatarMeshToEntity } from '$lib/engine/player/playerAvatarVisual';

const STORAGE_KEY = 'collab:player-avatar-mesh';

export function getStoredPlayerAvatarMesh(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(STORAGE_KEY);
}

export function setStoredPlayerAvatarMesh(meshUrl: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, meshUrl);
}

export function applyStoredPlayerAvatarMesh(entity: Entity): boolean {
	const mesh = getStoredPlayerAvatarMesh();
	if (!mesh) return false;
	return applyPlayerAvatarMeshToEntity(entity, mesh);
}

/** Re-apply stored mesh to the local player after play snapshot restore. */
export function reapplyStoredLocalPlayerAvatar(): boolean {
	const id = world.localPlayerId;
	if (!id) return false;
	const entity = world.getEntity(id);
	if (!entity) return false;
	if (!applyStoredPlayerAvatarMesh(entity)) return false;
	world.entities = [...world.entities];
	return true;
}
