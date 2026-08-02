import type { JsonLdDoc, JsonLdNode } from '$lib/engine/ontology/source';
import type { EntityEvents, FieldSchema } from '$lib/engine/ontology/schema';
import { ensureEntityComponentBags, entityComponentBags } from '$lib/engine/ontology/source';
import { SCENE_SETTINGS_ENTITY_ID } from '$lib/engine/scene/sceneConstants';
import { fieldAttribute } from '$lib/engine/ontology/sources/eav';
import { isDurableField } from '$lib/engine/ontology/syncPolicy';
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import { patchKind } from '$lib/engine/ontology/durablePatch';
import { durableBagOnly } from '$lib/engine/ontology/durableBag';

function ensureEntityNode(graph: JsonLdNode[], entityId: string): JsonLdNode | undefined {
	let node = graph.find((n) => n['@id'] === entityId);
	if (!node && entityId === SCENE_SETTINGS_ENTITY_ID) {
		node = { '@id': entityId, '@type': 'Thing', components: {} };
		graph.push(node);
	}
	return node;
}

/** Apply a durable mutation to an in-memory world graph. */
export function applyDurablePatchToGraph(graph: JsonLdNode[], patch: DurablePatch): void {
	switch (patchKind(patch)) {
		case 'setField': {
			if (!('field' in patch)) return;
			const node = ensureEntityNode(graph, patch.entityId);
			if (!node) return;
			const bag = (ensureEntityComponentBags(node)[patch.component] ??= {}) as Record<
				string,
				unknown
			>;
			bag[patch.field] = patch.value;
			return;
		}
		case 'setComponent': {
			if (!('bag' in patch)) return;
			const node = ensureEntityNode(graph, patch.entityId);
			if (!node) return;
			ensureEntityComponentBags(node)[patch.component] = structuredClone(patch.bag);
			return;
		}
		case 'removeComponent': {
			if (!('component' in patch)) return;
			const node = graph.find((n) => n['@id'] === patch.entityId);
			if (!node?.components || Array.isArray(node.components)) return;
			delete node.components[patch.component];
			if (Object.keys(node.components).length === 0) delete node.components;
			return;
		}
		case 'setEntity': {
			if (patch.kind !== 'setEntity') return;
			// Create the node if absent — this is the record-create path.
			let node = graph.find((n) => n['@id'] === patch.entityId);
			if (!node) {
				node = { '@id': patch.entityId, '@type': 'Thing', components: {} };
				graph.push(node);
			}
			node.components = structuredClone(patch.components);
			if (patch.conformsTo !== undefined) node.conformsTo = patch.conformsTo;
			return;
		}
		case 'removeEntity': {
			if (patch.kind !== 'removeEntity') return;
			const index = graph.findIndex((n) => n['@id'] === patch.entityId);
			if (index >= 0) graph.splice(index, 1);
			return;
		}
		case 'defineType': {
			if (patch.kind !== 'defineType') return;
			const typeId = `type:${patch.name}`;
			const existing = graph.find((n) => n['@id'] === typeId);
			if (existing) {
				existing.components = [...patch.components];
				if (patch.defaults && Object.keys(patch.defaults).length > 0) {
					existing.defaults = structuredClone(patch.defaults);
				} else {
					delete existing.defaults;
				}
				if (patch.events && Object.keys(patch.events).length > 0) {
					existing.events = structuredClone(patch.events);
				} else {
					delete existing.events;
				}
				if (patch.collection) existing.collection = true;
				else delete existing.collection;
				if (patch.collectionMeta) existing.collectionMeta = structuredClone(patch.collectionMeta);
				else delete existing.collectionMeta;
				if (patch.applyToEntityId) {
					const entity = graph.find((n) => n['@id'] === patch.applyToEntityId);
					if (entity) entity.conformsTo = patch.name;
				}
				return;
			}
			const typeNode: JsonLdNode = {
				'@id': typeId,
				'@type': 'EntityType',
				components: [...patch.components]
			};
			if (patch.defaults && Object.keys(patch.defaults).length > 0) {
				typeNode.defaults = structuredClone(patch.defaults);
			}
			if (patch.events && Object.keys(patch.events).length > 0) {
				typeNode.events = structuredClone(patch.events);
			}
			if (patch.collection) typeNode.collection = true;
			if (patch.collectionMeta) typeNode.collectionMeta = structuredClone(patch.collectionMeta);
			graph.push(typeNode);
			if (patch.applyToEntityId) {
				const entity = graph.find((n) => n['@id'] === patch.applyToEntityId);
				if (entity) entity.conformsTo = patch.name;
			}
			return;
		}
		case 'defineComponent': {
			if (patch.kind !== 'defineComponent') return;
			const compId = `component:${patch.name}`;
			const existing = graph.find((n) => n['@id'] === compId);
			if (existing) {
				existing.fields = structuredClone(patch.fields);
				return;
			}
			graph.push({
				'@id': compId,
				'@type': 'ComponentSchema',
				fields: structuredClone(patch.fields)
			});
			return;
		}
		case 'setEvents': {
			if (patch.kind !== 'setEvents') return;
			const node = ensureEntityNode(graph, patch.entityId);
			if (!node) return;
			const events = patch.events;
			if (!events || Object.keys(events).length === 0) delete node.events;
			else node.events = structuredClone(events);
			return;
		}
	}
}

/** @deprecated use applyDurablePatchToGraph */
export function applyPatchToGraph(graph: JsonLdNode[], patch: DurablePatch): void {
	applyDurablePatchToGraph(graph, patch);
}

/** Diff two world graphs into durable patches. */
export function diffGraphToPatches(prev: JsonLdNode[], next: JsonLdNode[]): DurablePatch[] {
	const patches: DurablePatch[] = [];
	const prevById = new Map(prev.map((n) => [n['@id'], n]));

	for (const node of next) {
		const id = node['@id'];
		if (!id) continue;

		if (node['@type'] === 'EntityType') {
			if (!prevById.has(id)) {
				const name = id.replace(/^type:/, '');
				const comps = node.components;
				patches.push({
					kind: 'defineType',
					name,
					components: Array.isArray(comps) ? comps : [],
					defaults: node.defaults as Record<string, Record<string, unknown>> | undefined,
					events: node.events as EntityEvents | undefined,
					...(node.collection === true ? { collection: true } : {}),
					...(node.collectionMeta
						? { collectionMeta: node.collectionMeta as { icon?: string; plural?: string } }
						: {})
				});
			}
			continue;
		}

		if (node['@type'] === 'ComponentSchema') {
			const name = id.replace(/^component:/, '');
			const prev = prevById.get(id);
			const fields = node.fields as Record<string, unknown> | undefined;
			if (!fields) continue;
			if (!prev || JSON.stringify(prev.fields) !== JSON.stringify(fields)) {
				patches.push({
					kind: 'defineComponent',
					name,
					fields: structuredClone(fields) as Record<string, FieldSchema>
				});
			}
			continue;
		}

		const before = prevById.get(id);
		const beforeComps = before ? entityComponentBags(before) : {};
		const comps = entityComponentBags(node);

		for (const component of Object.keys(beforeComps)) {
			if (!(component in comps)) {
				patches.push({ kind: 'removeComponent', entityId: id, component });
			}
		}

		for (const [component, data] of Object.entries(comps)) {
			if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
			const prevBag = beforeComps[component] as Record<string, unknown> | undefined;
			const durableOnly = durableBagOnly(component, data as Record<string, unknown>);
			if (!prevBag && Object.keys(durableOnly).length > 0) {
				patches.push({ kind: 'setComponent', entityId: id, component, bag: durableOnly });
				continue;
			}
			for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
				if (!isDurableField(component, field, value)) continue;
				const old = (prevBag as Record<string, unknown> | undefined)?.[field];
				if (JSON.stringify(old) === JSON.stringify(value)) continue;
				patches.push({ entityId: id, component, field, value });
			}
		}

		const prevEvents = before?.events;
		const nextEvents = node.events;
		if (JSON.stringify(prevEvents ?? null) !== JSON.stringify(nextEvents ?? null)) {
			patches.push({
				kind: 'setEvents',
				entityId: id,
				events: (nextEvents as Record<string, unknown> | undefined) ?? {}
			});
		}

		const prevConforms = before?.conformsTo;
		const nextConforms = node.conformsTo;
		if (nextConforms !== undefined && prevConforms !== nextConforms) {
			const durableComps: Record<string, Record<string, unknown>> = {};
			for (const [name, bag] of Object.entries(comps)) {
				if (bag && typeof bag === 'object' && !Array.isArray(bag)) {
					durableComps[name] = durableBagOnly(name, bag as Record<string, unknown>);
				}
			}
			patches.push({
				kind: 'setEntity',
				entityId: id,
				conformsTo: nextConforms as string,
				components: durableComps
			});
		}
	}

	// Nodes present before but gone now — emit removeEntity (record deletes).
	const nextIds = new Set(next.map((n) => n['@id']).filter((id): id is string => Boolean(id)));
	for (const id of prevById.keys()) {
		if (id && !nextIds.has(id)) {
			patches.push({ kind: 'removeEntity', entityId: id });
		}
	}

	return patches;
}

export async function fetchSeedDoc(seedUrl: string): Promise<JsonLdDoc> {
	const response = await fetch(seedUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch seed ${seedUrl}: ${response.status}`);
	}
	return (await response.json()) as JsonLdDoc;
}

