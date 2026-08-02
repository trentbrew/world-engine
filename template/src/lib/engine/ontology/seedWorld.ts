import type { TrellisDb } from 'trellis/client/sdk';
import type { JsonLdDoc, JsonLdNode } from './source';

export const WORLD_BUNDLE_TYPE = 'WorldBundle';

/** Seed a tenant from static JSON-LD when no WorldBundle exists yet. */
export async function seedWorldIfEmpty(db: TrellisDb, seedDoc: JsonLdDoc): Promise<void> {
	const list = await db.list(WORLD_BUNDLE_TYPE, { limit: 1 });
	if ((list.total ?? list.data.length) > 0) return;
	await db.create(WORLD_BUNDLE_TYPE, { graph: seedDoc['@graph'] ?? [] });
}

export async function readWorldGraph(db: TrellisDb): Promise<JsonLdNode[]> {
	const list = await db.list(WORLD_BUNDLE_TYPE, { limit: 1 });
	const row = list.data[0];
	if (!row) return [];
	return (row.graph as JsonLdNode[] | undefined) ?? [];
}

export async function writeWorldGraph(db: TrellisDb, bundleId: string, graph: JsonLdNode[]): Promise<void> {
	await db.update(bundleId, { graph });
}

export async function getWorldBundleId(db: TrellisDb): Promise<string | null> {
	const list = await db.list(WORLD_BUNDLE_TYPE, { limit: 1 });
	return list.data[0]?.id ?? null;
}
