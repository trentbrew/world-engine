<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import SaveIcon from '@lucide/svelte/icons/save';
	import { gamepad, getMappingTable } from '$lib/engine/player/gamepad.svelte';
	import {
		type LocomotionTier
	} from '$lib/engine/player/playInput';
	import { playInputState } from '$lib/engine/player/playInputState.svelte';
	import InputShortcutsSection from '$lib/ui/InputShortcutsSection.svelte';
	import { session } from '$lib/engine/net/session.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import CheckIcon from '@lucide/svelte/icons/check';

	type PanelTab = 'play' | 'editor';

	const tabs: { id: PanelTab; label: string }[] = [
		{ id: 'play', label: 'Play' },
		{ id: 'editor', label: 'Editor' }
	];

	let activeTab = $state<PanelTab>('play');

	const mappings = getMappingTable();

	const keyboardTierOptions: { value: Exclude<LocomotionTier, 'idle'>; label: string }[] = [
		{ value: 'walk', label: 'Walk' },
		{ value: 'jog', label: 'Jog' },
		{ value: 'run', label: 'Run' },
		{ value: 'sprint', label: 'Sprint' }
	];

	const padStatus = $derived.by(() => {
		if (gamepad.activeIndex !== null) {
			return gamepad.label ?? `Pad ${gamepad.activeIndex + 1}`;
		}
		if (gamepad.connected) {
			return `Waiting (member slot ${gamepad.memberSlot + 1})`;
		}
		return 'None detected';
	});

	function saveConfiguration() {
		gamepad.savePrefs();
		playInputState.savePrefs();
		toast.success('Control settings saved', { icon: CheckIcon, class: 'app-toast' });
	}
</script>

<aside class="controls-panel" aria-label="Controls">
	<div class="panel-header">
		<div class="section-label">Controls</div>
		<Button type="button" size="sm" variant="outline" class="save-btn" onclick={saveConfiguration}>
			<SaveIcon class="size-3.5" />
			Save
		</Button>
	</div>

	<div class="tabs" role="tablist" aria-label="Control sections">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={activeTab === tab.id}
				aria-selected={activeTab === tab.id}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div class="panel-body">
		{#if activeTab === 'play'}
			<section class="section">
				<div class="panel-label">Controller</div>
				<dl class="status-list">
					<div>
						<dt>Assigned</dt>
						<dd>{padStatus}</dd>
					</div>
					<div>
						<dt>Connected</dt>
						<dd>{gamepad.count}</dd>
					</div>
					<div>
						<dt>Member slot</dt>
						<dd>{gamepad.memberSlot + 1} of {Math.max(1, session.members.length)}</dd>
					</div>
				</dl>
				<p class="hint">Nth connected pad maps to the Nth room member (host = 1).</p>
			</section>

			<section class="section">
				<div class="panel-label">Calibration</div>
				<div class="slider-row">
					<Label for="pad-deadzone">Stick deadzone</Label>
					<Slider
						id="pad-deadzone"
						type="single"
						min={0.05}
						max={0.35}
						step={0.01}
						value={gamepad.deadzone}
						onValueChange={(value) => {
							gamepad.deadzone = value ?? gamepad.deadzone;
							gamepad.savePrefs();
						}}
					/>
					<span class="slider-val">{gamepad.deadzone.toFixed(2)}</span>
				</div>
				<div class="toggle-row">
					<Switch bind:checked={gamepad.invertStickX} onCheckedChange={() => gamepad.savePrefs()} size="sm" />
					<span>Invert move X</span>
				</div>
				<div class="toggle-row">
					<Switch bind:checked={gamepad.invertStickY} onCheckedChange={() => gamepad.savePrefs()} size="sm" />
					<span>Invert move Y</span>
				</div>
				<div class="toggle-row">
					<Switch bind:checked={gamepad.invertLookX} onCheckedChange={() => gamepad.savePrefs()} size="sm" />
					<span>Invert look X</span>
				</div>
				<div class="toggle-row">
					<Switch bind:checked={gamepad.invertLookY} onCheckedChange={() => gamepad.savePrefs()} size="sm" />
					<span>Invert look Y</span>
				</div>
			</section>

			<section class="section">
				<div class="panel-label">Keyboard locomotion</div>
				<div class="tier-row" role="radiogroup" aria-label="Default WASD tier">
					{#each keyboardTierOptions as opt (opt.value)}
						<button
							type="button"
							role="radio"
							class="tier-btn"
							class:active={playInputState.config.locomotion.keyboardTier === opt.value}
							aria-checked={playInputState.config.locomotion.keyboardTier === opt.value}
							onclick={() => {
								playInputState.applyConfig({
									...playInputState.config,
									locomotion: {
										...playInputState.config.locomotion,
										keyboardTier: opt.value
									}
								});
							}}
						>
							{opt.label}
						</button>
					{/each}
				</div>
				<p class="hint">
					Shift = sprint · Ctrl = walk · Alt = run. Default tier when no modifier is held.
				</p>
			</section>

			<section class="section">
				<div class="panel-label">Play mapping</div>
				<table class="mapping-table">
					<thead>
						<tr>
							<th>Control</th>
							<th>Source</th>
						</tr>
					</thead>
					<tbody>
						{#each mappings as row (row.control)}
							<tr>
								<td>{row.control}</td>
								<td>{row.source}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{:else}
			<InputShortcutsSection />
		{/if}
	</div>
</aside>

<style>
	.controls-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px 8px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		gap: 8px;
	}

	.save-btn {
		height: 26px;
		padding: 0 8px;
		font-size: 11px;
		gap: 4px;
	}

	.section-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.tab {
		flex: 1;
		font-family: inherit;
		font-size: 11px;
		padding: 5px 6px;
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

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 10px 12px 16px;
	}

	.section + .section {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.panel-label {
		font-size: 11px;
		color: var(--muted-foreground);
		margin-bottom: 8px;
	}

	.status-list {
		margin: 0;
		font-size: 12px;
	}

	.status-list div {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	.status-list dt {
		color: var(--muted-foreground);
	}

	.status-list dd {
		margin: 0;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.hint {
		margin: 8px 0 0;
		font-size: 11px;
		color: var(--muted-foreground);
		line-height: 1.4;
	}

	.slider-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 10px;
		align-items: center;
		margin-bottom: 10px;
	}

	.slider-row :global([data-slot='slider']) {
		grid-column: 1 / -1;
	}

	.slider-val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		padding: 4px 0;
	}

	.tier-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tier-btn {
		font-family: inherit;
		font-size: 11px;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.tier-btn.active {
		background: var(--card);
		color: var(--foreground);
		border-color: var(--ring);
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
		vertical-align: top;
	}

	.mapping-table th {
		color: var(--muted-foreground);
		font-weight: 500;
	}

	.mapping-table td:last-child {
		color: var(--muted-foreground);
	}
</style>
