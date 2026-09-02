import { WEBMCP_HANDLERS } from './handlers';
import { WEBMCP_TOOLS } from './manifest';

/** Invoke a manifest tool by name — used by MCP stdio and tests. */
export async function executeWebMcpTool(
	name: string,
	input: Record<string, unknown> = {},
	signal?: AbortSignal
): Promise<string> {
	const handler = WEBMCP_HANDLERS[name];
	if (!handler) return `Error: unknown tool "${name}"`;
	const result = await handler(input, { signal: signal ?? new AbortController().signal });
	return String(result ?? '');
}

/** Tool names with registered handlers, in manifest order. */
export function listWebMcpToolNames(): string[] {
	return WEBMCP_TOOLS.map((entry) => entry.name).filter((name) => name in WEBMCP_HANDLERS);
}
