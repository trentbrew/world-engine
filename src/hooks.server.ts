import type { Handle } from '@sveltejs/kit';

/**
 * Assert origin isolation for WebMCP.
 *
 * `document.modelContext` is only exposed in origin-isolated documents — Chrome
 * disables it wherever `document.domain` could still be set. Browsers already
 * default to origin-keyed agent clusters here (verified: `originAgentCluster` is
 * true on the Vercel deployment), but the default is a moving target, so declare
 * it rather than depend on it.
 *
 * The header must be identical across every response from the origin; a mismatch
 * makes the browser keep the first value it saw and log a warning. Hence: set on
 * everything, unconditionally.
 *
 * See docs/webmcp.md — "Hard requirements".
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('Origin-Agent-Cluster', '?1');
	return response;
};
