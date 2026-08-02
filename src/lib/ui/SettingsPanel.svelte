<script lang="ts">
	import { camera, DEFAULT_CONTROL_PREFS } from '$lib/engine/render/camera.svelte';
	import { formatBinding, primaryBinding } from '$lib/engine/input/shortcutBinding';
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import AppearanceSection from '$lib/ui/theme/AppearanceSection.svelte';
	import CollaborationSection from '$lib/ui/CollaborationSection.svelte';
	import InputShortcutsSection from '$lib/ui/InputShortcutsSection.svelte';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { ui, type SettingsTab } from '$lib/ui/ui.svelte';

	const tabs: { id: SettingsTab; label: string }[] = [
		{ id: 'input', label: 'Input' },
		{ id: 'camera', label: 'Camera' },
		{ id: 'shell', label: 'Shell' }
	];

	const gizmoShortcuts = $derived({
		translate: formatBinding(primaryBinding('gizmoTranslate', inputPrefs.shortcuts)),
		rotate: formatBinding(primaryBinding('gizmoRotate', inputPrefs.shortcuts)),
		scale: formatBinding(primaryBinding('gizmoScale', inputPrefs.shortcuts))
	});
</script>

<div class="settings-panel">
	<div class="tabs" role="tablist" aria-label="Settings sections">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={ui.settingsTab === tab.id}
				aria-selected={ui.settingsTab === tab.id}
				onclick={() => (ui.settingsTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if ui.settingsTab === 'input'}
		<div role="tabpanel" class="tab-panel">
			<InputShortcutsSection />
		</div>
	{:else if ui.settingsTab === 'camera'}
		<div role="tabpanel" class="tab-panel">
			<div class="panel-label">Defaults</div>
			<dl class="defaults-list">
				<div>
					<dt>Orbit speed</dt>
					<dd>{DEFAULT_CONTROL_PREFS.rotateSpeed}</dd>
				</div>
				<div>
					<dt>Zoom speed</dt>
					<dd>{DEFAULT_CONTROL_PREFS.dollySpeed}</dd>
				</div>
				<div>
					<dt>Edit mode camera</dt>
					<dd>Orbit</dd>
				</div>
				<div>
					<dt>Play mode camera</dt>
					<dd>Follow (when player exists)</dd>
				</div>
			</dl>
			<p class="hint">
				Transform keys: {gizmoShortcuts.translate} / {gizmoShortcuts.rotate} / {gizmoShortcuts.scale}
			</p>
		</div>
	{:else}
		<div role="tabpanel" class="tab-panel">
			<AppearanceSection />
			<CollaborationSection />
			<div class="setting-row">
				<div class="setting-copy">
					<span class="setting-label">Navigation rail</span>
					<span class="setting-hint">World route shortcuts</span>
				</div>
				<div class="seg-control" role="group" aria-label="Navigation rail position">
					<button
						type="button"
						class="seg-btn"
						class:active={ui.railPosition === 'left'}
						aria-pressed={ui.railPosition === 'left'}
						onclick={() => ui.setRailPosition('left')}
					>
						Left
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={ui.railPosition === 'bottom'}
						aria-pressed={ui.railPosition === 'bottom'}
						onclick={() => ui.setRailPosition('bottom')}
					>
						Bottom
					</button>
				</div>
			</div>
			<div class="check-row">
				<Switch
					checked={ui.chrome.statsHud}
					size="sm"
					onCheckedChange={(checked) => (ui.chrome.statsHud = checked)}
				/>
				<span>Developer HUD</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: var(--spacing-sm);
		border-bottom: 1px solid var(--border);
	}

	.tab {
		flex: 1;
		font-family: inherit;
		font-size: 11px;
		padding: 4px 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.tab.active {
		background: var(--card);
		color: var(--foreground);
	}

	.tab-panel {
		padding: var(--spacing-sm);
		overflow: auto;
		flex: 1;
		min-height: 0;
	}

	.panel-label {
		font-size: 11px;
		color: var(--muted-foreground);
		margin-bottom: var(--spacing-sm);
	}

	.mapping-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
		font-family: var(--font-mono);
	}

	.mapping-table th,
	.mapping-table td {
		text-align: left;
		padding: 4px 6px;
		border-bottom: 1px solid var(--border);
	}

	.mapping-table th {
		color: var(--muted-foreground);
		font-weight: 500;
	}

	.defaults-list {
		margin: 0;
		font-size: 12px;
	}

	.defaults-list div {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	.defaults-list dt {
		color: var(--muted-foreground);
	}

	.defaults-list dd {
		margin: 0;
	}

	.hint {
		margin-top: var(--spacing-sm);
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.check-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: var(--spacing-md) 0;
	}

	.setting-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.setting-label {
		font-size: 12px;
		color: var(--foreground);
	}

	.setting-hint {
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.seg-control {
		display: inline-flex;
		flex-shrink: 0;
		padding: 2px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 28%, transparent);
	}

	.seg-btn {
		font: 600 11px/1 inherit;
		padding: 6px 10px;
		border: 0;
		border-radius: calc(var(--radius-sm) - 2px);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.seg-btn.active {
		background: var(--card);
		color: var(--foreground);
		box-shadow: 0 1px 2px color-mix(in srgb, black 12%, transparent);
	}

	.seg-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}
</style>
