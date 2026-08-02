/**
 * Avatar candidates for the play pause menu — only meshes with explicit
 * animation defaults in characterMeshDefaults (e.g. player.glb, mannequin.glb).
 */
import type { AssetEntry } from '$lib/assets/catalog';
import {
	isConfiguredAvatarMesh,
	resolveCharacterDefaults
} from '$lib/engine/animation/characterMeshDefaults';

export function isAvatarModelAsset(asset: AssetEntry): boolean {
	if (asset.kind !== 'models') return false;
	return isConfiguredAvatarMesh(asset.url);
}

export function avatarLabel(url: string): string {
	const base = url.split('/').pop() ?? url;
	return base.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ');
}

/** Apply mesh (+ catalog / facing hints) to the Player type — live-syncs the avatar. */
export function applyPlayerAvatarMesh(
	setTypeDefault: (typeName: string, component: string, field: string, value: unknown) => boolean,
	meshUrl: string
): boolean {
	if (!isConfiguredAvatarMesh(meshUrl)) return false;
	const ok = setTypeDefault('Player', 'SkinnedMesh', 'mesh', meshUrl);
	if (!ok) return false;
	const defaults = resolveCharacterDefaults(meshUrl);
	setTypeDefault('Player', 'Mesh3DAnimator', 'catalog', defaults.catalog);
	setTypeDefault('Player', 'Mesh3DAnimator', 'clip', defaults.clip);
	if (defaults.forwardYaw !== undefined) {
		setTypeDefault('Player', 'SkinnedMesh', 'forwardYaw', defaults.forwardYaw);
	}
	if (defaults.rig) {
		setTypeDefault('Player', 'SkinnedMesh', 'rig', defaults.rig);
	}
	return true;
}
