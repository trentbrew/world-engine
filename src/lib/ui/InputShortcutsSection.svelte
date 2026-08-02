<script lang="ts">
	import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
	import {
		formatBinding,
		primaryBinding,
		SHORTCUT_LABELS,
		type ShortcutAction
	} from '$lib/engine/input/shortcutBinding';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';

	const shortcutActions: ShortcutAction[] = [
		'togglePlay',
		'toggleSidebars',
		'undo',
		'redo',
		'copy',
		'paste',
		'duplicate',
		'cut',
		'delete',
		'gizmoTranslate',
		'gizmoRotate',
		'gizmoScale',
		'viewportPan'
	];

	const schemes = [
		{ id: 'studio' as const, label: 'Studio' },
		{ id: 'blender' as const, label: 'Blender' }
	];
</script>

<div class="input-section">
	<div class="panel-label">Viewport navigation</div>
	<div class="scheme-row" role="radiogroup" aria-label="Navigation scheme">
		{#each schemes as scheme (scheme.id)}
			<button
				type="button"
				role="radio"
				class="scheme-btn"
				class:active={inputPrefs.navigationScheme === scheme.id}
				aria-checked={inputPrefs.navigationScheme === scheme.id}
				onclick={() => inputPrefs.setNavigationScheme(scheme.id)}
			>
				{scheme.label}
			</button>
		{/each}
	</div>

	<div class="check-row">
		<Switch
			checked={inputPrefs.applyBlenderKeysWithScheme}
			size="sm"
			onCheckedChange={(checked) => inputPrefs.setApplyBlenderKeysWithScheme(checked)}
		/>
		<span>Use matching transform keys (M/R/S ↔ G/R/S)</span>
	</div>

	<dl class="gesture-list">
		<div>
			<dt>Orbit</dt>
			<dd>{inputPrefs.gestures.orbit}</dd>
		</div>
		<div>
			<dt>Pan</dt>
			<dd>{inputPrefs.gestures.pan}</dd>
		</div>
		<div>
			<dt>Zoom</dt>
			<dd>{inputPrefs.gestures.zoom}</dd>
		</div>
	</dl>

	<div class="panel-label shortcuts-label">Keyboard shortcuts</div>
	{#if inputPrefs.recordingAction}
		<p class="recording-hint">
			Press a key for <strong>{SHORTCUT_LABELS[inputPrefs.recordingAction]}</strong> — Esc to cancel
		</p>
	{/if}

	<table class="shortcut-table">
		<thead>
			<tr>
				<th>Action</th>
				<th>Binding</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each shortcutActions as action (action)}
				<tr class:recording={inputPrefs.recordingAction === action}>
					<td>{SHORTCUT_LABELS[action]}</td>
					<td>
						<kbd class="binding-kbd">{formatBinding(primaryBinding(action, inputPrefs.shortcuts))}</kbd>
					</td>
					<td>
						<Button
							variant="ghost"
							size="sm"
							class="change-btn"
							onclick={() => inputPrefs.startRecording(action)}
						>
							Change
						</Button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="actions-row">
		<Button variant="outline" size="sm" onclick={() => inputPrefs.resetShortcuts()}>
			Reset shortcuts
		</Button>
	</div>
</div>

<style>
	.input-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.panel-label {
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.shortcuts-label {
		margin-top: 4px;
	}

	.scheme-row {
		display: flex;
		gap: 6px;
	}

	.scheme-btn {
		flex: 1;
		font-family: inherit;
		font-size: 11px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.scheme-btn.active {
		background: var(--card);
		color: var(--foreground);
		border-color: var(--ring);
	}

	.check-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.gesture-list {
		margin: 0;
		font-size: 11px;
	}

	.gesture-list div {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	.gesture-list dt {
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.gesture-list dd {
		margin: 0;
		text-align: right;
	}

	.recording-hint {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.shortcut-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
	}

	.shortcut-table th,
	.shortcut-table td {
		text-align: left;
		padding: 4px 6px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}

	.shortcut-table th {
		color: var(--muted-foreground);
		font-weight: 500;
	}

	.shortcut-table tr.recording {
		background: color-mix(in srgb, var(--ring) 12%, transparent);
	}

	.binding-kbd {
		display: inline-block;
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 10px;
		background: var(--card);
	}

	:global(.change-btn) {
		font-size: 10px;
		height: 24px;
		padding: 0 6px;
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
	}
</style>
