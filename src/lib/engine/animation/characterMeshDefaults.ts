/**
 * Per-mesh defaults for rigged characters — animation catalog, rest clip, facing.
 * Only meshes listed in BY_BASENAME are "configured" for the pause-menu avatar picker.
 * Foreign skeletons must be retargeted at import — see docs/artifacts/m2m_character_import_spec.md.
 */
export type CharacterMeshDefaults = {
	catalog: string;
	clip: string;
	rig?: string;
	forwardYaw?: number;
	variant?: 'female';
};

/** Shared M2M human pack — ninja jump suite as default aerial / rest clips. */
export const DEFAULT_CHARACTER_DEFAULTS: CharacterMeshDefaults = {
	catalog: 'catalog:mesh2motion-human',
	clip: 'Idle_Loop',
	rig: 'human',
	forwardYaw: 0
};

/** Female-presenting mesh default — same M2M catalog; mesh retargeted separately. */
export const XBOT_CHARACTER_DEFAULTS: CharacterMeshDefaults = {
	...DEFAULT_CHARACTER_DEFAULTS,
	variant: 'female'
};

/**
 * Explicitly configured playable avatars (pause menu + spawn defaults).
 * Basename keys — path prefix does not matter.
 */
const BY_BASENAME: Record<string, CharacterMeshDefaults> = {
	'mannequin.glb': DEFAULT_CHARACTER_DEFAULTS,
	'player.glb': DEFAULT_CHARACTER_DEFAULTS,
	'xbot.glb': XBOT_CHARACTER_DEFAULTS
};

/** Defaults for a character mesh url, or undefined when not configured for play. */
export function characterDefaultsForMesh(mesh: string): CharacterMeshDefaults | undefined {
	const base = mesh.split('/').pop()?.toLowerCase() ?? '';
	return BY_BASENAME[base];
}

/** True when this mesh is an allowlisted playable avatar with animation defaults. */
export function isConfiguredAvatarMesh(mesh: string): boolean {
	return characterDefaultsForMesh(mesh) !== undefined;
}

/** Resolved defaults — mesh-specific or mesh2motion human fallback. */
export function resolveCharacterDefaults(mesh: string): CharacterMeshDefaults {
	return characterDefaultsForMesh(mesh) ?? DEFAULT_CHARACTER_DEFAULTS;
}
