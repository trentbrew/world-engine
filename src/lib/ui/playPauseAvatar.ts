/**
 * Avatar candidates for the play pause menu — only meshes with explicit
 * animation defaults in characterMeshDefaults (e.g. player.glb, mannequin.glb).
 */
import type { AssetEntry } from '$lib/assets/catalog';
import {
	isConfiguredAvatarMesh
} from '$lib/engine/animation/characterMeshDefaults';
import {
	applyPlayerAvatarMeshToEntity,
	avatarVisualFieldsForMesh
} from '$lib/engine/player/playerAvatarVisual';
import type { Entity } from '$lib/engine/ontology/schema';

export function isAvatarModelAsset(asset: AssetEntry): boolean {
	if (asset.kind !== 'models') return false;
	return isConfiguredAvatarMesh(asset.url);
}

export function avatarLabel(url: string): string {
	const base = url.split('/').pop() ?? url;
	return base.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ');
}

/** Apply mesh to one player entity (pause menu — per-client, not world type default). */
export function applyLocalPlayerAvatarMesh(entity: Entity, meshUrl: string): boolean {
	return applyPlayerAvatarMeshToEntity(entity, meshUrl);
}

/** Apply mesh (+ catalog / facing hints) to the Player type — GM / Objects UI. */
export function applyPlayerAvatarMesh(
	setTypeDefault: (typeName: string, component: string, field: string, value: unknown) => boolean,
	meshUrl: string
): boolean {
	const visual = avatarVisualFieldsForMesh(meshUrl);
	if (!visual) return false;
	const ok = setTypeDefault('Player', 'SkinnedMesh', 'mesh', meshUrl);
	if (!ok) return false;
	const anim = visual.Mesh3DAnimator;
	const skin = visual.SkinnedMesh;
	if (anim?.catalog) setTypeDefault('Player', 'Mesh3DAnimator', 'catalog', anim.catalog);
	if (anim?.clip) setTypeDefault('Player', 'Mesh3DAnimator', 'clip', anim.clip);
	if (skin?.forwardYaw !== undefined) {
		setTypeDefault('Player', 'SkinnedMesh', 'forwardYaw', skin.forwardYaw);
	}
	if (skin?.rig) setTypeDefault('Player', 'SkinnedMesh', 'rig', skin.rig);
	return true;
}
