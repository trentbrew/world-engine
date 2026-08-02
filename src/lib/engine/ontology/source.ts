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
