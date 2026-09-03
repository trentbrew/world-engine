import type { GroundState } from '$lib/engine/player/groundStore.svelte';
import { sampleTerrainKind } from '$lib/engine/player/terrainMath';
import { world } from '$lib/engine/runtime/world.svelte';

export interface SurfaceInfo {
	kind: string;
	sfxBase?: string;
	vol: number;
	variantCount: number;
}

/**
 * Resolve the surface the player is currently standing on.
 * Priority:
 *   1. Per-entity `Surface` component (world authors tag walkable entities).
 *   2. Deterministic Terrain heightmap sampler (reuses the exact same formula
 *      the renderer uses — visual, physics, and audio always agree).
 *   3. Default 'default' kind with no sound base.
 */
export function resolveSurfaceUnderFoot(groundStore: GroundState): SurfaceInfo {
	if (!groundStore.grounded) {
		return { kind: 'default', sfxBase: undefined, vol: 1, variantCount: 5 };
	}

	const playerEntity = world.getEntity(world.localPlayerId ?? '');
	const playerPos = (playerEntity?.components.Transform?.position ?? [0, 0, 0]) as [
		number,
		number,
		number
	];
	const px = playerPos[0];
	const pz = playerPos[2];

	// Path 1: per-entity Surface component (author-defined surface kind + SFX)
	for (const entity of world.entities) {
		if ('Surface' in entity.components) {
			const surf = entity.components.Surface as {
				kind: string;
				sfxBase?: string;
				sfxVol: number;
				variantCount: number;
			};
			return {
				kind: surf.kind,
				sfxBase: surf.sfxBase,
				vol: surf.sfxVol,
				variantCount: surf.variantCount
			};
		}
	}

	// Path 2: deterministic Terrain heightmap sampler
	// Reuses the exact same seeded noise function the renderer uses,
	// so visual, physics, and audio never disagree.
	let kind = 'default';
	let sfxBase: string | undefined;

for (const entity of world.entities) {
		if ('Terrain' in entity.components) {
			// Component bags hold unknown values at rest — coerce, and keep these
			// fallbacks identical to the Terrain schema defaults so audio samples the
			// same surface the renderer draws.
			const terrain = entity.components.Terrain as Record<string, unknown>;
			const num = (key: string, fallback: number) => Number(terrain[key] ?? fallback);
			kind = sampleTerrainKind(
				px,
				pz,
				{
					size: num('size', 60),
					segments: num('segments', 128),
					heightScale: num('heightScale', 4),
					baseHeight: num('baseHeight', 0),
					noiseScale: num('noiseScale', 0.05),
					octaves: num('octaves', 4),
					seed: num('seed', 1337)
				},
				groundStore.normal
			);
			sfxBase = undefined; // kind-mapping happens in the footstep system
			break;
		}
	}

	return { kind, sfxBase, vol: 1, variantCount: 5 };
}