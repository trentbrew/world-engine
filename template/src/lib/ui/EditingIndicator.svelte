<script lang="ts">
	interface Props {
		label?: string;
		/** Inline in doc bar (default: fixed floating badge). */
		inline?: boolean;
	}

	let { label = 'Editing…', inline = false }: Props = $props();
</script>

<div
	class="editing-indicator"
	class:inline
	role="status"
	aria-live="polite"
	aria-busy="true"
>
	<span class="pulse" aria-hidden="true"></span>
	<span class="label">{label}</span>
</div>

<style>
	.editing-indicator {
		position: fixed;
		top: calc(var(--doc-bar-height, 40px) + var(--float-inset, 12px));
		right: var(--float-inset, 12px);
		z-index: 90;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--chrome-pill-bg);
		border: 1px solid var(--border);
		box-shadow: 0 4px 20px rgb(0 0 0 / 0.22);
		backdrop-filter: blur(8px);
		pointer-events: none;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.editing-indicator.inline {
		position: static;
		z-index: auto;
		flex-shrink: 0;
		padding: 4px 10px;
		box-shadow: none;
		backdrop-filter: none;
		font-size: 11px;
	}

	.pulse {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--primary, #7dd3fc);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.45;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	.label {
		letter-spacing: 0.01em;
	}
</style>
