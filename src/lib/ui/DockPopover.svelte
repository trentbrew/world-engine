<script lang="ts">
	/**
	 * Floating palette anchored to the dock rail — the non-modal alternative to a
	 * full-shell route for dock items that FEED the viewport (Assets today).
	 *
	 * Three behaviours matter more than the chrome:
	 *  - the viewport stays live behind it, so drag-to-place has a visible target;
	 *  - it goes transparent to the pointer during an HTML5 drag, so the drop
	 *    lands on the canvas underneath instead of on the palette;
	 *  - it never becomes the inspector — selection still flows to the right rail.
	 */
	import { onMount, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { ui, RAIL_HEIGHT, RAIL_WIDTH } from '$lib/ui/ui.svelte';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		open: boolean;
		title: string;
		/** Persisted size bucket — distinct per dock route. */
		storageKey: string;
		defaultWidth?: number;
		defaultHeight?: number;
		minWidth?: number;
		maxWidth?: number;
		minHeight?: number;
		onclose: () => void;
		/** Promote to the full-shell route. Omit to hide the expand affordance. */
		onexpand?: () => void;
		/** Optional controls rendered in the palette header (tabs, filters). */
		header?: Snippet;
		children: Snippet;
	}

	let {
		open,
		title,
		storageKey,
		defaultWidth = 680,
		defaultHeight = 440,
		minWidth = 320,
		maxWidth = 1100,
		minHeight = 220,
		onclose,
		onexpand,
		header,
		children
	}: Props = $props();

	// Size is user-owned after first paint — the props only seed it.
	let width = $state(untrack(() => defaultWidth));
	let height = $state(untrack(() => defaultHeight));
	/** True while an HTML5 drag started inside the palette is in flight. */
	let dragging = $state(false);
	let resizing = $state<null | 'height' | 'left' | 'right'>(null);

	const anchoredBottom = $derived(ui.railPosition === 'bottom');
	const railBand = $derived(anchoredBottom ? RAIL_HEIGHT : 0);
	const railGutter = $derived(anchoredBottom ? 0 : RAIL_WIDTH);

	function sizeKey(): string {
		return `playlab.dockPopover.${storageKey}.size`;
	}

	onMount(() => {
		try {
			const raw = localStorage.getItem(sizeKey());
			if (raw) {
				const saved = JSON.parse(raw) as { w?: number; h?: number };
				if (typeof saved.w === 'number') width = saved.w;
				if (typeof saved.h === 'number') height = saved.h;
			}
		} catch {
			/* size is a convenience — a bad/absent entry just uses the default */
		}
	});

	function persistSize() {
		try {
			localStorage.setItem(sizeKey(), JSON.stringify({ w: width, h: height }));
		} catch {
			/* non-fatal */
		}
	}

	function clampToViewport() {
		const maxW = Math.min(maxWidth, window.innerWidth - 32);
		const maxH = window.innerHeight - railBand - 140;
		width = Math.max(minWidth, Math.min(width, maxW));
		height = Math.max(minHeight, Math.min(height, Math.max(minHeight, maxH)));
	}

	function startResize(event: PointerEvent, edge: 'height' | 'left' | 'right') {
		event.preventDefault();
		const startX = event.clientX;
		const startY = event.clientY;
		const startW = width;
		const startH = height;
		resizing = edge;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		function onMove(move: PointerEvent) {
			if (edge === 'height') {
				// Palette grows upward from the dock, so up-drag = taller.
				height = startH + (startY - move.clientY);
			} else {
				// Centre-anchored: each edge contributes double to keep it centred.
				const delta = edge === 'right' ? move.clientX - startX : startX - move.clientX;
				width = startW + delta * 2;
			}
			clampToViewport();
		}

		function onUp() {
			resizing = null;
			target.releasePointerCapture(event.pointerId);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			persistSize();
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	const style = $derived(
		[
			`--dock-popover-width: ${width}px`,
			`--dock-popover-height: ${height}px`,
			`--dock-popover-rail-band: ${railBand}px`,
			`--dock-popover-rail-gutter: ${railGutter}px`
		].join('; ')
	);
</script>

{#if open}
	<div
		class="dock-popover-layer"
		class:anchored-bottom={anchoredBottom}
		class:drag-through={dragging}
		{style}
	>
		<div
			class="dock-popover chrome-float-card glass-panel-shell chrome-opacity-panel"
			class:resizing={resizing !== null}
			role="dialog"
			tabindex="-1"
			aria-label={title}
			ondragstart={() => (dragging = true)}
			ondragend={() => (dragging = false)}
		>
			<!-- Top edge: height. Side edges: width, symmetric about the dock. -->
			<div
				class="resize-edge resize-edge--top"
				role="presentation"
				onpointerdown={(e) => startResize(e, 'height')}
			></div>
			<div
				class="resize-edge resize-edge--left"
				role="presentation"
				onpointerdown={(e) => startResize(e, 'left')}
			></div>
			<div
				class="resize-edge resize-edge--right"
				role="presentation"
				onpointerdown={(e) => startResize(e, 'right')}
			></div>

			<header class="dock-popover-head">
				<span class="dock-popover-title">{title}</span>
				<div class="dock-popover-head-slot">
					{#if header}{@render header()}{/if}
				</div>
				<div class="dock-popover-actions">
					{#if onexpand}
						<button
							type="button"
							class="head-btn"
							title="Open as full page"
							aria-label="Open as full page"
							onclick={onexpand}
						>
							<Maximize2Icon class="size-3.5" aria-hidden="true" />
						</button>
					{/if}
					<button
						type="button"
						class="head-btn"
						title="Close"
						aria-label="Close"
						onclick={onclose}
					>
						<XIcon class="size-3.5" aria-hidden="true" />
					</button>
				</div>
			</header>

			<div class="dock-popover-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.dock-popover-layer {
		position: fixed;
		z-index: 26; /* under the rail (28) so the dock stays clickable */
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.dock-popover-layer.anchored-bottom {
		left: 0;
		right: 0;
		bottom: calc(
			var(--dock-popover-rail-band) + var(--chrome-edge) + var(--chrome-float-gap)
		);
	}

	/* Left-docked rail: palette hangs off the rail rather than centring. */
	.dock-popover-layer:not(.anchored-bottom) {
		left: calc(var(--dock-popover-rail-gutter) + var(--chrome-edge) + var(--chrome-rail-gap));
		bottom: var(--chrome-edge);
		justify-content: flex-start;
	}

	/* While dragging an asset out, let the pointer reach the canvas underneath. */
	.dock-popover-layer.drag-through {
		pointer-events: none;
		opacity: 0.35;
	}

	.dock-popover {
		position: relative;
		pointer-events: auto;
		width: var(--dock-popover-width);
		height: var(--dock-popover-height);
		max-width: calc(100vw - 32px);
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
		transition: opacity 120ms ease;
	}

	.drag-through .dock-popover {
		pointer-events: none;
	}

	.dock-popover.resizing {
		user-select: none;
	}

	.resize-edge {
		position: absolute;
		z-index: 2;
	}

	.resize-edge--top {
		top: 0;
		left: 8px;
		right: 8px;
		height: 6px;
		cursor: ns-resize;
	}

	.resize-edge--left,
	.resize-edge--right {
		top: 8px;
		bottom: 8px;
		width: 6px;
		cursor: ew-resize;
	}

	.resize-edge--left {
		left: 0;
	}

	.resize-edge--right {
		right: 0;
	}

	.dock-popover-head {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		padding: 8px var(--spacing-sm) 6px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
	}

	.dock-popover-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.dock-popover-head-slot {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.dock-popover-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.head-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: var(--field-control-radius);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.head-btn:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.head-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.dock-popover-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	@media (max-width: 767px) {
		.dock-popover-layer {
			display: none;
		}
	}
</style>
