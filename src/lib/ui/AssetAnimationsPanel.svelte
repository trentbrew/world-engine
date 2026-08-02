<script lang="ts">
	import { resolveCharacterDefaults } from '$lib/engine/animation/characterMeshDefaults';
	import { assetPreview } from '$lib/ui/assetPreview.svelte';
	import ClipCatalogBrowser from '$lib/ui/ClipCatalogBrowser.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);
	const meshUrl = $derived(shape?.mesh ?? (asset?.kind === 'models' ? asset.url : null));
	const inspection = $derived(assetPreview.inspection);
	const hasSkeleton = $derived((inspection?.boneCount ?? 0) > 0);

	const defaults = $derived(meshUrl ? resolveCharacterDefaults(meshUrl) : null);
	const activeClip = $derived(
		ui.previewAnimClip ?? defaults?.clip ?? inspection?.animationNames[0] ?? 'Idle_Loop'
	);

	function selectClip(clipId: string) {
		ui.previewAnimClip = clipId;
		ui.objectPreviewPlaying = true;
		ui.seekPreviewAnim(0);
	}

	function togglePlay() {
		ui.objectPreviewPlaying = !ui.objectPreviewPlaying;
	}

	function scrub(t: number) {
		ui.objectPreviewPlaying = false;
		ui.seekPreviewAnim(t);
	}
</script>

<div class="asset-animations-panel" aria-label="Asset animations">
	{#if !meshUrl}
		<p class="empty-hint">Select a model to browse animations.</p>
	{:else if !hasSkeleton && (inspection?.animationNames.length ?? 0) === 0}
		<p class="empty-hint">This model has no skeleton or embedded animation clips.</p>
	{:else if defaults}
		<ClipCatalogBrowser
			catalogRef={defaults.catalog}
			embeddedClips={inspection?.animationNames ?? []}
			activeClip={activeClip}
			title={asset?.name ?? shape?.label ?? 'Model'}
			subtitle={defaults.catalog.replace(/^catalog:/, '')}
			onSelect={selectClip}
			playing={ui.objectPreviewPlaying}
			time={ui.previewAnimTime}
			duration={ui.previewAnimDuration}
			onTogglePlay={togglePlay}
			onScrub={scrub}
		/>
	{/if}
</div>

<style>
	.asset-animations-panel {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.empty-hint {
		margin: 0;
		padding: var(--spacing-md);
		font-size: 12px;
		line-height: 1.45;
		text-align: center;
		color: var(--muted-foreground);
	}
</style>
