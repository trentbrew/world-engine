<script lang="ts">
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		assetPreview,
		MATERIAL_CHANNEL_LABELS,
		type MaterialChannel
	} from '$lib/ui/assetPreview.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { resolveAssetUrl } from '$lib/engine/render/meshRef';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import BoneIcon from '@lucide/svelte/icons/bone';
	import Grid3x3Icon from '@lucide/svelte/icons/grid-3x3';
	import ScanLineIcon from '@lucide/svelte/icons/scan-line';
	import WaypointsIcon from '@lucide/svelte/icons/waypoints';
	import { isVideoFile } from '$lib/assets/catalog';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);
	const view = $derived(assetPreview.view);
	const inspection = $derived(assetPreview.inspection);
	const hasSkeleton = $derived((inspection?.boneCount ?? 0) > 0);
	const isModelPreview = $derived(!!shape || asset?.kind === 'models');
	const materials = $derived(inspection?.materials ?? []);
</script>

<div class="asset-inspector-controls" role="region" aria-label="Asset view options">
	{#if !preview}
		<p class="empty-hint">Select an asset to adjust view options.</p>
	{:else if isModelPreview}
		<div class="control-group">
			<span class="group-label">Model view</span>
			<Toggle
				size="sm"
				variant="outline"
				pressed={view.wireframe}
				onclick={() => assetPreview.toggle('wireframe')}
				aria-label="Wireframe"
			>
				<ScanLineIcon class="size-3.5" aria-hidden="true" />
				<span>Wireframe</span>
			</Toggle>

			{#if hasSkeleton}
				<Toggle
					size="sm"
					variant="outline"
					pressed={view.showBones}
					onclick={() => assetPreview.toggle('showBones')}
					aria-label="Skeleton"
				>
					<BoneIcon class="size-3.5" aria-hidden="true" />
					<span>Bones</span>
				</Toggle>
			{/if}

			<Toggle
				size="sm"
				variant="outline"
				pressed={view.showNormals}
				onclick={() => assetPreview.toggle('showNormals')}
				aria-label="Vertex normals"
			>
				<WaypointsIcon class="size-3.5" aria-hidden="true" />
				<span>Normals</span>
			</Toggle>
		</div>

		<div class="control-group">
			<span class="group-label">Material channel</span>
			<Select.Root
				type="single"
				value={view.materialChannel}
				onValueChange={(value) => {
					if (value) assetPreview.setMaterialChannel(value as MaterialChannel);
				}}
			>
				<Select.Trigger size="sm" class="channel-trigger" aria-label="Material channel">
					<Grid3x3Icon class="size-3.5" aria-hidden="true" />
					<span>{MATERIAL_CHANNEL_LABELS[view.materialChannel]}</span>
				</Select.Trigger>
				<Select.Content>
					{#each Object.entries(MATERIAL_CHANNEL_LABELS) as [id, label] (id)}
						<Select.Item value={id}>{label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<p class="hint">Solo a PBR map (albedo, normals, roughness…) or overlay a UV checker.</p>
		</div>

		{#if inspection}
			<div class="control-group">
				<span class="group-label">Geometry</span>
				<dl class="stat-list">
					<div>
						<dt>Meshes</dt>
						<dd>{inspection.meshCount}</dd>
					</div>
					<div>
						<dt>Triangles</dt>
						<dd>{inspection.triangleCount.toLocaleString()}</dd>
					</div>
					{#if inspection.boneCount > 0}
						<div>
							<dt>Bones</dt>
							<dd>{inspection.boneCount}</dd>
						</div>
					{/if}
					<div>
						<dt>Bounds</dt>
						<dd>
							{inspection.dimensions.x} × {inspection.dimensions.y} × {inspection.dimensions.z}
						</dd>
					</div>
				</dl>
			</div>
		{/if}

		{#if materials.length > 0}
			<div class="control-group">
				<span class="group-label">Materials ({materials.length})</span>
				<ul class="material-list">
					{#each materials as material, index (index)}
						<li>
							<strong>{material.name}</strong>
							<span class="mat-type">{material.type}</span>
							<span class="material-maps">
								{#if material.hasBaseColorMap}<span>albedo</span>{/if}
								{#if material.hasNormalMap}<span>normal</span>{/if}
								{#if material.hasEmissiveMap}<span>emissive</span>{/if}
								{#if material.hasRoughnessMap}<span>rough</span>{/if}
								{#if material.hasMetalnessMap}<span>metal</span>{/if}
								{#if !material.hasBaseColorMap && !material.hasNormalMap && !material.hasEmissiveMap && !material.hasRoughnessMap && !material.hasMetalnessMap}
									<span>untextured</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else if asset?.kind === 'textures'}
		<div class="control-group">
			<span class="group-label">Texture view</span>
			<Toggle
				size="sm"
				variant="outline"
				pressed={view.materialChannel === 'uvChecker'}
				onclick={() =>
					assetPreview.setMaterialChannel(
						view.materialChannel === 'uvChecker' ? 'lit' : 'uvChecker'
					)}
				aria-label="UV checker overlay"
			>
				<Grid3x3Icon class="size-3.5" aria-hidden="true" />
				<span>UV checker</span>
			</Toggle>
		</div>
	{:else if asset?.kind === 'audio'}
		<div class="control-group">
			<span class="group-label">Audio</span>
			<Toggle
				size="sm"
				variant="outline"
				pressed={assetPreview.audioLoop}
				onclick={() => assetPreview.setAudioLoop(!assetPreview.audioLoop)}
				aria-label="Loop playback"
			>
				<span>Loop</span>
			</Toggle>
			<label class="volume-row">
				<span>Volume</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={assetPreview.audioVolume}
					aria-label="Volume"
					oninput={(event) =>
						assetPreview.setAudioVolume(Number((event.currentTarget as HTMLInputElement).value))}
				/>
			</label>
		</div>
	{:else if asset?.kind === 'files'}
		<div class="control-group">
			<span class="group-label">File</span>
			{#if asset && isVideoFile(asset.name)}
				<p class="hint">Use the video controls in the preview stage.</p>
			{:else if asset}
				<a class="file-open" href={resolveAssetUrl(asset.url)} target="_blank" rel="noopener noreferrer">
					Open file
					<ExternalLinkIcon class="size-3" aria-hidden="true" />
				</a>
			{/if}
		</div>
	{:else}
		<p class="empty-hint">No view options for this selection.</p>
	{/if}
</div>

<style>
	.asset-inspector-controls {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: var(--spacing-sm) var(--spacing-md);
		min-height: 0;
		overflow: auto;
		flex: 1 1 auto;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	:global(.channel-trigger) {
		width: 100%;
		justify-content: flex-start;
		gap: 6px;
		font-size: 11px;
	}

	.stat-list {
		margin: 0;
		display: grid;
		gap: 6px;
	}

	.stat-list div {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.stat-list dt {
		margin: 0;
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.stat-list dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--foreground);
	}

	.material-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}

	.material-list li {
		display: grid;
		gap: 2px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		background: color-mix(in srgb, var(--card) 55%, transparent);
	}

	.material-list strong {
		font-size: 11px;
		color: var(--foreground);
	}

	.mat-type {
		font-size: 9px;
		font-family: var(--font-mono);
		color: var(--muted-foreground);
	}

	.material-maps {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 2px;
	}

	.material-maps span {
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 9px;
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		color: var(--muted-foreground);
	}

	.volume-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.volume-row input {
		width: 100%;
		accent-color: var(--primary);
	}

	.file-open {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--foreground);
		text-decoration: none;
		font-size: 12px;
	}

	.file-open:hover {
		text-decoration: underline;
	}

	.empty-hint,
	.hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}
</style>
