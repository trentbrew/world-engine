/** Play-mode viewport debug flags — persisted in localStorage (+ scene doc for HUD/shadows). */

import { ui } from '$lib/ui/ui.svelte';

const STORAGE_KEY = 'engine:play-viewport-prefs';

export type PlayViewportToggleId = 'colliders' | 'wireframe' | 'shadows' | 'statsHud' | 'jankHud';

export type PlayViewportItem = {
	id: PlayViewportToggleId;
	label: string;
	hint: string;
	shortcut: string;
};

export const PLAY_VIEWPORT_ITEMS: PlayViewportItem[] = [
	{ id: 'colliders', label: 'Colliders', hint: 'Rapier physics shapes', shortcut: '1' },
	{ id: 'wireframe', label: 'Wireframe', hint: 'Mesh triangles', shortcut: '2' },
	{ id: 'shadows', label: 'Shadows', hint: 'Realtime shadow maps', shortcut: '3' },
	{ id: 'statsHud', label: 'Developer HUD', hint: 'Top-left stats accordion', shortcut: '4' },
	{ id: 'jankHud', label: 'Move jank', hint: 'Top-left jank accordion', shortcut: '5' }
];

type StoredPrefs = {
	showColliders?: boolean;
	wireframe?: boolean;
	jankHud?: boolean;
};

function initialShowColliders(): boolean {
	if (typeof location === 'undefined') return false;
	const params = new URLSearchParams(location.search);
	return params.get('debug') === 'physics' || params.get('physicsDebug') === '1';
}

function loadStored(): StoredPrefs {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as StoredPrefs;
	} catch {
		return {};
	}
}

function persist(showColliders: boolean, wireframe: boolean, jankHud: boolean): void {
	if (typeof localStorage === 'undefined') return;
	const prefs: StoredPrefs = { showColliders, wireframe, jankHud };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const stored = loadStored();

class ViewportDebugState {
	showColliders = $state(
		typeof stored.showColliders === 'boolean' ? stored.showColliders : initialShowColliders()
	);
	wireframe = $state(typeof stored.wireframe === 'boolean' ? stored.wireframe : false);
	/** Movement smoothness overlay — default on in play so jank is visible while tuning. */
	jankHud = $state(typeof stored.jankHud === 'boolean' ? stored.jankHud : true);
	/** Selected row in the pause overlay (controller + keyboard nav). */
	menuIndex = $state(0);

	getValue(id: PlayViewportToggleId): boolean {
		switch (id) {
			case 'colliders':
				return this.showColliders;
			case 'wireframe':
				return this.wireframe;
			case 'shadows':
				return ui.scene.shadows;
			case 'statsHud':
				return ui.chrome.statsHud;
			case 'jankHud':
				return this.jankHud;
		}
	}

	setValue(id: PlayViewportToggleId, value: boolean): void {
		switch (id) {
			case 'colliders':
				this.showColliders = value;
				break;
			case 'wireframe':
				this.wireframe = value;
				break;
			case 'shadows':
				ui.scene.shadows = value;
				break;
			case 'statsHud':
				ui.chrome.statsHud = value;
				break;
			case 'jankHud':
				this.jankHud = value;
				break;
		}
		this.save();
	}

	toggle(id: PlayViewportToggleId): void {
		this.setValue(id, !this.getValue(id));
	}

	toggleByShortcut(key: string): boolean {
		const item = PLAY_VIEWPORT_ITEMS.find((row) => row.shortcut === key);
		if (!item) return false;
		this.toggle(item.id);
		return true;
	}

	save(): void {
		persist(this.showColliders, this.wireframe, this.jankHud);
	}

	clampMenuIndex(): void {
		const max = PLAY_VIEWPORT_ITEMS.length - 1;
		if (this.menuIndex < 0) this.menuIndex = max;
		if (this.menuIndex > max) this.menuIndex = 0;
	}

	moveMenuSelection(delta: number): void {
		this.menuIndex = (this.menuIndex + delta + PLAY_VIEWPORT_ITEMS.length) % PLAY_VIEWPORT_ITEMS.length;
	}

	toggleMenuSelection(): void {
		const item = PLAY_VIEWPORT_ITEMS[this.menuIndex];
		if (item) this.toggle(item.id);
	}

	resetMenu(): void {
		this.menuIndex = 0;
	}
}

export const viewportDebug = new ViewportDebugState();
