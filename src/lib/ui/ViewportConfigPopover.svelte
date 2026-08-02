<script lang="ts">
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { camera } from '$lib/engine/render/camera.svelte';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import {
		PLAY_VIEWPORT_ITEMS,
		viewportDebug,
		type PlayViewportToggleId
	} from '$lib/ui/viewportDebug.svelte';

	const hasPlayer = $derived(world.localPlayerId !== null);
	const canPickProjection = $derived(!worldProfile.is2d);

	function shortcutFor(id: PlayViewportToggleId): string {
		return PLAY_VIEWPORT_ITEMS.find((item) => item.id === id)?.shortcut ?? '';
	}
</script>

<Popover.Root>
	<Popover.Trigger
		class="config-trigger"
		aria-label="Viewport settings"
		title="Viewport settings"
	>
		<Settings2Icon class="config-icon" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Content side="top" align="start" class="config-panel">
		<Popover.Header>
			<Popover.Title>Viewport</Popover.Title>
			<Popover.Description>
				Play-mode overlays · keys 1–5 · Esc pauses
			</Popover.Description>
		</Popover.Header>

		<div class="option-list">
			<label class="option-row">
				<span class="option-copy">
					<span class="option-label">Colliders</span>
					<span class="option-hint">Rapier physics shapes</span>
				</span>
				<span class="option-controls">
					<kbd class="shortcut">{shortcutFor('colliders')}</kbd>
					<Switch
						checked={viewportDebug.showColliders}
						size="sm"
						onCheckedChange={(checked) => viewportDebug.setValue('colliders', checked)}
					/>
				</span>
			</label>

			<label class="option-row">
				<span class="option-copy">
					<span class="option-label">Wireframe</span>
					<span class="option-hint">Mesh triangles</span>
				</span>
				<span class="option-controls">
					<kbd class="shortcut">{shortcutFor('wireframe')}</kbd>
					<Switch
						checked={viewportDebug.wireframe}
						size="sm"
						onCheckedChange={(checked) => viewportDebug.setValue('wireframe', checked)}
					/>
				</span>
			</label>

			<label class="option-row">
				<span class="option-copy">
					<span class="option-label">Shadows</span>
					<span class="option-hint">Realtime shadow maps</span>
				</span>
				<span class="option-controls">
					<kbd class="shortcut">{shortcutFor('shadows')}</kbd>
					<Switch
						checked={ui.scene.shadows}
						size="sm"
						onCheckedChange={(checked) => viewportDebug.setValue('shadows', checked)}
					/>
				</span>
			</label>

			<label class="option-row">
				<span class="option-copy">
					<span class="option-label">Developer HUD</span>
					<span class="option-hint">Top-right stats box</span>
				</span>
				<span class="option-controls">
					<kbd class="shortcut">{shortcutFor('statsHud')}</kbd>
					<Switch
						checked={ui.chrome.statsHud}
						size="sm"
						onCheckedChange={(checked) => viewportDebug.setValue('statsHud', checked)}
					/>
				</span>
			</label>

			<label class="option-row">
				<span class="option-copy">
					<span class="option-label">Move jank</span>
					<span class="option-hint">Grounded flicker / Y smoothness</span>
				</span>
				<span class="option-controls">
					<kbd class="shortcut">{shortcutFor('jankHud')}</kbd>
					<Switch
						checked={viewportDebug.jankHud}
						size="sm"
						onCheckedChange={(checked) => viewportDebug.setValue('jankHud', checked)}
					/>
				</span>
			</label>
		</div>

		{#if hasPlayer}
			<div class="section">
				<p class="section-label">Camera</p>
				<div class="segmented" role="group" aria-label="Camera mode">
					<button
						type="button"
						class="segment"
						class:active={camera.mode === 'follow'}
						aria-pressed={camera.mode === 'follow'}
						onclick={() => camera.setMode('follow')}
					>
						Follow
					</button>
					<button
						type="button"
						class="segment"
						class:active={camera.mode === 'orbit'}
						aria-pressed={camera.mode === 'orbit'}
						onclick={() => camera.setMode('orbit')}
					>
						Orbit
					</button>
				</div>
			</div>
		{/if}

		{#if canPickProjection}
			<div class="section">
				<p class="section-label">Projection</p>
				<div class="segmented" role="group" aria-label="Camera projection">
					<button
						type="button"
						class="segment"
						class:active={camera.projection === 'perspective'}
						aria-pressed={camera.projection === 'perspective'}
						onclick={() => (camera.projection = 'perspective')}
					>
						Perspective
					</button>
					<button
						type="button"
						class="segment"
						class:active={camera.projection === 'orthographic'}
						aria-pressed={camera.projection === 'orthographic'}
						onclick={() => (camera.projection = 'orthographic')}
					>
						Orthographic
					</button>
				</div>
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>

<style>
	:global(.config-trigger) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--rounded-pill);
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		cursor: pointer;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.24);
		flex-shrink: 0;
	}

	:global(.config-trigger:hover) {
		background: var(--secondary);
	}

	:global(.config-trigger:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	:global(.config-icon) {
		width: 15px;
		height: 15px;
		opacity: 0.9;
	}

	:global(.config-panel) {
		width: 280px;
		padding: 12px;
		gap: 12px;
	}

	.option-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.option-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		cursor: pointer;
	}

	.option-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.option-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--foreground);
	}

	.option-hint {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.option-controls {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.shortcut {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 6px;
		border: 1px solid var(--border);
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--viewport) 50%, transparent);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
	}

	.section-label {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.segment {
		height: 28px;
		border: 1px solid var(--border);
		border-radius: var(--rounded-pill);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}

	.segment:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 55%, transparent);
	}

	.segment.active {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--primary-foreground);
		font-weight: 600;
	}
</style>

