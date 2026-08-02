import type { Component } from 'svelte';
import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
import ListTreeIcon from '@lucide/svelte/icons/list-tree';
import BoxIcon from '@lucide/svelte/icons/box';
import ImageIcon from '@lucide/svelte/icons/image';
import MusicIcon from '@lucide/svelte/icons/music';
import FileIcon from '@lucide/svelte/icons/file';
import DatabaseIcon from '@lucide/svelte/icons/database';
import WorkflowIcon from '@lucide/svelte/icons/workflow';
import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
import { ui, type WorldRoute } from '$lib/ui/ui.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { getRoomCatalog } from '$lib/engine/ontology/roomCatalog';

/** Product stub until a games/worlds manager exists. */
export const PLAYLAB_LABEL = 'Playlab';

export type WorldNavItem = {
	id: WorldRoute;
	label: string;
	Icon: Component<{ class?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

export const WORLD_ROUTES: WorldNavItem[] = [
	{ id: 'graph', label: 'Graph', Icon: WorkflowIcon },
	{ id: 'models', label: 'Models', Icon: BoxIcon },
	{ id: 'textures', label: 'Textures', Icon: ImageIcon },
	{ id: 'audio', label: 'Audio', Icon: MusicIcon },
	{ id: 'files', label: 'Files', Icon: FileIcon },
	{ id: 'objects', label: 'Objects', Icon: ListTreeIcon },
	{ id: 'collections', label: 'Collections', Icon: DatabaseIcon },
	{ id: 'controls', label: 'Controls', Icon: Gamepad2Icon },
	{ id: 'rooms', label: 'Rooms', Icon: LayoutGridIcon }
];

/** Default rail order — Config is pinned separately at the end of the rail. */
export const DEFAULT_RAIL_ORDER: WorldRoute[] = WORLD_ROUTES.map((item) => item.id);

const WORLD_ROUTE_IDS = new Set<string>(DEFAULT_RAIL_ORDER);

export function normalizeRailOrder(raw: unknown): WorldRoute[] {
	const seen = new Set<WorldRoute>();
	const ordered: WorldRoute[] = [];
	if (Array.isArray(raw)) {
		for (const id of raw) {
			if (typeof id !== 'string' || !WORLD_ROUTE_IDS.has(id) || id === 'config') continue;
			const route = id as WorldRoute;
			if (seen.has(route)) continue;
			seen.add(route);
			ordered.push(route);
		}
	}
	for (const id of DEFAULT_RAIL_ORDER) {
		if (!seen.has(id)) ordered.push(id);
	}
	return ordered;
}

export function orderedWorldRoutes(order: readonly WorldRoute[]): WorldNavItem[] {
	const byId = new Map(WORLD_ROUTES.map((item) => [item.id, item]));
	return normalizeRailOrder(order)
		.map((id) => byId.get(id))
		.filter((item): item is WorldNavItem => item != null);
}

export function moveRailOrderItem(
	order: readonly WorldRoute[],
	fromId: WorldRoute,
	toId: WorldRoute
): WorldRoute[] {
	const next = normalizeRailOrder(order);
	const from = next.indexOf(fromId);
	if (from < 0 || fromId === toId) return next;
	const [item] = next.splice(from, 1);
	const insertAt = next.indexOf(toId);
	if (insertAt < 0) {
		next.push(item);
		return next;
	}
	next.splice(insertAt, 0, item);
	return next;
}
const ROUTE_LABELS: Record<WorldRoute, string> = {
	graph: 'Graph',
	models: 'Models',
	textures: 'Textures',
	audio: 'Audio',
	files: 'Files',
	objects: 'Objects',
	collections: 'Collections',
	controls: 'Controls',
	rooms: 'Rooms',
	config: 'Config'
};

export function worldRouteLabel(route: WorldRoute): string {
	return ROUTE_LABELS[route];
}

/** Active world-nav highlight — rail route only; left pane tabs never remap this. */
export function resolveActiveWorldRoute(): WorldRoute {
	if (ui.railRoute === 'object') return 'rooms';
	return ui.railRoute;
}

/** Strip the `room:` prefix and prettify a raw room id for display. */
function prettifyRoomId(id: string): string {
	const bare = id.replace(/^room:/, '');
	if (!bare) return id;
	return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Display label for the active room, or `null` when the game has no room
 * catalog. A single-room (or roomless) game is its own world, so the scene
 * crumb already represents it — only multi-room games surface a room crumb.
 */
export function resolveActiveRoomLabel(): string | null {
	const activeRoomId = world.activeRoomId;
	if (!activeRoomId) return null;
	const meta = getRoomCatalog()?.rooms.get(activeRoomId);
	return meta?.title?.trim() || prettifyRoomId(activeRoomId);
}
