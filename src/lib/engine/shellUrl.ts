/** Persist edit/play/publish shell mode in the URL (`?mode=edit|play|publish`). */

import type { ShellMode } from '$lib/ui/ui.svelte';

export function readShellModeFromUrl(search?: URLSearchParams | string): ShellMode | null {
	const params =
		typeof search === 'string'
			? new URLSearchParams(search)
			: (search ??
				new URLSearchParams(typeof location !== 'undefined' ? location.search : ''));

	// Legacy `?play` (no value) — treat as play mode.
	if (params.has('play')) return 'play';

	const mode = params.get('mode');
	if (mode === 'edit' || mode === 'play' || mode === 'publish') return mode;
	return null;
}

/** Ensure `?mode=` is present; defaults to edit. Strips legacy `?play`. */
export function ensureShellModeInUrl(defaultMode: ShellMode = 'edit'): ShellMode {
	if (typeof location === 'undefined') return defaultMode;

	const url = new URL(location.href);
	const fromUrl = readShellModeFromUrl(url.searchParams);
	const mode = fromUrl ?? defaultMode;

	url.searchParams.delete('play');
	url.searchParams.set('mode', mode);

	if (url.toString() !== location.href) {
		history.replaceState(history.state, '', url);
	}

	return mode;
}

/** Update `?mode=` without reloading (tab share / bookmark friendly). */
export function syncShellModeToUrl(mode: ShellMode) {
	if (typeof location === 'undefined') return;

	const url = new URL(location.href);
	url.searchParams.delete('play');
	if (url.searchParams.get('mode') === mode) return;

	url.searchParams.set('mode', mode);
	history.replaceState(history.state, '', url);
}
