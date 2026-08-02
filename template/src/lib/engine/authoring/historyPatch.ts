import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import type { EntitySnapshot } from '$lib/engine/authoring/entitySnapshot';

export type SpawnEntityPatch = { kind: 'spawnEntity'; entity: EntitySnapshot };
export type DespawnEntityPatch = { kind: 'despawnEntity'; entityId: string };

export type HistoryPatch = DurablePatch | SpawnEntityPatch | DespawnEntityPatch;

export function isSpawnEntityPatch(patch: HistoryPatch): patch is SpawnEntityPatch {
	return 'kind' in patch && patch.kind === 'spawnEntity';
}

export function isDespawnEntityPatch(patch: HistoryPatch): patch is DespawnEntityPatch {
	return 'kind' in patch && patch.kind === 'despawnEntity';
}
