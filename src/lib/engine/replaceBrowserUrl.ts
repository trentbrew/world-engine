/** Update the URL without navigation. No-op in Node/Bun; uses `history.replaceState` in browser. */
export function replaceBrowserUrl(url: URL | string): void {
	if (typeof window === 'undefined') return;
	history.replaceState(history.state, '', typeof url === 'string' ? url : url.href);
}
