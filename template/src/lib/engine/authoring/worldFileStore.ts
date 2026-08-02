import { readFile, writeFile } from 'node:fs/promises';
import { applyDurablePatchToGraph } from '$lib/engine/durable/graphDiff';
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import { getType } from '$lib/engine/ontology/registry';
import type { JsonLdDoc, JsonLdNode } from '$lib/engine/ontology/source';
import { entityComponentBags } from '$lib/engine/ontology/source';
import { nextPasteId } from '$lib/engine/runtime/entityIds';
import { gameFilePath } from './worldPaths';

export async function readWorldFile(game?: string): Promise<JsonLdDoc> {
	const path = gameFilePath(game);
	const text = await readFile(path, 'utf8');
	return JSON.parse(text) as JsonLdDoc;
}

export async function writeWorldFile(game: string | undefined, doc: JsonLdDoc): Promise<void> {
	const path = gameFilePath(game);
	const body = `${JSON.stringify(doc, null, '\t')}\n`;
	await writeFile(path, body, 'utf8');
}

export async function applyPatchToWorldFile(
	game: string | undefined,
	patch: DurablePatch
): Promise<JsonLdDoc> {
	const doc = await readWorldFile(game);
	const graph = [...(doc['@graph'] ?? [])];
	applyDurablePatchToGraph(graph, patch);
	doc['@graph'] = graph;
	await writeWorldFile(game, doc);
	return doc;
}

export function listEntityNodes(graph: JsonLdNode[]): JsonLdNode[] {
	return graph.filter(
		(node) => node['@id'] && node['@type'] !== 'EntityType' && node['@type'] !== 'ComponentSchema'
	);
}

export function findEntityNode(graph: JsonLdNode[], entityId: string): JsonLdNode | undefined {
	return graph.find((node) => node['@id'] === entityId);
}

export function deleteEntityFromGraph(graph: JsonLdNode[], entityId: string): boolean {
	const index = graph.findIndex((node) => node['@id'] === entityId);
	if (index < 0) return false;
	graph.splice(index, 1);
	return true;
}

export function buildSpawnEntityNode(
	graph: JsonLdNode[],
	opts: {
		type: string;
		position: [number, number, number];
		id?: string;
		overrides?: Record<string, Record<string, unknown>>;
	}
): JsonLdNode {
	const typeDef = getType(opts.type);
	const ids = new Set(
		graph.map((node) => node['@id']).filter((id): id is string => typeof id === 'string')
	);
	const slug = opts.type.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	const baseId = opts.id ?? `entity:${slug}/new`;
	const entityId = ids.has(baseId) ? nextPasteId(baseId, ids) : baseId;

	const components: Record<string, Record<string, unknown>> = {};
	if (typeDef) {
		for (const component of typeDef.components) {
			const defaults = typeDef.defaults?.[component];
			components[component] = defaults ? structuredClone(defaults) : {};
		}
	}
	components.Transform = {
		...(components.Transform ?? {}),
		position: [...opts.position]
	};
	if (opts.overrides) {
		for (const [component, bag] of Object.entries(opts.overrides)) {
			components[component] = { ...(components[component] ?? {}), ...structuredClone(bag) };
		}
	}

	return {
		'@id': entityId,
		'@type': 'Thing',
		conformsTo: opts.type,
		components
	};
}

export async function spawnEntityInWorldFile(
	game: string | undefined,
	opts: {
		type: string;
		position: [number, number, number];
		id?: string;
		overrides?: Record<string, Record<string, unknown>>;
	}
): Promise<{ doc: JsonLdDoc; entity: JsonLdNode }> {
	const doc = await readWorldFile(game);
	const graph = [...(doc['@graph'] ?? [])];
	const entity = buildSpawnEntityNode(graph, opts);
	graph.push(entity);
	doc['@graph'] = graph;
	await writeWorldFile(game, doc);
	return { doc, entity };
}

export function entityJson(node: JsonLdNode): Record<string, unknown> {
	return {
		id: node['@id'],
		type: node.conformsTo,
		components: entityComponentBags(node)
	};
}
