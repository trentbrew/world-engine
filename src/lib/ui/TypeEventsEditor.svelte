<script lang="ts">
	import TypeBehaviorsPanel from '$lib/ui/TypeBehaviorsPanel.svelte';

	interface Props {
		typeName: string;
		readonly?: boolean;
	}

	let { typeName, readonly = false }: Props = $props();
</script>

<TypeBehaviorsPanel {typeName} {readonly} />
