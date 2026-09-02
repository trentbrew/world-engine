import { replaceBrowserUrl } from '$lib/engine/replaceBrowserUrl';

export type BotDef = {
	id: string;
	clientId: string;
	displayName: string;
	mesh: string;
	systemPrompt: string;
};

export const BRAVE_BOT: BotDef = {
	id: 'brave',
	clientId: 'bot:brave',
	displayName: 'Brave',
	mesh: '/models/player.glb',
	systemPrompt: `You are Brave, a friendly guide in a 3D museum world.
Keep replies short (1-3 sentences), conversational, and helpful.
You can see visitors walk up to talk; answer naturally without breaking immersion.`
};

const BOTS_BY_ID: Record<string, BotDef> = {
	brave: BRAVE_BOT
};

const BOTS_BY_CLIENT: Record<string, BotDef> = {
	[BRAVE_BOT.clientId]: BRAVE_BOT
};

/** Worlds that ship with Brave enabled by default (no `?agent=` required). */
export const AGENT_DEMO_GAME = 'agent-demo';

function readSearchParams(search?: URLSearchParams | string): URLSearchParams {
	if (typeof search === 'string') return new URLSearchParams(search);
	if (search) return search;
	if (typeof location !== 'undefined') return new URLSearchParams(location.search);
	return new URLSearchParams();
}

export function botById(id: string): BotDef | null {
	return BOTS_BY_ID[id] ?? null;
}

export function botByClientId(clientId: string): BotDef | null {
	return BOTS_BY_CLIENT[clientId] ?? null;
}

export function displayNameForBot(clientId: string): string | null {
	return botByClientId(clientId)?.displayName ?? null;
}

/** URL gate — `?agent=brave` enables the named bot. */
export function readAgentFromUrl(search?: URLSearchParams | string): string | null {
	const raw = readSearchParams(search).get('agent')?.trim();
	if (!raw) return null;
	return botById(raw) ? raw : null;
}

export function activeBotFromUrl(search?: URLSearchParams | string): BotDef | null {
	const id = readAgentFromUrl(search);
	return id ? botById(id) : null;
}

/** Resolve the active bot from `?agent=` or world defaults (e.g. agent-demo). */
export function resolveActiveBot(search?: URLSearchParams | string): BotDef | null {
	const explicit = activeBotFromUrl(search);
	if (explicit) return explicit;
	const params = readSearchParams(search);
	if (params.get('game') === AGENT_DEMO_GAME) return BRAVE_BOT;
	return null;
}

/** Keep `?agent=brave` in the URL when loading the agent demo world. */
export function ensureAgentForDemoGame(): void {
	if (typeof location === 'undefined') return;
	const url = new URL(location.href);
	if (url.searchParams.get('game') !== AGENT_DEMO_GAME) return;
	if (url.searchParams.get('agent') === BRAVE_BOT.id) return;
	url.searchParams.set('agent', BRAVE_BOT.id);
	replaceBrowserUrl(url);
}
