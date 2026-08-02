<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { entityDestroy } from '$lib/ui/entityDestroy.svelte';
	import { shortEntityId } from '$lib/ui/keyboardLabels';

	const selected = $derived(world.selectedEntity);
	const label = $derived(selected ? shortEntityId(selected.id) : 'this entity');
</script>

<AlertDialog.Root bind:open={entityDestroy.open}>
	<AlertDialog.Content resizable>
		<AlertDialog.Header>
			<AlertDialog.Title>Destroy entity?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes <strong>{label}</strong> from the scene. This can't be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => entityDestroy.cancel()}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={() => entityDestroy.confirm()}>
				Destroy
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
