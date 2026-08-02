<script lang="ts">
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { ui, type WorldRoute } from '$lib/ui/ui.svelte';
	import { railOrder } from '$lib/ui/railOrder.svelte';
	import {
		moveRailOrderItem,
		orderedWorldRoutes,
		resolveActiveWorldRoute,
		type WorldNavItem
	} from '$lib/ui/worldNav';

	const RAIL_DRAG_MIME = 'application/x-playlab-rail-route';
	const FLIP_MS = 200;

	const active = $derived(resolveActiveWorldRoute());
	const configActive = $derived(ui.railRoute === 'config');
	const horizontal = $derived(ui.railPosition === 'bottom');
	const tooltipSide = $derived(horizontal ? 'top' : 'right');

	let draggingId = $state<WorldRoute | null>(null);
	let previewOrder = $state<WorldRoute[] | null>(null);
	let suppressClick = $state(false);
	let dragCancelled = $state(false);

	const displayItems = $derived(
		previewOrder ? orderedWorldRoutes(previewOrder) : railOrder.items
	);

	function isRailDrag(event: DragEvent): boolean {
		const types = event.dataTransfer?.types;
		if (!types) return draggingId !== null;
		// Custom MIME may be hidden during dragover in some browsers — text/plain is enough.
		return (
			types.includes(RAIL_DRAG_MIME) ||
			types.includes('text/plain') ||
			draggingId !== null
		);
	}

	function ordersEqual(a: readonly WorldRoute[], b: readonly WorldRoute[]): boolean {
		return a.length === b.length && a.every((id, i) => id === b[i]);
	}

	function onEscapeDuringDrag(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !draggingId) return;
		dragCancelled = true;
		previewOrder = null;
	}

	function onDragStart(event: DragEvent, id: WorldRoute) {
		if (!event.dataTransfer) return;
		draggingId = id;
		previewOrder = [...railOrder.order];
		suppressClick = false;
		dragCancelled = false;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData(RAIL_DRAG_MIME, id);
		event.dataTransfer.setData('text/plain', id);
		window.addEventListener('keydown', onEscapeDuringDrag);

		const source = event.currentTarget;
		if (source instanceof HTMLElement) {
			const ghost = source.cloneNode(true) as HTMLElement;
			ghost.style.position = 'fixed';
			ghost.style.top = '-9999px';
			ghost.style.left = '-9999px';
			ghost.style.width = `${source.offsetWidth}px`;
			ghost.style.height = `${source.offsetHeight}px`;
			ghost.style.transform = 'scale(1.18)';
			ghost.style.transformOrigin = 'center center';
			ghost.style.opacity = '1';
			ghost.style.pointerEvents = 'none';
			ghost.removeAttribute('aria-grabbed');
			document.body.appendChild(ghost);
			event.dataTransfer.setDragImage(
				ghost,
				source.offsetWidth / 2,
				source.offsetHeight / 2
			);
			requestAnimationFrame(() => ghost.remove());
		}
	}

	/** Always allow drop while a rail drag is active (including over the dragged item). */
	function onSlotDragOver(event: DragEvent, id: WorldRoute) {
		if (!draggingId || !isRailDrag(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		if (draggingId === id) return;

		const base = previewOrder ?? [...railOrder.order];
		const next = moveRailOrderItem(base, draggingId, id);
		if (ordersEqual(next, base)) return;
		previewOrder = next;
	}

	function onRailDragOver(event: DragEvent) {
		if (!draggingId || !isRailDrag(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	function commitPreview() {
		if (!previewOrder) return;
		if (!ordersEqual(previewOrder, railOrder.order)) {
			railOrder.setOrder(previewOrder);
		}
	}

	function onSlotDrop(event: DragEvent) {
		event.preventDefault();
		suppressClick = true;
		if (!dragCancelled) commitPreview();
		clearDrag();
	}

	function onDragEnd() {
		suppressClick = true;
		// Drop often never fires after live FLIP (pointer sits on dragged item).
		// Commit any dirty preview from the gesture unless Escape cancelled it.
		if (!dragCancelled) commitPreview();
		clearDrag();
	}

	function clearDrag() {
		window.removeEventListener('keydown', onEscapeDuringDrag);
		draggingId = null;
		previewOrder = null;
		dragCancelled = false;
	}

	function onItemClick(id: WorldRoute) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		ui.setRoute(id);
	}
</script>

{#snippet railButton(
	item: WorldNavItem | { id: 'config'; label: string; Icon: typeof SettingsIcon },
	opts: { draggable: boolean } = { draggable: false }
)}
	{@const isActive = item.id === 'config' ? configActive : active === item.id}
	{@const isDragging = draggingId === item.id}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="chrome-float-card glass-panel-shell chrome-opacity-rail rail-item-card"
					class:active={isActive}
					class:dragging={isDragging}
					draggable={opts.draggable}
					aria-current={isActive ? 'true' : undefined}
					aria-label={item.label}
					aria-grabbed={opts.draggable ? (isDragging ? 'true' : 'false') : undefined}
					onclick={() => onItemClick(item.id)}
					ondragstart={opts.draggable ? (event) => onDragStart(event, item.id) : undefined}
					ondragend={opts.draggable ? onDragEnd : undefined}
				>
					<item.Icon class="rail-icon" aria-hidden="true" />
				</button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side={tooltipSide} sideOffset={8} class="text-xs">
			{item.label}{opts.draggable ? ' · drag to reorder' : ''}
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<nav
	class="rail"
	class:rail--horizontal={horizontal}
	class:rail--dragging={draggingId !== null}
	aria-label="World navigation"
	ondragover={onRailDragOver}
	ondrop={onSlotDrop}
>
	{#each displayItems as item (item.id)}
		<div
			class="rail-slot"
			role="presentation"
			animate:flip={{ duration: FLIP_MS, easing: cubicOut }}
			ondragover={(event) => onSlotDragOver(event, item.id)}
			ondrop={onSlotDrop}
		>
			{@render railButton(item, { draggable: true })}
		</div>
	{/each}
	<div class="rail-slot rail-slot--pinned">
		{@render railButton({ id: 'config', label: 'Config', Icon: SettingsIcon }, { draggable: false })}
	</div>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--chrome-float-gap, 6px);
		height: auto;
		padding: 0;
		min-height: 0;
		pointer-events: none;
	}

	.rail--horizontal {
		flex-direction: row;
		align-items: center;
		width: auto;
		height: auto;
		padding: 0;
		gap: var(--chrome-float-gap, 6px);
	}

	.rail-slot {
		flex: 0 0 auto;
		pointer-events: auto;
		position: relative;
	}

	.rail-slot:has(.dragging) {
		z-index: 2;
	}

	.rail-item-card {
		flex: 0 0 auto;
		width: 56px;
		height: 48px;
		padding: 0;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		color: var(--muted-foreground);
		cursor: default;
		pointer-events: auto;
		transform-origin: center center;
		transition:
			color 120ms ease,
			box-shadow 120ms ease,
			opacity 120ms ease,
			transform 160ms ease;
	}

	.rail-item-card.dragging {
		opacity: 0.95;
		transform: scale(1.18);
		z-index: 2;
	}

	.rail--dragging .rail-item-card:not(.dragging) {
		transition:
			color 120ms ease,
			box-shadow 120ms ease,
			opacity 120ms ease,
			transform 160ms ease;
	}

	:global(.rail-icon) {
		width: 18px;
		height: 18px;
		stroke-width: 1.75px;
		flex-shrink: 0;
	}

	.rail-item-card:hover:not(.active) {
		color: var(--foreground);
	}

	.rail-item-card.active,
	.rail-item-card[aria-current='true'] {
		color: var(--foreground);
	}

	:global(.rail-item-card.active.chrome-opacity-rail.glass-panel-shell::before),
	:global(.rail-item-card[aria-current='true'].chrome-opacity-rail.glass-panel-shell::before) {
		border-color: #fff;
		border-width: 1px;
		border-style: solid;
	}

	.rail-item-card:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.rail-item-card {
			transition: none;
		}
	}
</style>
