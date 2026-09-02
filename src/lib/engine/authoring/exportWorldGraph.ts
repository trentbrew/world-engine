/**
 * Serialize the live world graph back to a portable JSON-LD document —
 * the publish/export seam for registry PRs and local downloads.
 */
import { entityToJsonDoc } from '$lib/engine/runtime/entityJson';
import {
	getComponent,
	getType,
	isBuiltinComponent,
	listComponents,
	listWorldTypes
} from '$lib/engine/ontology/registry';
import { getRoomCatalog, type RoomMeta } from '$lib/engine/ontology/roomCatalog';
import { getScriptCatalog, type ScriptDef } from '$lib/engine/ontology/scriptCatalog';
import type { Entity, EntityType } from '$lib/engine/ontology/schema';
import type { JsonLdDoc, JsonLdNode } from '$lib/engine/ontology/source';

const DEFAULT_CONTEXT: JsonLdDoc['@context'] = {
	'@vocab': 'https://game.example/vocab/',
	conformsTo: { '@type': '@id' },
	components: { '@type': '@json' }
};

const EVENTS_CONTEXT = { events: { '@type': '@json' } } as const;

export type ExportWorldGraphOptions = {
	/** When set, only these entities are exported (players are always excluded). */
	entities?: Entity[];
};

function componentSchemaNode(name: string): JsonLdNode | null {
	const schema = getComponent(name);
	if (!schema || isBuiltinComponent(name)) return null;
	return {
		'@id': `component:${name}`,
		'@type': 'ComponentSchema',
		fields: structuredClone(schema.fields)
	};
}

function entityTypeNode(typeName: string): JsonLdNode | null {
	const type = getType(typeName);
	if (!type) return null;
	return entityTypeToGraphNode(type);
}

function entityTypeToGraphNode(type: EntityType): JsonLdNode {
	const node: JsonLdNode = {
		'@id': `type:${type.name}`,
		'@type': 'EntityType',
		components: [...type.components]
	};
	if (type.defaults && Object.keys(type.defaults).length > 0) {
		node.defaults = structuredClone(type.defaults);
	}
	if (type.events) node.events = structuredClone(type.events);
	if (type.collection) node.collection = true;
	if (type.collectionMeta) node.collectionMeta = structuredClone(type.collectionMeta);
	return node;
}

function roomMetaNode(room: RoomMeta): JsonLdNode {
	const node: JsonLdNode = {
		'@id': room.id,
		'@type': 'Room'
	};
	if (room.title) node.title = room.title;
	if (room.next) node.next = room.next;
	if (room.camera) node.camera = room.camera;
	if (room.layers) node.layers = [...room.layers];
	if (room.start) node.start = true;
	return node;
}

function scriptDefNode(script: ScriptDef): JsonLdNode {
	const node: JsonLdNode = {
		'@id': script.id,
		'@type': 'Script',
		actions: structuredClone(script.actions)
	};
	if (script.title) node.title = script.title;
	return node;
}

/** Serialize one runtime entity to a JSON-LD Thing node. */
export function entityToGraphNode(entity: Entity): JsonLdNode {
	const doc = entityToJsonDoc(entity);
	const node: JsonLdNode = {
		'@id': doc['@id'],
		'@type': 'Thing',
		components: structuredClone(doc.components)
	};
	if (doc.conformsTo) node.conformsTo = doc.conformsTo;
	if (entity.events) node.events = structuredClone(entity.events);
	if (entity.children?.length) node.children = [...entity.children];
	if (entity.raw && 'inRoom' in entity.raw) {
		node.inRoom = entity.raw.inRoom;
	}
	return node;
}

function isPlayerEntity(entity: Entity): boolean {
	return 'Player' in entity.components;
}

function exportableEntities(entities: Entity[]): Entity[] {
	return entities.filter((entity) => !isPlayerEntity(entity));
}

function graphHasEvents(nodes: JsonLdNode[]): boolean {
	return nodes.some((node) => node.events !== undefined);
}

/**
 * Build a JSON-LD world document from the current runtime state.
 * Schema/type nodes precede instances; room/script meta is included when installed.
 */
export function exportWorldGraph(opts: ExportWorldGraphOptions = {}): JsonLdDoc {
	const entities = exportableEntities(opts.entities ?? []);
	const graph: JsonLdNode[] = [];

	for (const name of listComponents()) {
		const node = componentSchemaNode(name);
		if (node) graph.push(node);
	}

	for (const typeName of listWorldTypes()) {
		const node = entityTypeNode(typeName);
		if (node) graph.push(node);
	}

	const roomCatalog = getRoomCatalog();
	if (roomCatalog) {
		for (const room of roomCatalog.rooms.values()) {
			graph.push(roomMetaNode(room));
		}
	}

	const scriptCatalog = getScriptCatalog();
	if (scriptCatalog) {
		for (const script of scriptCatalog.values()) {
			graph.push(scriptDefNode(script));
		}
	}

	for (const entity of entities) {
		graph.push(entityToGraphNode(entity));
	}

	const context: JsonLdDoc['@context'] = graphHasEvents(graph)
		? { ...(DEFAULT_CONTEXT as Record<string, unknown>), ...EVENTS_CONTEXT }
		: DEFAULT_CONTEXT;

	return { '@context': context, '@graph': graph };
}

export function exportWorldGraphJson(opts: ExportWorldGraphOptions = {}, indent = '\t'): string {
	return `${JSON.stringify(exportWorldGraph(opts), null, indent)}\n`;
}

/** Trigger a browser download of the exported world file. */
export function downloadWorldJsonld(
	doc: JsonLdDoc,
	filename = 'world.jsonld'
): void {
	if (typeof document === 'undefined') return;
	const slug = filename.endsWith('.jsonld') ? filename : `${filename}.jsonld`;
	const blob = new Blob([`${JSON.stringify(doc, null, '\t')}\n`], {
		type: 'application/ld+json'
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = slug;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function slugifyWorldFilename(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'world';
}
