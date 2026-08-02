/** Per-user input preferences — navigation scheme + keyboard shortcuts. */

import {
	BLENDER_SHORTCUTS,
	bindingFromKeyboardEvent,
	cloneBindings,
	STUDIO_SHORTCUTS,
	type KeyBinding,
	type ShortcutAction,
	type ShortcutBindings
} from '$lib/engine/input/shortcutBinding';

export type NavigationScheme = 'studio' | 'blender';

export type GesturePreset = {
	label: string;
	orbit: string;
	pan: string;
	zoom: string;
};

export const NAVIGATION_PRESETS: Record<NavigationScheme, GesturePreset> = {
	studio: {
		label: 'Studio (Figma-style)',
		orbit: 'Left drag · ⌥ + two-finger trackpad',
		pan: 'Space + drag · two-finger trackpad',
		zoom: 'Scroll wheel · pinch · ⌘+scroll'
	},
	blender: {
		label: 'Blender',
		orbit: 'Middle drag · two-finger trackpad',
		pan: 'Shift + middle drag · Shift + two-finger trackpad',
		zoom: 'Scroll wheel · pinch · ⌘+scroll'
	}
};

const STORAGE_KEY = 'engine:input-prefs';

type StoredPrefs = {
	navigationScheme: NavigationScheme;
	shortcuts: ShortcutBindings;
	applyBlenderKeysWithScheme: boolean;
};

function defaultStored(): StoredPrefs {
	return {
		navigationScheme: 'studio',
		shortcuts: cloneBindings(STUDIO_SHORTCUTS),
		applyBlenderKeysWithScheme: true
	};
}

function loadStored(): StoredPrefs {
	if (typeof localStorage === 'undefined') return defaultStored();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultStored();
		const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
		return {
			navigationScheme: parsed.navigationScheme === 'blender' ? 'blender' : 'studio',
			shortcuts: parsed.shortcuts
				? { ...cloneBindings(STUDIO_SHORTCUTS), ...parsed.shortcuts }
				: cloneBindings(STUDIO_SHORTCUTS),
			applyBlenderKeysWithScheme: parsed.applyBlenderKeysWithScheme !== false
		};
	} catch {
		return defaultStored();
	}
}

function persist(state: StoredPrefs): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

class InputPrefsStore {
	navigationScheme = $state<NavigationScheme>('studio');
	shortcuts = $state<ShortcutBindings>(cloneBindings(STUDIO_SHORTCUTS));
	/** When true, picking Blender navigation also swaps transform keys to G/R/S. */
	applyBlenderKeysWithScheme = $state(true);
	/** Settings UI: which action is waiting for the next key press. */
	recordingAction = $state<ShortcutAction | null>(null);

	constructor() {
		const stored = loadStored();
		this.navigationScheme = stored.navigationScheme;
		this.shortcuts = stored.shortcuts;
		this.applyBlenderKeysWithScheme = stored.applyBlenderKeysWithScheme;
	}

	get gestures(): GesturePreset {
		return NAVIGATION_PRESETS[this.navigationScheme];
	}

	#save(): void {
		persist({
			navigationScheme: this.navigationScheme,
			shortcuts: this.shortcuts,
			applyBlenderKeysWithScheme: this.applyBlenderKeysWithScheme
		});
	}

	setNavigationScheme(scheme: NavigationScheme): void {
		this.navigationScheme = scheme;
		if (this.applyBlenderKeysWithScheme) {
			this.shortcuts =
				scheme === 'blender'
					? cloneBindings(BLENDER_SHORTCUTS)
					: cloneBindings(STUDIO_SHORTCUTS);
		}
		this.#save();
	}

	setApplyBlenderKeysWithScheme(enabled: boolean): void {
		this.applyBlenderKeysWithScheme = enabled;
		this.#save();
	}

	setBinding(action: ShortcutAction, binding: KeyBinding): void {
		this.shortcuts = {
			...this.shortcuts,
			[action]: [{ ...binding }]
		};
		this.#save();
	}

	resetShortcuts(): void {
		this.shortcuts =
			this.navigationScheme === 'blender'
				? cloneBindings(BLENDER_SHORTCUTS)
				: cloneBindings(STUDIO_SHORTCUTS);
		this.#save();
	}

	resetAll(): void {
		const defaults = defaultStored();
		this.navigationScheme = defaults.navigationScheme;
		this.shortcuts = defaults.shortcuts;
		this.applyBlenderKeysWithScheme = defaults.applyBlenderKeysWithScheme;
		this.recordingAction = null;
		this.#save();
	}

	startRecording(action: ShortcutAction): void {
		this.recordingAction = action;
	}

	cancelRecording(): void {
		this.recordingAction = null;
	}

	commitRecording(event: KeyboardEvent): boolean {
		if (!this.recordingAction) return false;
		if (event.key === 'Escape') {
			this.cancelRecording();
			event.preventDefault();
			return true;
		}

		const binding = bindingFromKeyboardEvent(event);
		if (!binding) return false;

		this.setBinding(this.recordingAction, binding);
		this.recordingAction = null;
		event.preventDefault();
		return true;
	}
}

export const inputPrefs = new InputPrefsStore();
