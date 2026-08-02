<script lang="ts">
	import BoxIcon from '@lucide/svelte/icons/box';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		GAMES,
		currentGameParam,
		loadGame,
		recentGames,
		resolveGame,
		type GameEntry
	} from '$lib/engine/games';
	import { ui } from '$lib/ui/ui.svelte';

	type SceneFilter = 'all' | '2d' | '3d';

	interface Props {
		/** When true, hide logo and fill the left-pane picker row. */
		embedded?: boolean;
		/** Compact trigger for doc-bar breadcrumbs. */
		compact?: boolean;
	}

	let { embedded = false, compact = false }: Props = $props();

	let open = $state(false);
	let newSceneOpen = $state(false);
	let sceneFilter = $state<SceneFilter>('all');
	let triggerRef = $state<HTMLButtonElement | null>(null);

	const activeParam = $derived(currentGameParam() ?? '');

	const activeGame = $derived(resolveGame(activeParam || undefined));

	function sceneLabel(game: GameEntry): string {
		return game.param ? game.title : 'Sandbox';
	}

	const activeRoomLabel = $derived(
		ui.scene.displayName.trim() || sceneLabel(activeGame)
	);

	function sceneFile(game: GameEntry): string {
		return game.param ? `${game.param}.jsonld` : 'world.jsonld';
	}

	function commandValue(game: GameEntry): string {
		return `${game.title} ${game.param ?? 'sandbox'} ${sceneFile(game)} ${game.dimensions}`;
	}

	function dimensionLabel(game: GameEntry): string {
		return game.dimensions.toUpperCase();
	}

	function gameKey(game: GameEntry): string {
		return game.param ?? '';
	}

	function matchesFilter(game: GameEntry): boolean {
		return sceneFilter === 'all' || game.dimensions === sceneFilter;
	}

	const recentSceneGames = $derived.by(() => recentGames().filter(matchesFilter));
	const nonRecentGames = $derived.by(() => {
		const recentKeys = new Set(recentSceneGames.map(gameKey));
		return GAMES.filter((game) => matchesFilter(game) && !recentKeys.has(gameKey(game)));
	});
	const sceneGames = $derived(nonRecentGames.filter((game) => game.category !== 'demo'));
	const demoGames = $derived(nonRecentGames.filter((game) => game.category === 'demo'));

	function selectGame(param?: string) {
		if ((param ?? '') === activeParam) {
			closeAndFocusTrigger();
			return;
		}
		loadGame(param);
	}

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => triggerRef?.focus());
	}

	function newBlankScene() {
		open = false;
		newSceneOpen = true;
	}

	function createBlankScene(dimensions: '2d' | '3d') {
		newSceneOpen = false;
		loadGame(dimensions === '2d' ? 'blank2d' : 'blank');
	}
</script>

<div
	class="scene-selector"
	class:scene-selector--embedded={embedded}
	class:scene-selector--compact={compact}
>
	{#if !embedded && !compact}
		<div class="logo-mark" aria-hidden="true">
			<img class="logo-img" src="/logo.png" alt="" width="28" height="28" />
		</div>
	{/if}

	<Popover.Root bind:open>
		<Popover.Trigger bind:ref={triggerRef}>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					class="scene-trigger rounded-full"
					role="combobox"
					aria-expanded={open}
					aria-label={compact ? 'Select room' : 'Select scene'}
				>
					<BoxIcon class="scene-box-icon" aria-hidden="true" />
					<span class="scene-trigger-title">{activeRoomLabel}</span>
					{#if !compact}
						<span class:scene-badge-2d={activeGame.dimensions === '2d'} class="scene-badge">
							{dimensionLabel(activeGame)}
						</span>
					{/if}
					<ChevronsUpDownIcon class="scene-trigger-chevron" aria-hidden="true" />
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="scene-popover" align="start">
			<Command.Root class="scene-command">
				<Command.Input placeholder={compact ? 'Search rooms…' : 'Search scenes…'} />
				<div class="scene-filters" aria-label="Scene dimension filter">
					<button
						type="button"
						class:active={sceneFilter === 'all'}
						onclick={() => (sceneFilter = 'all')}
					>
						All
					</button>
					<button
						type="button"
						class:active={sceneFilter === '3d'}
						onclick={() => (sceneFilter = '3d')}
					>
						3D
					</button>
					<button
						type="button"
						class:active={sceneFilter === '2d'}
						onclick={() => (sceneFilter = '2d')}
					>
						2D
					</button>
				</div>
				<Command.List class="scene-list">
					<Command.Empty>{compact ? 'No room found.' : 'No scene found.'}</Command.Empty>
					{#if recentSceneGames.length > 0}
						<Command.Group heading="Recent" value="recent">
							{#each recentSceneGames as game (game.param ?? 'default')}
								<Command.Item
									value={`recent ${commandValue(game)}`}
									onSelect={() => selectGame(game.param)}
								>
									<BoxIcon class="scene-item-box" aria-hidden="true" />
									<span class="scene-option">
										<span class="scene-option-title">{sceneLabel(game)}</span>
										<span class="scene-option-file">{sceneFile(game)}</span>
									</span>
									<span class:scene-badge-2d={game.dimensions === '2d'} class="scene-badge">
										{dimensionLabel(game)}
									</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
					<Command.Group heading={compact ? 'Rooms' : 'Scenes'} value="scenes">
						{#each sceneGames as game (game.param ?? 'default')}
							<Command.Item
								value={commandValue(game)}
								onSelect={() => selectGame(game.param)}
							>
								<BoxIcon class="scene-item-box" aria-hidden="true" />
								<span class="scene-option">
									<span class="scene-option-title">{sceneLabel(game)}</span>
									<span class="scene-option-file">{sceneFile(game)}</span>
								</span>
								<span class:scene-badge-2d={game.dimensions === '2d'} class="scene-badge">
									{dimensionLabel(game)}
								</span>
							</Command.Item>
						{/each}
					</Command.Group>
					{#if demoGames.length > 0}
						<Command.Group heading="Demos" value="demos">
							{#each demoGames as game (game.param ?? 'default')}
								<Command.Item
									value={`demo ${commandValue(game)}`}
									onSelect={() => selectGame(game.param)}
								>
									<BoxIcon class="scene-item-box" aria-hidden="true" />
									<span class="scene-option">
										<span class="scene-option-title">{sceneLabel(game)}</span>
										<span class="scene-option-file">{sceneFile(game)}</span>
									</span>
									<span class:scene-badge-2d={game.dimensions === '2d'} class="scene-badge">
										{dimensionLabel(game)}
									</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				</Command.List>
				<div class="scene-footer">
					<button type="button" class="scene-new-btn" onclick={newBlankScene}>
						<PlusIcon class="size-3.5" aria-hidden="true" />
						{compact ? 'New room' : 'New blank scene'}
					</button>
				</div>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>

	{#if compact}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						type="button"
						variant="outline"
						size="icon"
						class="scene-new-room-btn rounded-full"
						aria-label="New room"
						onclick={newBlankScene}
					>
						<PlusIcon class="size-3.5" aria-hidden="true" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={6} class="text-xs">
				New room
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
</div>

<Dialog.Root bind:open={newSceneOpen}>
	<Dialog.Content resizable class="sm:max-w-[420px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title>{compact ? 'New room' : 'New blank scene'}</Dialog.Title>
			<Dialog.Description>
				Choose the coordinate system and camera defaults for the new
				{compact ? 'room' : 'scene'}.
			</Dialog.Description>
		</Dialog.Header>

		<div class="blank-scene-options">
			<button type="button" class="blank-scene-option" onclick={() => createBlankScene('3d')}>
				<span>
					<strong>{compact ? '3D room' : '3D scene'}</strong>
					<small>Ground plane, lights, spawn point, orbit camera.</small>
				</span>
				<span class="scene-badge">3D</span>
			</button>
			<button type="button" class="blank-scene-option" onclick={() => createBlankScene('2d')}>
				<span>
					<strong>{compact ? '2D room' : '2D scene'}</strong>
					<small>Side-view XY world, 2D camera profile, spawn point.</small>
				</span>
				<span class="scene-badge scene-badge-2d">2D</span>
			</button>
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (newSceneOpen = false)}>
				Cancel
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.scene-selector {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		padding-left: var(--spacing-sm);
	}

	.scene-selector--embedded {
		padding-left: 0;
		width: 100%;
	}

	.scene-selector--embedded :global(.scene-trigger) {
		max-width: none;
		width: 100%;
	}

	.scene-selector--compact {
		padding-left: 0;
		gap: 4px;
	}

	.scene-selector--compact :global(.scene-trigger) {
		height: var(--doc-bar-height);
		max-width: 150px;
		padding: 0 12px;
		gap: 6px;
		border-radius: var(--rounded-pill);
	}

	.scene-selector--compact :global(.scene-box-icon),
	.scene-selector--compact :global(.scene-trigger-chevron) {
		width: 13px;
		height: 13px;
	}

	:global(.scene-new-room-btn) {
		height: var(--doc-bar-height);
		width: var(--doc-bar-height);
		flex-shrink: 0;
		border-radius: var(--rounded-pill);
		background: var(--chrome-pill-bg);
		border-color: var(--border);
		color: var(--muted-foreground);
	}

	:global(.scene-new-room-btn:hover) {
		color: var(--foreground);
		background: var(--accent);
	}

	.logo-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	:global(.scene-trigger) {
		height: var(--doc-bar-height);
		min-width: 0;
		max-width: min(340px, 46vw);
		justify-content: flex-start;
		gap: 8px;
		padding: 0 12px;
		font-weight: 500;
		border-radius: var(--rounded-pill);
		background: var(--chrome-pill-bg);
		border-color: var(--border);
	}

	:global(.scene-box-icon) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		opacity: 0.72;
	}

	.scene-trigger-title {
		font-size: 12px;
		color: var(--foreground);
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}

	:global(.scene-trigger-chevron) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		margin-left: auto;
		opacity: 0.5;
	}

	:global(.scene-popover) {
		width: min(330px, calc(100vw - 24px));
		padding: 0;
		overflow: hidden;
	}

	:global(.scene-command) {
		display: flex;
		flex-direction: column;
		max-height: min(420px, 62vh);
	}

	:global(.scene-list) {
		flex: 1;
		min-height: 0;
		max-height: min(340px, 50vh);
		overflow-y: auto;
	}

	.scene-filters {
		display: flex;
		gap: 4px;
		padding: 6px 8px 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}

	.scene-filters button {
		height: 24px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		font-family: inherit;
		font-size: 11px;
		font-weight: 600;
		padding: 0 8px;
		cursor: pointer;
	}

	.scene-filters button:hover,
	.scene-filters button.active {
		background: var(--accent);
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 70%, transparent);
	}

	:global(.scene-item-box) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		opacity: 0.65;
	}

	.scene-option {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}

	.scene-option-title {
		font-size: 12px;
	}

	.scene-option-file {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.scene-badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 18px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
		background: color-mix(in srgb, var(--muted) 62%, transparent);
		color: var(--muted-foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.scene-badge-2d {
		background: color-mix(in srgb, #2f80ed 22%, var(--card));
		border-color: color-mix(in srgb, #2f80ed 48%, var(--border));
		color: color-mix(in srgb, #9dccff 82%, var(--foreground));
	}

	.scene-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--border);
		padding: 4px;
		background: color-mix(in srgb, var(--card) 40%, transparent);
	}

	.scene-new-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		height: 32px;
		border: none;
		border-radius: calc(var(--radius-sm) - 1px);
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.scene-new-btn:hover {
		background: var(--accent);
	}

	.scene-new-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.blank-scene-options {
		display: grid;
		gap: 10px;
		margin-top: 12px;
	}

	.blank-scene-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--card) 72%, transparent);
		color: var(--foreground);
		text-align: left;
		font-family: inherit;
		padding: 12px;
		cursor: pointer;
	}

	.blank-scene-option:hover {
		background: var(--accent);
	}

	.blank-scene-option strong,
	.blank-scene-option small {
		display: block;
	}

	.blank-scene-option strong {
		font-size: 13px;
	}

	.blank-scene-option small {
		margin-top: 2px;
		color: var(--muted-foreground);
		font-size: 11px;
		line-height: 1.35;
	}
</style>
