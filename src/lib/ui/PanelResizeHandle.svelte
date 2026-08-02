<script lang="ts">
	interface Props {
		/** `end` = handle on the panel's trailing edge (right side of left panel). */
		edge: 'start' | 'end';
		axis?: 'horizontal' | 'vertical';
		onResize: (delta: number) => void;
	}

	let { edge, axis = 'horizontal', onResize }: Props = $props();

	function onPointerDown(event: PointerEvent) {
		event.preventDefault();
		let lastX = event.clientX;
		let lastY = event.clientY;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const onPointerMove = (moveEvent: PointerEvent) => {
			if (axis === 'vertical') {
				const delta = moveEvent.clientY - lastY;
				lastY = moveEvent.clientY;
				onResize(edge === 'start' ? -delta : delta);
			} else {
				const delta = moveEvent.clientX - lastX;
				lastX = moveEvent.clientX;
				onResize(edge === 'end' ? delta : -delta);
			}
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
	class="panel-resize-handle"
	class:edge-start={edge === 'start'}
	class:edge-end={edge === 'end'}
	class:axis-vertical={axis === 'vertical'}
	aria-label={axis === 'vertical' ? 'Resize bottom pane' : 'Resize panel'}
	onpointerdown={onPointerDown}
></button>

<style>
	.panel-resize-handle {
		position: absolute;
		padding: 0;
		border: none;
		background: transparent;
		z-index: 2;
		pointer-events: auto;
	}

	.panel-resize-handle:not(.axis-vertical) {
		top: 0;
		bottom: 0;
		width: 10px;
		cursor: col-resize;
	}

	.panel-resize-handle.edge-end:not(.axis-vertical) {
		right: -5px;
	}

	.panel-resize-handle.edge-start:not(.axis-vertical) {
		left: -5px;
	}

	.panel-resize-handle.axis-vertical {
		left: 0;
		right: 0;
		height: 10px;
		cursor: ns-resize;
	}

	.panel-resize-handle.axis-vertical.edge-start {
		top: -5px;
	}

	.panel-resize-handle.axis-vertical.edge-end {
		bottom: -5px;
	}

	.panel-resize-handle:not(.axis-vertical)::after {
		content: '';
		position: absolute;
		top: 12%;
		bottom: 12%;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		border-radius: 999px;
		background: transparent;
		transition: background 120ms ease;
	}

	.panel-resize-handle.axis-vertical::after {
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

	.panel-resize-handle:hover::after,
	.panel-resize-handle:focus-visible::after {
		background: color-mix(in srgb, var(--ring) 70%, transparent);
	}

	.panel-resize-handle:focus-visible {
		outline: none;
	}
</style>
