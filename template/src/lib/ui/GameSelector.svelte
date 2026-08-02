<script lang="ts">
	import Gamepad2Icon from '@lucide/svelte/icons/gamepad-2';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	/** Stub until a games/worlds manager exists. */
	const GAME_LABEL = 'Untitled Game';

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement | null>(null);

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => triggerRef?.focus());
	}
</script>

<div class="game-selector">
	<Popover.Root bind:open>
		<Popover.Trigger bind:ref={triggerRef}>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					class="game-trigger"
					role="combobox"
					aria-expanded={open}
					aria-label="Select game"
				>
					<Gamepad2Icon class="game-icon" aria-hidden="true" />
					<span class="game-trigger-title">{GAME_LABEL}</span>
					<ChevronsUpDownIcon class="game-trigger-chevron" aria-hidden="true" />
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="game-popover" align="start">
			<Command.Root>
				<Command.Input placeholder="Search games…" />
				<Command.List>
					<Command.Empty>No other games yet.</Command.Empty>
					<Command.Group heading="Games">
						<Command.Item value={GAME_LABEL} onSelect={closeAndFocusTrigger}>
							<Gamepad2Icon class="game-item-icon" aria-hidden="true" />
							<span class="game-option-title">{GAME_LABEL}</span>
						</Command.Item>
					</Command.Group>
				</Command.List>
				<div class="game-footer">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button {...props} type="button" class="game-stub-btn" disabled>
									New game — coming soon
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom" sideOffset={6} class="text-xs">
							Games manager coming soon
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>

<style>
	.game-selector {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	:global(.game-trigger) {
		height: 28px;
		min-width: 0;
		max-width: 160px;
		justify-content: flex-start;
		gap: 6px;
		padding: 0 8px;
		font-weight: 500;
		background: var(--card);
		border-color: var(--border);
	}

	:global(.game-icon) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.72;
	}

	.game-trigger-title {
		font-size: 12px;
		color: var(--foreground);
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}

	:global(.game-trigger-chevron) {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		margin-left: auto;
		opacity: 0.5;
	}

	:global(.game-popover) {
		width: min(260px, calc(100vw - 24px));
		padding: 0;
		overflow: hidden;
	}

	:global(.game-item-icon) {
		width: 14px;
		height: 14px;
		opacity: 0.7;
	}

	.game-option-title {
		font-size: 12px;
		font-weight: 500;
	}

	.game-footer {
		border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		padding: 6px 8px;
	}

	.game-stub-btn {
		width: 100%;
		height: 28px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted-foreground);
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: not-allowed;
		opacity: 0.7;
	}
</style>
