<script lang="ts">
	import { T } from '@threlte/core';
	import { ui } from '$lib/ui/ui.svelte';

	const visible = $derived(ui.shellMode === 'edit');
	const length = 4;
</script>

{#if visible}
	<T.AxesHelper args={[length]} renderOrder={3} />
{/if}
