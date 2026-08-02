import { DEFAULT_PLAY_INPUT, parsePlayInput, type LocomotionSample, type PlayInputConfig } from './playInput';

const PLAY_INPUT_PREFS_KEY = 'engine:play-input-config';

function loadPlayInputPrefs(): PlayInputConfig {
	if (typeof localStorage === 'undefined') return structuredClone(DEFAULT_PLAY_INPUT);
	try {
		const raw = localStorage.getItem(PLAY_INPUT_PREFS_KEY);
		if (!raw) return structuredClone(DEFAULT_PLAY_INPUT);
		return parsePlayInput(JSON.parse(raw));
	} catch {
		return structuredClone(DEFAULT_PLAY_INPUT);
	}
}

function persistPlayInputPrefs(config: PlayInputConfig): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PLAY_INPUT_PREFS_KEY, JSON.stringify(config));
}

/** Scene play-input config — readable by systems without importing UI. */
class PlayInputState {
	config = $state<PlayInputConfig>(loadPlayInputPrefs());
	/** Latest local-player locomotion sample (play mode). */
	locomotion = $state<LocomotionSample>({ tier: 'idle', speed: 0, magnitude: 0 });

	savePrefs(): void {
		persistPlayInputPrefs(this.config);
	}

	applyConfig(next: PlayInputConfig, opts?: { persist?: boolean }) {
		this.config = next;
		if (opts?.persist !== false) this.savePrefs();
	}
}

export const playInputState = new PlayInputState();
