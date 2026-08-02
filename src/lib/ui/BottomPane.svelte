<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import { ui } from '$lib/ui/ui.svelte';
	import PanelResizeHandle from '$lib/ui/PanelResizeHandle.svelte';

	export type BottomPaneTab = { id: string; label: string };

	interface Props {
		ariaLabel: string;
		/** Simple title when tabs are not provided. */
		title?: string;
		/** Optional tab strip in the handle (Objects Behaviors / Animations). */
		tabs?: BottomPaneTab[];
		activeTab?: string;
		onTabChange?: (id: string) => void;
		hint?: string;
		shortcut?: string;
		children: Snippet;
	}

	let {
		ariaLabel,
		title = '',
		tabs,
		activeTab,
		onTabChange,
		hint,
		shortcut,
		children
	}: Props = $props();

	const open = $derived(ui.bottomPaneOpen);
	const hasTabs = $derived(!!tabs?.length);

	function selectTab(id: string) {
		onTabChange?.(id);
		if (!ui.bottomPaneOpen) ui.toggleBottomPane(true);
	}
</script>

<section
	class="bottom-pane panel-shell chrome-float-card glass-panel-shell chrome-opacity-bottom"
	class:open
	role="region"
	aria-label={ariaLabel}
>
	{#if open}
		<PanelResizeHandle
			axis="vertical"
			edge="start"
			onResize={(delta) => ui.resizeBottomPane(delta)}
		/>
	{/if}

	<div class="bottom-pane-handle">
		<button
			type="button"
			class="chev-btn"
			aria-expanded={open}
			aria-label={open ? 'Collapse bottom pane' : 'Expand bottom pane'}
			onclick={() => ui.toggleBottomPane()}
		>
			<ChevronUpIcon class="chev size-3.5" aria-hidden="true" />
		</button>

		<div class="handle-main">
			{#if hasTabs && tabs}
				<div class="tabs" role="tablist" aria-label="Bottom pane tabs">
					{#each tabs as tab (tab.id)}
						<button
							type="button"
							role="tab"
							id="objects-bottom-tab-{tab.id}"
							class="tab"
							class:active={activeTab === tab.id}
							aria-selected={activeTab === tab.id}
							onclick={() => selectTab(tab.id)}
						>
							{tab.label}
						</button>
					{/each}
				</div>
			{:else if title}
				<button
					type="button"
					class="title-btn"
					aria-expanded={open}
					onclick={() => ui.toggleBottomPane()}
				>
					<span class="ttl">{title}</span>
				</button>
			{/if}

			{#if hint}
				<span class="hint">{hint}</span>
			{/if}
			{#if shortcut}
				<kbd>{shortcut}</kbd>
			{/if}
		</div>
	</div>

	{#if open}
		<div class="bottom-pane-body">
			<div class="bottom-pane-scroll">
				{@render children()}
			</div>
		</div>
	{/if}
</section>

<style>
	.bottom-pane {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 0;
		pointer-events: auto;
		border-top: 1px solid var(--chrome-divider);
		--bottom-pane-gutter: 28px;
	}

	.bottom-pane-handle {
		display: grid;
		grid-template-columns: var(--bottom-pane-gutter) 1fr;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		min-height: var(--panel-shelf-height);
		box-sizing: border-box;
		padding: 0 var(--spacing-md);
		border: 0;
		background: transparent;
		color: var(--muted-foreground);
		font: 600 11px/1 inherit;
		flex-shrink: 0;
	}

	.handle-main {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.chev-btn,
	.title-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding: 0;
	}

	.chev-btn {
		padding: 6px;
		border-radius: 4px;
		color: var(--primary);
	}

	.chev-btn:hover {
		background: color-mix(in srgb, var(--muted) 35%, transparent);
	}

	.chev-btn :global(.chev) {
		transition: transform 160ms ease;
	}

	.bottom-pane.open .chev-btn :global(.chev) {
		transform: rotate(180deg);
	}

	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.tab {
		padding: 8px 12px;
		border: 0;
		background: transparent;
		color: var(--muted-foreground);
		font: 600 11px/1 inherit;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.tab.active {
		color: var(--foreground);
		border-bottom-color: var(--primary);
	}

	.tab:focus-visible,
	.chev-btn:focus-visible,
	.title-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.ttl {
		color: var(--foreground);
	}

	.hint {
		font-weight: 500;
	}

	kbd {
		margin-left: auto;
		font: 600 10px var(--font-mono, monospace);
		color: var(--muted-foreground);
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		border-radius: 4px;
		padding: 2px 6px;
	}

	.bottom-pane.open .bottom-pane-handle {
		border-bottom: 1px solid var(--chrome-divider);
	}

	.bottom-pane-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.bottom-pane-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
		padding-left: calc(
			var(--spacing-md) + var(--bottom-pane-gutter) + var(--spacing-sm)
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.chev-btn :global(.chev) {
			transition: none;
		}
	}
</style>
