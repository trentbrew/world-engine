<script lang="ts">
	import { formatBytes } from '$lib/assets/catalog';
	import { assetPreview } from '$lib/ui/assetPreview.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	const preview = $derived(ui.previewContext);
	const asset = $derived(preview?.kind === 'asset' ? preview.asset : null);
	const shape = $derived(preview?.kind === 'shape' ? preview.shape : null);
	const gltfInspection = $derived(assetPreview.inspection);

	function metaRows(entry: { kind: string; url: string; size?: number }) {
		return [
			{ label: 'Kind', value: entry.kind },
			{ label: 'URL', value: entry.url },
			...(entry.size ? [{ label: 'Size', value: formatBytes(entry.size) }] : [])
		];
	}
</script>

<div class="asset-details-panel" role="region" aria-label="Asset details">
	{#if !preview}
		<p class="empty-hint">Select an asset to view metadata.</p>
	{:else}
		<h3 class="meta-heading">Metadata</h3>
		{#if asset}
			<dl class="meta-list">
				{#each metaRows(asset) as row (row.label)}
					<div>
						<dt>{row.label}</dt>
						<dd>{row.value}</dd>
					</div>
				{/each}
			</dl>
		{:else if shape}
			<dl class="meta-list">
				<div>
					<dt>Mesh</dt>
					<dd>{shape.mesh}</dd>
				</div>
				<div>
					<dt>Primitive</dt>
					<dd>{shape.thumb}</dd>
				</div>
			</dl>
		{/if}

		{#if gltfInspection}
			<h4 class="meta-subheading">Geometry</h4>
			<dl class="meta-list">
				<div>
					<dt>Meshes</dt>
					<dd>{gltfInspection.meshCount}</dd>
				</div>
				<div>
					<dt>Triangles</dt>
					<dd>{gltfInspection.triangleCount.toLocaleString()}</dd>
				</div>
				<div>
					<dt>Vertices</dt>
					<dd>{gltfInspection.vertexCount.toLocaleString()}</dd>
				</div>
				<div>
					<dt>Bounds (m)</dt>
					<dd>
						{gltfInspection.dimensions.x} × {gltfInspection.dimensions.y} ×
						{gltfInspection.dimensions.z}
					</dd>
				</div>
				{#if gltfInspection.skinnedMeshCount > 0}
					<div>
						<dt>Skinned meshes</dt>
						<dd>{gltfInspection.skinnedMeshCount}</dd>
					</div>
				{/if}
				{#if gltfInspection.boneCount > 0}
					<div>
						<dt>Bones</dt>
						<dd>{gltfInspection.boneCount}</dd>
					</div>
				{/if}
			</dl>

			{#if gltfInspection.animationNames.length > 0}
				<h4 class="meta-subheading">Embedded clips</h4>
				<ul class="meta-tags">
					{#each gltfInspection.animationNames as name (name)}
						<li>{name}</li>
					{/each}
				</ul>
			{/if}

			{#if gltfInspection.materials.length > 0}
				<h4 class="meta-subheading">Materials</h4>
				<ul class="material-list">
					{#each gltfInspection.materials as material, index (index)}
						<li>
							<strong>{material.name}</strong>
							<span>{material.type}</span>
							<span class="material-maps">
								{#if material.hasBaseColorMap}albedo{/if}
								{#if material.hasNormalMap}normal{/if}
								{#if material.hasEmissiveMap}emissive{/if}
								{#if material.hasRoughnessMap}rough{/if}
								{#if material.hasMetalnessMap}metal{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.asset-details-panel {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: var(--spacing-sm) var(--spacing-md);
	}

	.meta-heading,
	.meta-subheading {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.meta-subheading {
		margin-top: 14px;
	}

	.meta-list {
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.meta-list dt {
		margin: 0;
		font-size: 10px;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.meta-list dd {
		margin: 2px 0 0;
		font-family: var(--font-mono);
		font-size: 10px;
		overflow-wrap: anywhere;
	}

	.meta-tags {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.meta-tags li,
	.material-list li {
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--card) 80%, transparent);
		font-size: 10px;
		font-family: var(--font-mono);
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
	}

	.material-list strong {
		font-size: 10px;
	}

	.material-maps {
		color: var(--muted-foreground);
		font-size: 9px;
	}

	.empty-hint {
		margin: 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}
</style>
