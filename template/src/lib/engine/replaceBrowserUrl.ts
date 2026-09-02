import { browser } from '$app/environment';
import { replaceState } from '$app/navigation';

function isRouterNotReady(error: unknown): boolean {
	return error instanceof Error && error.message.includes('router is initialized');
}

/** Update the URL without navigation — SvelteKit-aware alternative to `history.replaceState`. */
export function replaceBrowserUrl(url: URL | string): void {
	if (!browser) return;

	try {
		replaceState(url, history.state);
	} catch (error) {
		// Startup helpers run before the client router is ready; native replace is fine here.
		if (isRouterNotReady(error)) {
			history.replaceState(history.state, '', url);
			return;
		}
		throw error;
	}
}
