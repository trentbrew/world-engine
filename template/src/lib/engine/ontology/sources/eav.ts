/**
 * EAV ↔ component-bag bridge. Trellis stores the durable graph as
 * entity-attribute-value triples; this engine speaks component-bag JSON-LD. The
 * mapping is direct because both are graphs of the same entities:
 *
 *   entity  → a node's `@id`
 *   attribute "Transform.position" → components.Transform.position
 *   attribute "conformsTo" / "@type" → the node's type fields
 *   attribute "Comp" (no dot) → the whole component object
 *
 * This is the concrete realization of "treat state as a graph linked to its game
 * object": a Trellis node *is* an entity; its attributes *are* its components.
 * The real Trellis client only needs to hand back triples in this shape (or call
 * `eavToGraph` itself).
 */
import type { JsonLdDoc, JsonLdNode } from '../source';
import { ensureEntityComponentBags, entityComponentBags } from '../source';

export interface EavTriple {
	entity: string;
	attribute: string;
	value: unknown;
}

export function eavToGraph(triples: EavTriple[]): JsonLdDoc {
	const nodes = new Map<string, JsonLdNode>();
	const nodeFor = (id: string): JsonLdNode => {
		let node = nodes.get(id);
		if (!node) {
			node = { '@id': id, components: {} };
			nodes.set(id, node);
		}
		return node;
	};

	for (const { entity, attribute, value } of triples) {
		const node = nodeFor(entity);
		if (attribute === '@type') {
			node['@type'] = value as string;
			continue;
		}
		if (attribute === 'conformsTo') {
			node.conformsTo = value as string;
			continue;
		}
		const dot = attribute.indexOf('.');
		if (dot === -1) {
			if (
				attribute === 'fields' ||
				attribute === 'defaults' ||
				attribute === 'components' ||
				attribute === 'children' ||
				attribute === 'name'
			) {
				(node as Record<string, unknown>)[attribute] = value;
			} else {
				const components = ensureEntityComponentBags(node);
				components[attribute] = (value ?? {}) as Record<string, unknown>;
			}
			continue;
		}
		const comp = attribute.slice(0, dot);
		const field = attribute.slice(dot + 1);
		const components = ensureEntityComponentBags(node);
		(components[comp] ??= {})[field] = value;
	}

	return { '@graph': [...nodes.values()] };
}

/** EAV attribute key for a component field (`Ground.color`). */
export function fieldAttribute(component: string, field: string): string {
	return `${component}.${field}`;
}

function normalizeStoredValue(value: unknown): unknown {
	if (Array.isArray(value)) return [...value];
	if (value && typeof value === 'object') {
		const v = value as { x?: number; y?: number; z?: number; w?: number };
		if ('x' in v || 'y' in v || 'z' in v) {
			return [v.x ?? 0, v.y ?? 0, v.z ?? 0, ...(v.w !== undefined ? [v.w] : [])].slice(0, 4);
		}
	}
	return value;
}

/**
 * Flatten a JSON-LD `@graph` into EAV triples (inverse of `eavToGraph`).
 * Schema/type nodes store top-level keys as undotted attributes.
 */
export function graphToEav(doc: JsonLdDoc): EavTriple[] {
	const triples: EavTriple[] = [];
	for (const node of doc['@graph'] ?? []) {
		const entity = node['@id'];
		if (!entity) continue;

		if (node['@type']) {
			triples.push({ entity, attribute: '@type', value: node['@type'] });
		}
		if (node.conformsTo) {
			triples.push({ entity, attribute: 'conformsTo', value: node.conformsTo });
		}

		for (const [key, value] of Object.entries(node)) {
			if (key === '@id' || key === '@type' || key === 'conformsTo' || key === 'components') continue;
			triples.push({ entity, attribute: key, value: normalizeStoredValue(value) });
		}

		const components = entityComponentBags(node);
		for (const [comp, data] of Object.entries(components)) {
			if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
			for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
				triples.push({
					entity,
					attribute: fieldAttribute(comp, field),
					value: normalizeStoredValue(value)
				});
			}
		}
	}
	return triples;
}
