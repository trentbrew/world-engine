<script lang="ts">
	import AssetCatalogShell from '$lib/ui/AssetCatalogShell.svelte';
	import AssetSectionContent from '$lib/ui/AssetSectionContent.svelte';
</script>

<AssetCatalogShell searchPlaceholder="Search models…" catalogLabel="Models">
	<section class="catalog-section" aria-label="Primitives">
		<h3 class="section-heading">Primitives</h3>
		<AssetSectionContent section="shapes" embedded />
	</section>
	<section class="catalog-section" aria-label="Models">
		<h3 class="section-heading">Models</h3>
		<AssetSectionContent section="models" embedded />
	</section>
</AssetCatalogShell>

<style>
	.catalog-section + .catalog-section {
		margin-top: 12px;
	}

	.section-heading {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
</style>
