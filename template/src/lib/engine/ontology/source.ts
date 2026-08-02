/**
 * WorldSource — the durable-tier seam. A source yields the JSON-LD document that
 * describes a world's *rules* (component schemas, entity types, instances). Today
 * that's a static file; tomorrow it's a Trellis query (see sources/trellis.ts).
 * Either way the engine only sees a JSON-LD `@graph`, so the durable backend is
 * swappable without touching the loader — mirroring the NetTransport seam.
 */

export interface JsonLdNode {
	'@id'?: string;
	'@type'?: string;
	conformsTo?: string;
	/** Entity instances: component bags. EntityType nodes: component name list. */
	components?: Record<string, Record<string, unknown>> | string[];
	defaults?: Record<string, Record<string, unknown>>;
	[key: string]: unknown;
}

/** Component bags on entity instances (not EntityType name lists). */
export function entityComponentBags(
	node: JsonLdNode
): Record<string, Record<string, unknown>> {
	const comps = node.components;
	if (!comps || Array.isArray(comps)) return {};
	return comps;
}

export function ensureEntityComponentBags(
	node: JsonLdNode
): Record<string, Record<string, unknown>> {
	if (!node.components || Array.isArray(node.components)) {
		node.components = {};
	}
	return node.components;
}

export interface JsonLdDoc {
	'@context'?: unknown;
	'@graph'?: JsonLdNode[];
}

export type WorldSource = () => Promise<JsonLdDoc>;

/** Loads a world from a static JSON-LD file under `static/`. */
export function staticSource(url = '/world.jsonld'): WorldSource {
	return async () => {
		const response = await fetch(url, { cache: 'no-store' });
		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}
		try {
			return (await response.json()) as JsonLdDoc;
		} catch {
			throw new Error(`Failed to parse ${url} as JSON`);
		}
	};
}

export interface PluginManifest {
	plugins?: string[];
}

export interface MergePluginsOptions {
	/** Injectable fetch for tests / server contexts. Defaults to global fetch. */
	fetchImpl?: typeof fetch;
	/** Base prefix for `/plugins/...` paths (empty = same origin). */
	base?: string;
}

/**
 * Merges installed plugin packs into a world document. Plugins live under
 * `static/plugins/` as `<id>.jsonld` fragments, discovered via
 * `manifest.json`. The merge is additive: plugin nodes (ComponentSchema,
 * EntityType, Things) are appended to the world `@graph` so the loader
 * registers and builds them exactly like world-authored nodes. A missing
 * manifest (no plugins installed) or a missing pack is a no-op, not an error.
 */
export async function mergePlugins(
	document: JsonLdDoc,
	opts: MergePluginsOptions = {}
): Promise<JsonLdDoc> {
	if (!document || !Array.isArray(document['@graph'])) return document;
	const { fetchImpl = fetch, base = '' } = opts;
	const get = async (path: string): Promise<unknown | null> => {
		try {
			const response = await fetchImpl(`${base}${path}`, { cache: 'no-store' });
			if (!response.ok) return null;
			return await response.json();
		} catch (err) {
			console.warn(`[plugins] could not load ${path}:`, err);
			return null;
		}
	};

	const manifest = (await get('/plugins/manifest.json')) as PluginManifest | null;
	const ids = manifest?.plugins;
	if (!Array.isArray(ids) || ids.length === 0) return document;

	const graph = [...document['@graph']];
	for (const id of ids) {
		const pack = (await get(`/plugins/${id}.jsonld`)) as JsonLdDoc | null;
		if (!pack || !Array.isArray(pack['@graph'])) {
			console.warn(`[plugins] pack "${id}" missing or empty, skipping`);
			continue;
		}
		graph.push(...pack['@graph']);
	}
	return { ...document, '@graph': graph };
}
