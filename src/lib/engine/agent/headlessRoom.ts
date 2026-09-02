/**
 * Headless room client — load a world and join a relay room without a browser.
 *
 * Mutations go through the same WebMCP tool handlers as the in-browser surface,
 * so `spawn_prop` / `set_entity_field` replicate to every peer in the room via
 * the existing `t: 'durable'` / `t: 'spawn'` wire messages.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collab } from '$lib/engine/collab/collab.svelte';
import {
	connectHeadlessSession,
	disconnectHeadlessSession,
	headlessSessionActive
} from '$lib/engine/net/headlessSession';
import { RelayTransport } from '$lib/engine/net/relay';
import { loadOntology } from '$lib/engine/ontology/loadOntology';
import type { JsonLdDoc } from '$lib/engine/ontology/source';
import {
	clearRoomCatalog,
	installRoomCatalog,
	parseRoomCatalog
} from '$lib/engine/ontology/roomCatalog';
import {
	clearScriptCatalog,
	installScriptCatalog,
	parseScriptCatalog
} from '$lib/engine/ontology/scriptCatalog';
import { world } from '$lib/engine/runtime/world.svelte';
import { worldProfile } from '$lib/engine/world/worldProfile.svelte';

export const DEFAULT_HEADLESS_CLIENT_ID = 'bot:architect';

export type HeadlessRoomOptions = {
	/** `?game=` param — maps to `static/games/<game>.jsonld`. */
	game?: string;
	/** Multiplayer room id (defaults to the game name). */
	room?: string;
	/** Trellis relay base URL, e.g. `ws://localhost:8231/rt`. */
	relayUrl?: string;
	/** Stable peer id on the wire (default `bot:architect`). */
	clientId?: string;
	/** Display name for presence / edit toasts. */
	displayName?: string;
	/** Wait for relay WebSocket open before resolving (default true). */
	waitForRelay?: boolean;
};

export type HeadlessRoom = {
	game: string;
	room: string;
	clientId: string;
	relayUrl: string;
	close(): void;
};

function gameDocPath(game: string): string {
	const root = process.cwd();
	if (!game || game === 'sandbox' || game === 'default' || game === '_') {
		return resolve(root, 'static/world.jsonld');
	}
	return resolve(root, `static/games/${game}.jsonld`);
}

function loadGameDoc(game: string): JsonLdDoc {
	const path = gameDocPath(game);
	const raw = readFileSync(path, 'utf8');
	return JSON.parse(raw) as JsonLdDoc;
}

/** Read `static/` paths in Node — used for plugin merge during headless load. */
function staticFileFetch(input: string | URL | Request): Promise<Response> {
	const url =
		typeof input === 'string'
			? input
			: input instanceof Request
				? input.url
				: input.toString();
	const rel = url.replace(/^\/+/, '');
	const filePath = resolve(process.cwd(), 'static', rel);
	try {
		const body = readFileSync(filePath, 'utf8');
		return Promise.resolve(new Response(body, { status: 200 }));
	} catch {
		return Promise.resolve(new Response(null, { status: 404 }));
	}
}

export function resolveHeadlessRelayUrl(explicit?: string): string {
	const fromArg = explicit?.trim();
	if (fromArg) return fromArg;
	const fromEnv =
		process.env.AGENT_RELAY_URL?.trim() ||
		process.env.VITE_RELAY_URL?.trim() ||
		'ws://localhost:8231/rt';
	return fromEnv;
}

function waitForTransportReady(transport: RelayTransport, ms: number): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(ok);
		};
		transport.whenReady(() => finish(true));
		const timer = setTimeout(() => finish(false), ms);
	});
}

/**
 * Load a static world from disk and join a relay room as a headless peer.
 * Does not spawn a player avatar — use WebMCP tools to author the scene.
 */
export async function openHeadlessRoom(opts: HeadlessRoomOptions = {}): Promise<HeadlessRoom> {
	const game = opts.game?.trim() || 'orbit';
	const room = opts.room?.trim() || game;
	const relayUrl = resolveHeadlessRelayUrl(opts.relayUrl);
	const clientId = opts.clientId?.trim() || DEFAULT_HEADLESS_CLIENT_ID;
	const displayName = opts.displayName?.trim() || 'Architect';
	const waitForRelay = opts.waitForRelay !== false;

	if (headlessSessionActive()) {
		throw new Error('headless session already connected — call close() first');
	}

	const doc = loadGameDoc(game);
	const entities = await loadOntology(() => Promise.resolve(doc), {
		plugins: { fetchImpl: staticFileFetch }
	});
	const catalog = parseRoomCatalog(doc, entities);
	if (catalog) {
		installRoomCatalog(catalog);
		world.bindRoomCatalog(catalog, entities);
	} else {
		clearRoomCatalog();
		world.clearRoomCatalog();
	}
	const scripts = parseScriptCatalog(doc);
	if (scripts) installScriptCatalog(scripts);
	else clearScriptCatalog();

	worldProfile.hydrate(entities);
	world.setReady(entities, { skipAutoSelect: true });
	collab.setUsername(displayName);
	collab.initRoom(room, game);

	const transport = new RelayTransport(relayUrl, clientId);
	transport.connect(room);
	if (waitForRelay) {
		const ready = await waitForTransportReady(transport, 10_000);
		if (!ready) {
			transport.disconnect();
			throw new Error(`relay not reachable at ${relayUrl} (room: ${room})`);
		}
	}

	connectHeadlessSession(room, transport);

	return {
		game,
		room,
		clientId: transport.clientId,
		relayUrl,
		close() {
			disconnectHeadlessSession();
		}
	};
}
