/**
 * Smoke: headless room loads a world and executes a WebMCP tool locally.
 * Relay join is optional — pass AGENT_RELAY_URL to verify connectivity.
 *
 * Run: pnpm test:agent-room
 */
import { openHeadlessRoom } from '$lib/engine/agent/headlessRoom';
import { executeWebMcpTool } from '$lib/engine/agent/webmcp/execute';
import { world } from '$lib/engine/runtime/world.svelte';

const relayUrl = process.env.AGENT_RELAY_URL;
const skipRelay = process.env.AGENT_ROOM_OFFLINE === '1';

let room: Awaited<ReturnType<typeof openHeadlessRoom>> | null = null;

try {
	if (skipRelay) {
		// Offline slice — load world only (mock session-less tool reads).
		const { loadOntology } = await import('$lib/engine/ontology/loadOntology');
		const { readFileSync } = await import('node:fs');
		const { resolve } = await import('node:path');
		const doc = JSON.parse(readFileSync(resolve(process.cwd(), 'static/games/orbit.jsonld'), 'utf8'));
		const entities = await loadOntology(() => Promise.resolve(doc));
		const { worldProfile } = await import('$lib/engine/world/worldProfile.svelte');
		worldProfile.hydrate(entities);
		world.setReady(entities, { skipAutoSelect: true });
	} else {
		room = await openHeadlessRoom({
			game: 'orbit',
			room: `smoke-${Date.now()}`,
			relayUrl,
			waitForRelay: Boolean(relayUrl)
		});
	}

	const before = world.entities.length;
	const listed = await executeWebMcpTool('list_entities', { limit: 5 });
	if (!listed.includes('entities')) {
		throw new Error(`list_entities unexpected output: ${listed.slice(0, 120)}`);
	}

	const spawned = await executeWebMcpTool('spawn_prop', {
		mesh: 'primitive:box',
		position: [0, 1, 0],
		label: 'agent-smoke'
	});
	if (!spawned.startsWith('Placed entity:prop/')) {
		throw new Error(`spawn_prop failed: ${spawned}`);
	}
	if (world.entities.length <= before) {
		throw new Error('spawn_prop did not add an entity to the local world');
	}

	console.log(
		`agent-room-smoke: PASS — ${world.entities.length} entities, relay=${room ? room.relayUrl : 'offline'}`
	);
} finally {
	room?.close();
}
