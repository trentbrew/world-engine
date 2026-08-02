<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { ui, RAIL_CARD_WIDTH, RAIL_HEIGHT, RAIL_WIDTH, VIEWPORT_FLOAT_INSET } from '$lib/ui/ui.svelte';
	import PanelResizeHandle from '$lib/ui/PanelResizeHandle.svelte';
	import Rail from '$lib/ui/Rail.svelte';

	interface Props {
		docBar: Snippet;
		main: Snippet;
		leftPanel?: Snippet;
		rightPanel?: Snippet;
		bottom?: Snippet;
		/** When false, the right inspector column is hidden (e.g. Collections table uses full width). */
		rightPanelVisible?: boolean;
		/** Bottom shelf spans rail-to-edge under side panels (Objects route). */
		bottomPaneFullWidth?: boolean;
	}

	let {
		docBar,
		main,
		leftPanel,
		rightPanel,
		bottom,
		rightPanelVisible = true,
		bottomPaneFullWidth = false
	}: Props = $props();

	const showPanels = $derived(ui.shellMode === 'edit' && ui.sidebarsVisible);
	const showRail = $derived(ui.shellMode === 'edit');
	/** Play mode: doc bar floats without glass fill / border so the viewport reads through. */
	const docBarBare = $derived(ui.shellMode === 'play');
	const railOnLeft = $derived(showRail && ui.railPosition === 'left');
	const railOnBottom = $derived(showRail && ui.railPosition === 'bottom');
	const railWidth = $derived(railOnLeft ? RAIL_WIDTH : 0);
	const railHeight = $derived(railOnBottom ? RAIL_HEIGHT : 0);
	const bottomPaneHeight = $derived(showPanels && !!bottom ? ui.bottomPaneHeight : 0);
	const bottomChromeHeight = $derived(bottomPaneHeight);
	const showBottom = $derived(bottomChromeHeight > 0);
	const showRightPanel = $derived(showPanels && rightPanelVisible && !!rightPanel);
	const leftChromeWidth = $derived(railWidth + (showPanels ? ui.leftPanelWidth : 0));
	const railBottomBand = $derived(railOnBottom ? RAIL_HEIGHT + VIEWPORT_FLOAT_INSET : 0);
	const panelStyle = $derived(
		[
			`--rail-width: ${railWidth}px`,
			`--rail-height: ${railHeight}px`,
			`--rail-bottom-band: ${railBottomBand}px`,
			`--rail-card-width: ${showRail ? RAIL_CARD_WIDTH : 0}px`,
			`--left-panel-width: ${ui.leftPanelWidth}px`,
			`--right-panel-width: ${showRightPanel ? ui.rightPanelWidth : 0}px`,
			`--main-inset-left: calc(${leftChromeWidth}px + var(--chrome-edge) + var(--chrome-rail-gap) + var(--chrome-panel-gap))`,
			`--main-inset-right: calc(${showRightPanel ? ui.rightPanelWidth : 0}px + var(--chrome-edge) + var(--chrome-panel-gap))`,
			`--viewport-gizmo-inset-left: ${ui.viewportGizmoInsetLeft}px`,
			`--viewport-chrome-inset-right: calc(${showRightPanel ? ui.rightPanelWidth : 0}px + var(--chrome-edge) + var(--chrome-panel-gap))`,
			`--bottom-pane-height: ${bottomPaneHeight}px`,
			`--bottom-chrome-height: ${bottomChromeHeight}px`,
			`--viewport-bottom-inset: calc(var(--chrome-bottom-outer) + var(--bottom-chrome-height, 0px) + var(--rail-bottom-band, 0px))`
		].join('; ')
	);
</script>

<div
	class="app-shell"
	class:rail-position-left={railOnLeft}
	class:rail-position-bottom={railOnBottom}
	style={panelStyle}
>
	<!-- Full-bleed canvas — same slot for Scene, Object, Assets, etc. -->
	<div class="app-canvas-layer">
		{@render main()}
	</div>

	<Tooltip.Provider delayDuration={250}>
		<div
			class="app-chrome"
			class:with-chrome={showPanels}
			class:with-bottom={showBottom}
			class:with-rail={showRail}
		>
			{#if showRail}
				<aside class="app-rail">
					<div
						class="chrome-float-card glass-panel-shell chrome-opacity-rail rail-logo-card"
						aria-hidden="true"
					>
						<img class="rail-logo-img" src="/logo.png" alt="" width="28" height="28" />
					</div>
					<Rail />
				</aside>
			{/if}

			<header class="app-doc-bar">
				<div
					class="chrome-float-card glass-panel-shell chrome-opacity-doc-bar doc-bar-card"
					class:doc-bar-card--bare={docBarBare}
				>
					{@render docBar()}
				</div>
			</header>

			{#if showPanels && leftPanel}
				<aside class="app-left-panel">
					<div class="panel-shell chrome-float-card glass-panel-shell chrome-opacity-panel">
						{@render leftPanel()}
					</div>
					<PanelResizeHandle edge="end" onResize={(delta) => ui.resizeLeftPanel(delta)} />
				</aside>
			{/if}
			{#if showRightPanel && rightPanel}
				<aside class="app-right-panel">
					<PanelResizeHandle edge="start" onResize={(delta) => ui.resizeRightPanel(delta)} />
					<div class="panel-shell chrome-float-card glass-panel-shell chrome-opacity-panel">
						{@render rightPanel()}
					</div>
				</aside>
			{/if}
			{#if showBottom && bottom}
				<div class="app-bottom-pane" class:full-width={bottomPaneFullWidth}>
					{@render bottom()}
				</div>
			{/if}
		</div>
	</Tooltip.Provider>
</div>

<style>
	.app-shell {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--viewport);
		color: var(--foreground);
		--chrome-bottom-outer: var(--float-inset);
		/* Extra air under floating L/R panes so they don't crowd the viewport edge. */
		--chrome-panel-bottom-slack: 140px;
		--chrome-panel-min-height: 300px;
	}

	/* Layer 0 — WebGL fills the shell; chrome floats above */
	.app-canvas-layer {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: var(--viewport);
	}

	/* Layer 1 — rail + doc bar + panels; does not shrink the canvas */
	.app-chrome {
		position: absolute;
		inset: 0;
		z-index: 10;
		pointer-events: none;
	}

	.app-rail {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(var(--rail-width) + var(--chrome-edge));
		height: auto;
		max-height: calc(100% - var(--chrome-edge));
		padding: var(--chrome-edge) 0 0 var(--chrome-edge);
		display: flex;
		flex-direction: column;
		gap: var(--chrome-float-gap);
		min-height: 0;
		overflow: visible;
		pointer-events: none;
		z-index: 28;
		box-sizing: border-box;
	}

	.rail-logo-card {
		flex: 0 0 auto;
		width: 56px;
		height: 48px;
		padding: 10px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.rail-logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.app-doc-bar {
		position: absolute;
		top: 0;
		left: calc(var(--rail-width) + var(--chrome-edge));
		right: 0;
		z-index: 30;
		padding: var(--chrome-edge) var(--chrome-edge) 0 var(--chrome-rail-gap);
		height: calc(var(--doc-bar-chrome-height) + var(--chrome-edge));
		pointer-events: none;
		min-height: 0;
		box-sizing: border-box;
	}

	.doc-bar-card {
		height: var(--doc-bar-chrome-height);
		width: 100%;
	}

	/* Play: strip frosted fill + border; keep layout/hit targets. */
	:global(.doc-bar-card--bare.glass-panel-shell::before),
	:global(.doc-bar-card--bare.chrome-float-card::after) {
		background: transparent;
		border: none;
		box-shadow: none;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	.app-left-panel {
		position: absolute;
		top: var(--chrome-top-outer);
		left: calc(var(--rail-width) + var(--chrome-edge));
		width: calc(var(--left-panel-width) + var(--chrome-rail-gap) + var(--chrome-panel-gap));
		height: auto;
		min-height: var(--chrome-panel-min-height);
		max-height: calc(
			100% - var(--chrome-top-outer) - var(--bottom-chrome-height, 0px) - var(--chrome-bottom-outer) -
				var(--chrome-panel-bottom-slack)
		);
		padding: 0 var(--chrome-panel-gap) 0 var(--chrome-rail-gap);
		display: flex;
		flex-direction: column;
		overflow: visible;
		pointer-events: none;
		z-index: 15;
		box-sizing: border-box;
	}

	.app-right-panel {
		position: absolute;
		top: var(--chrome-top-outer);
		right: 0;
		width: calc(var(--right-panel-width) + var(--chrome-edge) + var(--chrome-panel-gap));
		height: auto;
		min-height: var(--chrome-panel-min-height);
		max-height: calc(
			100% - var(--chrome-top-outer) - var(--bottom-chrome-height, 0px) - var(--chrome-bottom-outer) -
				var(--chrome-panel-bottom-slack)
		);
		padding: 0 var(--chrome-edge) 0 var(--chrome-panel-gap);
		display: flex;
		flex-direction: column;
		overflow: visible;
		pointer-events: none;
		z-index: 15;
		box-sizing: border-box;
	}

	.app-bottom-pane {
		position: absolute;
		left: calc(
			var(--rail-width) + var(--chrome-edge) + var(--chrome-rail-gap) + var(--left-panel-width) +
				var(--chrome-panel-gap)
		);
		right: calc(var(--right-panel-width) + var(--chrome-edge) + var(--chrome-panel-gap));
		bottom: 0;
		height: calc(var(--bottom-chrome-height) + var(--chrome-bottom-outer));
		padding: 0 var(--chrome-edge) var(--chrome-bottom-outer);
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: visible;
		pointer-events: none;
		z-index: 12;
		box-sizing: border-box;
	}

	.app-bottom-pane > :global(*) {
		pointer-events: auto;
	}

	/* Objects route — shelf spans under left/right panels (GM-style event editor). */
	.app-bottom-pane.full-width {
		left: calc(var(--rail-width) + var(--chrome-edge) + var(--chrome-rail-gap));
		right: var(--chrome-edge);
		z-index: 18;
		padding-top: var(--chrome-float-gap);
	}

	.app-bottom-pane :global(.bottom-pane) {
		flex: 1 1 auto;
		min-height: 0;
		height: var(--bottom-pane-height);
	}

	.panel-shell {
		flex: 0 1 auto;
		width: 100%;
		height: auto;
		min-height: var(--chrome-panel-min-height);
		max-height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		pointer-events: auto;
	}

	@media (max-width: 767px) {
		.app-rail,
		.app-left-panel,
		.app-right-panel,
		.app-bottom-pane {
			display: none;
		}

		.app-doc-bar {
			left: 0;
		}
	}

	/* Bottom-docked navigation rail */
	.app-shell.rail-position-bottom .app-rail {
		top: auto;
		left: 0;
		right: 0;
		bottom: 0;
		width: auto;
		height: auto;
		max-height: none;
		padding: 0 var(--chrome-edge) var(--chrome-edge);
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
	}

	.app-shell.rail-position-bottom .app-doc-bar {
		left: 0;
		padding: var(--chrome-edge) var(--chrome-edge) 0;
	}

	.app-shell.rail-position-bottom .app-left-panel {
		left: 0;
		max-height: calc(
			100% - var(--chrome-top-outer) - var(--bottom-chrome-height, 0px) - var(--chrome-bottom-outer) -
				var(--rail-height) - var(--chrome-edge) - var(--chrome-panel-bottom-slack)
		);
	}

	.app-shell.rail-position-bottom .app-right-panel {
		max-height: calc(
			100% - var(--chrome-top-outer) - var(--bottom-chrome-height, 0px) - var(--chrome-bottom-outer) -
				var(--rail-height) - var(--chrome-edge) - var(--chrome-panel-bottom-slack)
		);
	}

	.app-shell.rail-position-bottom .app-bottom-pane {
		left: calc(var(--chrome-edge) + var(--chrome-rail-gap) + var(--left-panel-width) + var(--chrome-panel-gap));
		bottom: calc(var(--rail-height) + var(--chrome-edge));
		height: calc(var(--bottom-chrome-height) + var(--chrome-bottom-outer));
	}

	.app-shell.rail-position-bottom .app-bottom-pane.full-width {
		left: calc(var(--chrome-edge) + var(--chrome-rail-gap));
	}
</style>
