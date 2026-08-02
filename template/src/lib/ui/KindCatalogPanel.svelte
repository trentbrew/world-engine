<script lang="ts">
	import type { AssetKind } from '$lib/assets/catalog';
	import AssetCatalogShell from '$lib/ui/AssetCatalogShell.svelte';
	import AssetSectionContent from '$lib/ui/AssetSectionContent.svelte';

	interface Props {
		kind: Exclude<AssetKind, 'models'>;
	}

	let { kind }: Props = $props();

	const labels: Record<Exclude<AssetKind, 'models'>, string> = {
		textures: 'Textures',
		audio: 'Audio',
		files: 'Files'
	};

	const label = $derived(labels[kind]);
</script>

<AssetCatalogShell searchPlaceholder="Search {label.toLowerCase()}…" catalogLabel={label}>
	<AssetSectionContent section={kind} />
</AssetCatalogShell>
