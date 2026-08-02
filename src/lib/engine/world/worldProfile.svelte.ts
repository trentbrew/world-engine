import { camera } from '$lib/engine/render/camera.svelte';
import { ui } from '$lib/ui/ui.svelte';
import type { Entity } from '$lib/engine/ontology/schema';
import {
	DEFAULT_WORLD_PROFILE,
	is2dProfile,
	resolveWorldProfile,
	type WorldProfileData
} from './worldProfile';

class WorldProfileStore {
	profile = $state<WorldProfileData>({ ...DEFAULT_WORLD_PROFILE });

	get is2d(): boolean {
		return is2dProfile(this.profile);
	}

	/** Camera + scene rendering defaults for 2D worlds (safe on play/edit toggles). */
	apply2dViewerDefaults() {
		if (!this.is2d) return;
		camera.projection = 'orthographic';
		camera.setMode('orbit');
		ui.scene.sky.enabled = false;
		ui.scene.shadows = false;
		ui.scene.style.fog.enabled = false;
	}

	/** One-time chrome defaults when a 2D world loads (not on every mode toggle). */
	apply2dChromeDefaults() {
		if (!this.is2d) return;
		ui.chrome.grid = true;
		ui.scene.groundGrid.enabled = true;
		ui.grid.cellColor = '#2e2e3a';
		ui.grid.sectionColor = '#45455a';
		ui.scene.groundGrid.cellColor = '#2e2e3a';
		ui.scene.groundGrid.sectionColor = '#45455a';
	}

	/** Apply profile from loaded entities and sync viewer defaults (ortho for 2D worlds). */
	hydrate(entities: Entity[]) {
		this.profile = resolveWorldProfile(entities);
		this.apply2dViewerDefaults();
		this.apply2dChromeDefaults();
	}

	reset() {
		this.profile = { ...DEFAULT_WORLD_PROFILE };
	}
}

export const worldProfile = new WorldProfileStore();
