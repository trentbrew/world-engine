import { displayNameForBot, resolveActiveBot } from '$lib/engine/agent/bots';

const PLATFORM_NAMES: Record<string, string> = {
	cursor: 'Cursor',
	chatgpt: 'ChatGPT',
	chrome: 'Chrome',
	openai: 'ChatGPT',
	architect: 'Architect',
	agent: 'Agent'
};

function readEnvLabel(): string | null {
	if (typeof import.meta === 'undefined') return null;
	const raw = import.meta.env?.VITE_AGENT_LABEL;
	return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function readEnvAgentId(): string | null {
	if (typeof import.meta === 'undefined') return null;
	const raw = import.meta.env?.VITE_AGENT_ID;
	return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function slugFromAgentId(agentId: string): string {
	const tail = agentId.includes(':') ? agentId.slice(agentId.indexOf(':') + 1) : agentId;
	return tail.toLowerCase();
}

/** Resolve a human-readable agent label from id + optional explicit override. */
export function resolveAgentDisplayName(
	agentId: string,
	explicitDisplayName?: string
): string {
	const explicit = explicitDisplayName?.trim();
	if (explicit) return explicit;

	const botName = displayNameForBot(agentId);
	if (botName) return botName;

	const activeBot = resolveActiveBot();
	if (activeBot) return activeBot.displayName;

	const slug = slugFromAgentId(agentId);
	if (PLATFORM_NAMES[slug]) return PLATFORM_NAMES[slug]!;

	const envLabel = readEnvLabel();
	if (envLabel) return envLabel;

	return 'Agent';
}

/** Default in-browser WebMCP agent id. */
export function defaultBrowserAgentId(): string {
	return readEnvAgentId() ?? 'agent:chrome';
}

export function defaultBrowserAgentContext(): { agentId: string; displayName: string } {
	const agentId = defaultBrowserAgentId();
	return { agentId, displayName: resolveAgentDisplayName(agentId) };
}
