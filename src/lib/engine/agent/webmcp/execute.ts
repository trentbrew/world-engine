import { defaultBrowserAgentContext } from '$lib/engine/agent/agentIdentity';
import type { AgentFocusContext } from '$lib/engine/agent/webmcp/focusWrap';
import { executeWithAgentFocus } from '$lib/engine/agent/webmcp/focusWrap';
import { WEBMCP_HANDLERS } from './handlers';
import { WEBMCP_TOOLS } from './manifest';

export type ExecuteWebMcpOptions = {
	signal?: AbortSignal;
	agent?: AgentFocusContext;
};

/** Invoke a manifest tool by name — used by MCP stdio and tests. */
export async function executeWebMcpTool(
	name: string,
	input: Record<string, unknown> = {},
	options: ExecuteWebMcpOptions = {}
): Promise<string> {
	const handler = WEBMCP_HANDLERS[name];
	if (!handler) return `Error: unknown tool "${name}"`;

	const signal = options.signal ?? new AbortController().signal;
	const agent =
		options.agent ??
		(typeof document !== 'undefined' ? defaultBrowserAgentContext() : undefined);

	const result = await executeWithAgentFocus(
		name,
		input,
		{ signal, agent },
		handler
	);
	return String(result ?? '');
}

/** Tool names with registered handlers, in manifest order. */
export function listWebMcpToolNames(): string[] {
	return WEBMCP_TOOLS.map((entry) => entry.name).filter((name) => name in WEBMCP_HANDLERS);
}
