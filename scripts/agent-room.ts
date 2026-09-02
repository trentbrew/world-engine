#!/usr/bin/env tsx
/**
 * Headless room agent — MCP stdio server over the WebMCP tool surface.
 *
 * Joins a relay room, loads a static world, and exposes the same authoring tools
 * as the in-browser WebMCP registration. Edits replicate to every browser peer
 * in the same `?room=` via the existing durable/spawn wire messages.
 *
 * Usage:
 *   pnpm agent:room -- --game orbit --room orbit
 *   AGENT_RELAY_URL=wss://…/rt pnpm agent:room
 *
 * Wire into Cursor / Claude Desktop MCP config (stdio):
 *   { "command": "pnpm", "args": ["agent:room", "--", "--game", "orbit"] }
 */
import { runAgentRoomMcp } from '$lib/engine/agent/mcpServer';

function readArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
}

const game = readArg('--game') ?? process.env.AGENT_GAME ?? 'orbit';
const room = readArg('--room') ?? process.env.AGENT_ROOM;
const relayUrl = readArg('--relay') ?? process.env.AGENT_RELAY_URL;
const clientId = readArg('--client-id') ?? process.env.AGENT_CLIENT_ID;
const displayName = readArg('--name') ?? process.env.AGENT_NAME;

await runAgentRoomMcp({
	game,
	room,
	relayUrl,
	clientId,
	displayName
});
