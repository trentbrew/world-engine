/**
 * Dev HMR lifecycle — keep singleton runtime (input, scheduler, session) coherent
 * across Vite module swaps and WorldShell remounts.
 */
import { readShellModeFromUrl } from '$lib/engine/shellUrl';
import { primePlayMenuButtons, gamepad } from '$lib/engine/player/gamepad.svelte';
import { input } from '$lib/engine/player/input';
import { restoreEditorNavigation } from '$lib/engine/dev/editorSession';
import { ui } from '$lib/ui/ui.svelte';
import {
	bootstrapFormulas,
	reregisterSystemsForHmr,
	startSimulation,
	stopSimulation
} from '$lib/engine/systems';
import { scheduler } from '$lib/engine/systems/scheduler.svelte';

/** Play mode per URL — survives ui.svelte.ts module resets during HMR. */
function urlPlayMode(): boolean {
	return readShellModeFromUrl() === 'play';
}

/** True when the user is effectively in play (in-memory or URL). */
function effectivePlayMode(): boolean {
	return ui.shellMode === 'play' || urlPlayMode();
}

/** Restore shellMode from ?mode=play without enterPlay() side effects (snapshot, score, camera). */
function restoreShellModeFromUrl(): void {
	if (!urlPlayMode() || ui.shellMode === 'play') return;
	ui.shellMode = 'play';
	ui.modeMessage = ui.playPaused ? 'Paused' : 'Play mode';
}

/** Tear down play-mode listeners before a hot swap (WorldShell or leaf module). */
export function prepareRuntimeForHmr(): void {
	if (!import.meta.env.DEV) return;
	if (effectivePlayMode()) stopSimulation();
}

/** Re-wire input + scheduler after a hot swap without resetting play/edit chrome. */
export function rehydrateRuntimeAfterHmr(): void {
	if (!import.meta.env.DEV) return;

	reregisterSystemsForHmr();
	bootstrapFormulas();
	// Session-long pad presence — restore after HMR even when staying in edit.
	input.attachGamepad();
	gamepad.rehydrateAfterHmr();

	restoreShellModeFromUrl();
	restoreEditorNavigation();

	if (!effectivePlayMode()) return;

	primePlayMenuButtons();
	// Keyboard only — pad presence already restored above.
	input.detach();

	if (ui.playPaused) {
		input.attach();
		scheduler.start();
		scheduler.pause();
		return;
	}

	startSimulation();
}
