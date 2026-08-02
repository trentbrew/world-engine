<script lang="ts">
	interface Props {
		/** `top` = handle on the panel's top edge. */
		edge: 'top' | 'bottom';
		onResize: (deltaY: number) => void;
	}

	let { edge, onResize }: Props = $props();

	function onPointerDown(event: PointerEvent) {
		event.preventDefault();
		let lastY = event.clientY;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const onPointerMove = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientY - lastY;
			lastY = moveEvent.clientY;
			onResize(edge === 'bottom' ? delta : -delta);
		};

		const onPointerUp = (upEvent: PointerEvent) => {
			target.releasePointerCapture(upEvent.pointerId);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	}
</script>

<button
	type="button"
	class="vertical-resize-handle"
	class:edge-top={edge === 'top'}
	class:edge-bottom={edge === 'bottom'}
	aria-label="Resize panel"
	onpointerdown={onPointerDown}
></button>

<style>
	.vertical-resize-handle {
		position: absolute;
		left: 0;
		right: 0;
		height: 10px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: row-resize;
		z-index: 2;
		pointer-events: auto;
	}

	.vertical-resize-handle.edge-bottom {
		bottom: -5px;
	}

	.vertical-resize-handle.edge-top {
		top: -5px;
	}

	.vertical-resize-handle::after {
		content: '';
		position: absolute;
		left: 12%;
		right: 12%;
		top: 50%;
		height: 2px;
		transform: translateY(-50%);
		border-radius: 999px;
		background: transparent;
		transition: background 120ms ease;
	}

	.vertical-resize-handle:hover::after,
	.vertical-resize-handle:focus-visible::after {
		background: color-mix(in srgb, var(--ring) 70%, transparent);
	}

	.vertical-resize-handle:focus-visible {
		outline: none;
	}
</style>
