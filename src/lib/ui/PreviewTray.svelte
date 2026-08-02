<script lang="ts">
	import { formatBytes } from '$lib/assets/catalog';
	import { ui } from '$lib/ui/ui.svelte';
	import { isAssetRoute } from '$lib/ui/assetRoutes';

	const preview = $derived(ui.previewContext);

	const title = $derived(
		preview?.kind === 'asset'
			? preview.asset.name
			: preview?.kind === 'shape'
				? preview.shape.label
				: ''
	);

	const meta = $derived(
		preview?.kind === 'asset'
			? `${preview.asset.kind}${preview.asset.size ? ` - ${formatBytes(preview.asset.size)}` : ''}`
			: preview?.kind === 'shape'
				? 'shape'
				: ''
	);
</script>

{#if preview && !isAssetRoute(ui.railRoute)}
	<section class="preview-tray glass-panel" aria-label="Preview tray">
		<div>
			<span class="tray-kicker">Preview tray</span>
			<strong>{title}</strong>
		</div>
		<div class="tray-track" aria-hidden="true">
			<span></span>
		</div>
		<span class="tray-meta">{meta}</span>
	</section>
{/if}

<style>
	.preview-tray {
		position: fixed;
		left: 50%;
		bottom: calc(var(--viewport-bottom-inset, var(--float-inset)) + var(--gizmo-well-size, 64px) + 8px);
		z-index: 45;
		width: min(560px, calc(100vw - 760px));
		min-width: 280px;
		display: grid;
		grid-template-columns: minmax(120px, 1fr) minmax(140px, 2fr) auto;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		transform: translateX(-50%);
		pointer-events: auto;
	}

	.tray-kicker,
	.tray-meta {
		display: block;
		color: var(--muted-foreground);
		font-size: 10px;
	}

	strong {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
	}

	.tray-track {
		height: 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--border) 55%, transparent);
		overflow: hidden;
	}

	.tray-track span {
		display: block;
		width: 42%;
		height: 100%;
		border-radius: inherit;
		background: color-mix(in srgb, var(--accent-entity) 65%, var(--ring));
	}

	@media (max-width: 960px) {
		.preview-tray {
			left: var(--float-inset);
			right: var(--float-inset);
			width: auto;
			transform: none;
			grid-template-columns: 1fr;
		}
	}
</style>
