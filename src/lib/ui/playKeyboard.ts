/** Keyboard shortcuts active while in play mode. */

import { isFormFieldFocused } from '$lib/ui/shellKeyboard';
import { ui } from '$lib/ui/ui.svelte';
import { viewportDebug } from '$lib/ui/viewportDebug.svelte';

export function handlePlayKeydown(event: KeyboardEvent): boolean {
	if (ui.shellMode !== 'play') return false;
	if (isFormFieldFocused()) return false;

	if (viewportDebug.toggleByShortcut(event.key)) {
		event.preventDefault();
		return true;
	}

	const key = event.key.toLowerCase();
	if (key === 'r') {
		ui.resetPlay();
		event.preventDefault();
		return true;
	}
	if (key === 'p') {
		ui.togglePlayPause();
		event.preventDefault();
		return true;
	}

	if (ui.playPaused) {
		if (event.key === 'ArrowUp') {
			viewportDebug.moveMenuSelection(-1);
			event.preventDefault();
			return true;
		}
		if (event.key === 'ArrowDown') {
			viewportDebug.moveMenuSelection(1);
			event.preventDefault();
			return true;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			viewportDebug.toggleMenuSelection();
			event.preventDefault();
			return true;
		}
	}

	return false;
}
