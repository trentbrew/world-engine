<script lang="ts">
	import { sceneSettings } from '$lib/engine/scene/sceneSettings.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	$effect(() => {
		ui.scene.displayName;
		ui.scene.background;
		ui.scene.shadows;
		ui.scene.sky.enabled;
		ui.scene.sky.preset;
		ui.scene.sky.setEnvironment;
		ui.scene.groundGrid.enabled;
		ui.scene.groundGrid.cellSize;
		ui.scene.groundGrid.sectionSize;
		ui.scene.groundGrid.cellColor;
		ui.scene.groundGrid.sectionColor;
		// Deep-read the whole style subtree so any shader/art-style edit syncs.
		$state.snapshot(ui.scene.style);
		ui.grid.cellSize;
		ui.grid.sectionSize;
		ui.grid.fadeDistance;
		ui.grid.infinite;
		ui.grid.cellColor;
		ui.grid.sectionColor;
		ui.chrome.grid;
		ui.chrome.selectionOutline;
		ui.chrome.statsHud;
		ui.chrome.playToolbar;
		ui.playCameraDefault;
		sceneSettings.onLocalUiChange();
	});
</script>

