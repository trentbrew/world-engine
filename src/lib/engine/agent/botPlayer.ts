import { buildPlayer } from '$lib/engine/player/spawnPlayer';
import {
	playerEntityId,
	reconcilePlayerSpawnPositions,
	spawnPositionForClient
} from '$lib/engine/player/spawnPoints';
import { session } from '$lib/engine/net/session.svelte';
import { world } from '$lib/engine/runtime/world.svelte';
import { resolveActiveBot, type BotDef } from './bots';

const activeBots = new Map<string, BotDef>();

export function activeBotClientIds(): string[] {
	return [...activeBots.values()].map((b) => b.clientId).sort();
}

/** Roster for spawn slots — session members plus active bots. */
export function botSpawnRoster(sessionMembers: string[]): string[] {
	const merged = [...sessionMembers, ...activeBotClientIds()].filter(Boolean);
	return [...new Set(merged)].sort((a, b) => a.localeCompare(b));
}

export function getActiveBot(clientId: string): BotDef | null {
	return activeBots.get(clientId) ?? null;
}

export function isBotClientId(clientId: string): boolean {
	return activeBots.has(clientId);
}

export function spawnBotPlayer(bot: BotDef): void {
	if (!session.connected || !session.isHost) return;
	const entityId = playerEntityId(bot.clientId);
	if (world.getEntity(entityId)) return;

	activeBots.set(bot.clientId, bot);
	const roster = botSpawnRoster(session.members);
	const spawn = spawnPositionForClient(bot.clientId, roster);
	const entity = buildPlayer(bot.clientId, spawn);
	session.owners[entity.id] = session.clientId;
	world.spawn(entity);
	session.replicateSpawn(entity);
	reconcilePlayerSpawnPositions(roster);
}

export function despawnBotPlayer(clientId: string): void {
	const entityId = playerEntityId(clientId);
	if (world.getEntity(entityId)) {
		world.despawn(entityId);
		if (session.connected) session.despawnEntity(entityId);
	}
	delete session.owners[entityId];
	activeBots.delete(clientId);
}

export function despawnAllBots(): void {
	for (const clientId of [...activeBots.keys()]) {
		despawnBotPlayer(clientId);
	}
}

export function spawnAgentBotsIfEnabled(search?: URLSearchParams | string): void {
	const bot = resolveActiveBot(search);
	if (!bot) return;
	spawnBotPlayer(bot);
}

export function resyncBotSpawnPositions(): void {
	if (activeBots.size === 0) return;
	reconcilePlayerSpawnPositions(botSpawnRoster(session.members));
}
