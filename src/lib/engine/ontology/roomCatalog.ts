/**
 * Multi-room game catalog — Room meta nodes + per-room entity templates (TRL-133).
 */
import type { Entity } from './schema';
import type { JsonLdDoc, JsonLdNode } from './source';

export type RoomMeta = {
	id: string;
	title?: string;
	next?: string;
	camera?: string;
	layers?: string[];
	start?: boolean;
};

export type RoomCatalog = {
	rooms: Map<string, RoomMeta>;
	startRoomId: string;
	globals: Entity[];
	byRoom: Map<string, Entity[]>;
};

let installed: RoomCatalog | null = null;

export function normalizeRoomId(id: string): string {
	const trimmed = id.trim();
	if (!trimmed) return trimmed;
	return trimmed.startsWith('room:') ? trimmed : `room:${trimmed}`;
}

function isGlobalRoom(ref: unknown): boolean {
	if (ref === undefined || ref === null || ref === '*') return true;
	return false;
}

function roomRefFromEntity(entity: Entity): string | null {
	const raw = entity.raw?.inRoom;
	if (isGlobalRoom(raw)) return null;
	return normalizeRoomId(String(raw));
}

export function cloneEntityTemplate(template: Entity): Entity {
	return {
		id: template.id,
		type: template.type,
		components: structuredClone(template.components),
		formulas: template.formulas,
		events: template.events,
		children: template.children ? [...template.children] : undefined,
		raw: structuredClone(template.raw)
	};
}

export function parseRoomCatalog(doc: JsonLdDoc, entities: Entity[]): RoomCatalog | null {
	const graph = doc['@graph'];
	if (!Array.isArray(graph)) return null;

	const rooms = new Map<string, RoomMeta>();
	for (const node of graph) {
		if (node['@type'] !== 'Room' || !node['@id']) continue;
		const id = normalizeRoomId(String(node['@id']));
		rooms.set(id, {
			id,
			title: typeof node.title === 'string' ? node.title : undefined,
			next: typeof node.next === 'string' ? normalizeRoomId(node.next) : undefined,
			camera: typeof node.camera === 'string' ? node.camera : undefined,
			layers: Array.isArray(node.layers) ? (node.layers as string[]) : undefined,
			start: node.start === true
		});
	}

	if (rooms.size === 0) return null;

	let startRoomId = [...rooms.values()].find((room) => room.start)?.id;
	if (!startRoomId) startRoomId = [...rooms.keys()][0];

	const globals: Entity[] = [];
	const byRoom = new Map<string, Entity[]>();
	for (const roomId of rooms.keys()) byRoom.set(roomId, []);

	for (const entity of entities) {
		const roomId = roomRefFromEntity(entity);
		if (roomId === null) {
			globals.push(entity);
			continue;
		}
		if (!byRoom.has(roomId)) {
			console.warn(`[rooms] Entity ${entity.id} references unknown room "${roomId}"`);
			continue;
		}
		byRoom.get(roomId)!.push(entity);
	}

	return { rooms, startRoomId, globals, byRoom };
}

export function entitiesForRoom(roomId: string, catalog: RoomCatalog): Entity[] {
	const normalized = normalizeRoomId(roomId);
	if (!catalog.rooms.has(normalized)) return [];

	const roomEntities = catalog.byRoom.get(normalized) ?? [];
	return [...catalog.globals.map(cloneEntityTemplate), ...roomEntities.map(cloneEntityTemplate)];
}

export function installRoomCatalog(catalog: RoomCatalog | null): void {
	installed = catalog;
}

export function getRoomCatalog(): RoomCatalog | null {
	return installed;
}

export function clearRoomCatalog(): void {
	installed = null;
}

/** Skip Room meta nodes during entity hydration. */
export function isRoomMetaNode(node: JsonLdNode): boolean {
	return node['@type'] === 'Room';
}
