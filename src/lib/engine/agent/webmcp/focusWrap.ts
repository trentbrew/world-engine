import {
	broadcastAgentFocusWire,
	trackAgentFocus
} from '$lib/engine/agent/agentFocus.svelte';
import { resolveAgentDisplayName } from '$lib/engine/agent/agentIdentity';
import type { ToolExecute } from '$lib/engine/agent/webmcp/handlers';
import { WEBMCP_TOOLS } from '$lib/engine/agent/webmcp/manifest';

const SPAWN_TOOLS = new Set(['spawn_prop', 'spawn_character', 'spawn_from_type']);

const ENTITY_ID_RE = /entity:[^\s,]+/;

export type AgentFocusContext = {
	agentId: string;
	displayName?: string;
};

function toolReadOnly(name: string): boolean {
	const entry = WEBMCP_TOOLS.find((t) => t.name === name);
	return entry?.annotations?.readOnlyHint === true;
}

function isErrorResult(result: unknown): boolean {
	return typeof result === 'string' && result.startsWith('Error:');
}

/** Extract entity ids to highlight after a tool call. */
export function extractFocusEntityIds(
	name: string,
	input: Record<string, unknown>,
	result: unknown
): string[] {
	if (isErrorResult(result)) return [];

	const rawEntityId = input.entityId;
	if (typeof rawEntityId === 'string' && rawEntityId.trim()) {
		return [rawEntityId.trim()];
	}

	if (SPAWN_TOOLS.has(name) && typeof result === 'string') {
		const match = result.match(ENTITY_ID_RE);
		if (match) return [match[0]];
	}

	if (name === 'select_entity') {
		if (typeof rawEntityId === 'string' && rawEntityId.trim()) return [rawEntityId.trim()];
		return [];
	}

	return [];
}

function notifyFocus(
	context: AgentFocusContext | undefined,
	entityIds: string[]
): void {
	if (entityIds.length === 0 || !context?.agentId) return;

	const agentId = context.agentId;
	const displayName = resolveAgentDisplayName(agentId, context.displayName);

	if (typeof document === 'undefined') {
		broadcastAgentFocusWire({ agentId, displayName, entityIds });
		return;
	}

	trackAgentFocus({ agentId, displayName, entityIds });
}

/** Wrap a WebMCP handler with agent focus tracking on mutating tools. */
export async function executeWithAgentFocus(
	name: string,
	input: Record<string, unknown>,
	options: { signal: AbortSignal; agent?: AgentFocusContext },
	handler: ToolExecute
): Promise<unknown> {
	const result = await handler(input, { signal: options.signal });

	if (toolReadOnly(name) || isErrorResult(result)) return result;

	const entityIds = extractFocusEntityIds(name, input, result);
	notifyFocus(options.agent, entityIds);

	return result;
}
