<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	interface Props {
		typeName: string;
	}

	let { typeName }: Props = $props();

	const addable = $derived(world.addableTypeComponents(typeName));

	function add(name: string) {
		if (world.addTypeComponent(typeName, name)) {
			toast.success(`Added ${name}`);
		} else {
			toast.error(`Could not add ${name}`);
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				size="sm"
				class="add-type-component-btn inspector-footer-btn"
				disabled={addable.length === 0}
				aria-label="Add capability"
			>
				<PlusIcon class="size-3.5" aria-hidden="true" />
				Add capability
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start" class="add-type-component-menu">
		{#if addable.length === 0}
			<DropdownMenu.Item disabled>No capabilities available</DropdownMenu.Item>
		{:else}
			{#each addable as name (name)}
				<DropdownMenu.Item onclick={() => add(name)}>{name}</DropdownMenu.Item>
			{/each}
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>

<style>
	:global(.add-type-component-btn) {
		gap: 6px;
	}

	:global(.add-type-component-menu) {
		max-height: 240px;
		overflow-y: auto;
	}
</style>
