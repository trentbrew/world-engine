/**
 * WebMCP registration — binds the tool manifest to `document.modelContext`.
 *
 * Headless agents use the same handlers via `executeWebMcpTool()` and join rooms
 * through `openHeadlessRoom()` — see `headlessRoom.ts` and `scripts/agent-room.ts`.
 *
 * See docs/webmcp.md (API) and docs/webmcp-tools.md (design).
 */
import { WEBMCP_TOOLS, type JsonSchema } from './manifest';
import { WEBMCP_HANDLERS, MAX_OUTPUT_CHARS, type ToolExecute } from './handlers';
import { webmcp } from './state.svelte';

export { MAX_OUTPUT_CHARS } from './handlers';
export { executeWebMcpTool, listWebMcpToolNames } from './execute';
export { probeWebMcpSupport } from './support';

type ModelContextTool = {
	name: string;
	title?: string;
	description: string;
	inputSchema?: JsonSchema;
	execute: ToolExecute;
	annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
};

type ModelContextLike = {
	registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void>;
};

function modelContext(): ModelContextLike | null {
	if (typeof document === 'undefined') return null;
	const ctx = (document as unknown as { modelContext?: ModelContextLike }).modelContext;
	return ctx && typeof ctx.registerTool === 'function' ? ctx : null;
}

export type RegisterResult = {
	/** False when the browser has no WebMCP support (origin trial / flag off). */
	supported: boolean;
	registered: string[];
	teardown: () => void;
};

/**
 * Register every manifest tool. Safe to call in browsers without WebMCP — it
 * reports `supported: false` and does nothing.
 */
export async function registerWebMcpTools(): Promise<RegisterResult> {
	const ctx = modelContext();
	if (!ctx) return { supported: false, registered: [], teardown: () => {} };

	const controller = new AbortController();
	const registered: string[] = [];

	for (const entry of WEBMCP_TOOLS) {
		const execute = WEBMCP_HANDLERS[entry.name];
		if (!execute) continue;
		try {
			await ctx.registerTool(
				{
					name: entry.name,
					title: entry.title,
					description: entry.description,
					inputSchema: entry.inputSchema,
					annotations: entry.annotations,
					execute
				},
				{ signal: controller.signal }
			);
			registered.push(entry.name);
		} catch (err) {
			console.warn(`[webmcp] could not register ${entry.name}`, err);
		}
	}

	return {
		supported: true,
		registered,
		teardown: () => controller.abort()
	};
}

let activeTeardown: (() => void) | null = null;

/** Abort any in-flight WebMCP registration from this module. */
export function teardownWebMcpRegistration(): void {
	activeTeardown?.();
	activeTeardown = null;
	webmcp.reset();
}

/**
 * Idempotent registration — tears down a prior pass before registering again.
 * Updates `webmcp` state. Safe to call after HMR or `?game=` navigation.
 */
export async function ensureWebMcpRegistered(): Promise<RegisterResult> {
	teardownWebMcpRegistration();
	const result = await registerWebMcpTools();
	activeTeardown = result.teardown;
	webmcp.setRegistrationResult(result.supported, result.registered);
	if (result.supported && result.registered.length > 0) {
		console.info(`[webmcp] registered ${result.registered.length} tools`);
	}
	return result;
}

/** Exposed for tests — the handler map, keyed by tool name. */
export const __handlers = WEBMCP_HANDLERS;
