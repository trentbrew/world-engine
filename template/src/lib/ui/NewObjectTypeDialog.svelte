<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { validateTypeName } from '$lib/engine/ontology/captureType';
	import { getType } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	let name = $state('');
	const cloneFrom = $derived(ui.newObjectTypeCloneFrom);

	const nameError = $derived.by(() => {
		const trimmed = name.trim();
		if (!trimmed) return 'Name required';
		const valid = validateTypeName(trimmed);
		if (!valid.ok) return valid.error;
		if (getType(trimmed)) return `Type "${trimmed}" already exists`;
		return '';
	});

	$effect(() => {
		if (!ui.newObjectTypeOpen) {
			name = '';
			ui.newObjectTypeCloneFrom = null;
		}
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (nameError) return;
		const result = world.createObjectType(name.trim(), {
			cloneFrom: cloneFrom ?? undefined
		});
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		const created = name.trim();
		toast.success(`Created ${created}`);
		ui.selectObjectType(created);
		ui.newObjectTypeOpen = false;
	}
</script>

<Dialog.Root bind:open={ui.newObjectTypeOpen}>
	<Dialog.Content class="sm:max-w-[380px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title id="new-object-type-title">New object type</Dialog.Title>
		</Dialog.Header>

		<form method="POST" class="space-y-4" onsubmit={submit}>
			<div class="space-y-2">
				<Label for="new-object-type-name">Type name</Label>
				<input
					id="new-object-type-name"
					class="create-name"
					placeholder="FallingCrate"
					bind:value={name}
					autocomplete="off"
				/>
				{#if nameError}
					<p class="field-error">{nameError}</p>
				{/if}
			</div>

			{#if cloneFrom}
				<p class="hint">Duplicating from <strong>{cloneFrom}</strong>.</p>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (ui.newObjectTypeOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={!!nameError}>Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<style>
	.create-name {
		width: 100%;
		height: 30px;
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--field-control-radius);
		background: var(--card);
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
	}

	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.field-error {
		margin: 0;
		font-size: 11px;
		color: var(--destructive);
	}
</style>
