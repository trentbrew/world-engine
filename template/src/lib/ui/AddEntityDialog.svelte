<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { z } from 'zod';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { BUILTIN_TYPE_NAMES, getType, listWorldTypes } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	const builtInTypes = [...BUILTIN_TYPE_NAMES].filter((name) =>
		['Prop', 'SpawnPoint', 'GroundPlane'].includes(name)
	);

	const schema = z.object({
		conformsTo: z.string().min(1),
		suffix: z
			.string()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, hyphens')
	});

	const form = superForm(defaults({ conformsTo: 'Prop', suffix: '' }, zod4(schema)), {
		validators: zod4(schema),
		SPA: true,
		resetForm: true,
		onUpdate({ form: f }) {
			if (!f.valid) return;
			const data = f.data;
			if (!getType(data.conformsTo)) {
				f.errors.conformsTo = ['Unknown type'];
				return;
			}
			const entity = world.spawnFromType(data.conformsTo, data.suffix);
			if (!entity) {
				f.errors.suffix = ['Could not spawn — id may already exist'];
				return;
			}
			toast.success(`${entity.id} created`);
			ui.addEntityOpen = false;
		}
	});

	const { form: formData, enhance, reset } = form;

	const worldTypes = $derived(listWorldTypes());

	const allTypes = $derived([...builtInTypes, ...worldTypes]);

	const preview = $derived(
		`entity:${$formData.conformsTo.toLowerCase()}/${$formData.suffix || '…'}`
	);

	const selectedLabel = $derived(
		allTypes.find((type) => type === $formData.conformsTo) ?? 'Select type'
	);

	$effect(() => {
		if (!ui.addEntityOpen) reset();
	});
</script>

<Dialog.Root bind:open={ui.addEntityOpen}>
	<Dialog.Content resizable class="sm:max-w-[420px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title id="add-entity-title">Add entity</Dialog.Title>
		</Dialog.Header>

		<form method="POST" use:enhance class="space-y-4">
			<Form.Field {form} name="conformsTo">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>conformsTo</Form.Label>
						<Select.Root type="single" bind:value={$formData.conformsTo} name={props.name}>
							<Select.Trigger class="w-full" {...props} id={props.id}>
								{selectedLabel}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.GroupHeading>Built-in</Select.GroupHeading>
									{#each builtInTypes as type (type)}
										<Select.Item value={type} label={type}>{type}</Select.Item>
									{/each}
								</Select.Group>
								{#if worldTypes.length > 0}
									<Select.Group>
										<Select.GroupHeading>World types</Select.GroupHeading>
										{#each worldTypes as type (type)}
											<Select.Item value={type} label={type}>{type}</Select.Item>
										{/each}
									</Select.Group>
								{/if}
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="suffix">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>@id suffix</Form.Label>
						<InputGroup.Root>
							<InputGroup.Input {...props} bind:value={$formData.suffix} placeholder="crate-c" />
						</InputGroup.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<div class="space-y-2">
				<Label>preview</Label>
				<div
					class="font-mono text-[11px] text-muted-foreground rounded-md border border-border bg-[var(--viewport)] px-2 py-2"
				>
					{preview}
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (ui.addEntityOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
