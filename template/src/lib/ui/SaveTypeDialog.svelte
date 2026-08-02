<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { z } from 'zod';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		captureTypeFromEntity,
		formatTypeDefaultsPreview,
		TYPE_NAME_PATTERN,
		validateTypeName
	} from '$lib/engine/ontology/captureType';
	import { isBuiltinType } from '$lib/engine/ontology/registry';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	const schema = z.object({
		name: z
			.string()
			.min(1, 'Type name is required')
			.regex(TYPE_NAME_PATTERN, 'Use PascalCase (e.g. FallingCrate)'),
		applyToEntity: z.boolean()
	});

	const form = superForm(defaults({ name: '', applyToEntity: true }, zod4(schema)), {
		validators: zod4(schema),
		SPA: true,
		resetForm: false,
		onUpdate({ form: f }) {
			if (!f.valid) return;
			const entityId = ui.saveTypeEntityId;
			if (!entityId) return;
			const data = f.data;
			const reserved = isBuiltinType(data.name);
			if (reserved) {
				f.errors.name = [`Type "${data.name}" is reserved`];
				return;
			}
			const valid = validateTypeName(data.name);
			if (!valid.ok) {
				f.errors.name = [valid.error];
				return;
			}
			const result = world.saveAsType(entityId, {
				name: data.name,
				applyToEntity: data.applyToEntity
			});
			if (!result.ok) {
				f.errors.name = [result.error];
				return;
			}
			toast.success(`Type ${data.name} saved`);
			ui.selectObjectType(data.name);
			ui.setRoute('objects');
			ui.saveTypeOpen = false;
		}
	});

	const { form: formData, enhance, reset } = form;

	const entity = $derived(
		ui.saveTypeEntityId ? world.getEntity(ui.saveTypeEntityId) : undefined
	);

	const captured = $derived(entity ? captureTypeFromEntity(entity) : null);
	const defaultLines = $derived(
		captured ? formatTypeDefaultsPreview(captured.defaults) : []
	);

	const nameError = $derived.by(() => {
		const name = $formData.name;
		if (!name) return null;
		if (isBuiltinType(name)) return `Type "${name}" is reserved`;
		const valid = validateTypeName(name);
		return valid.ok ? null : valid.error;
	});

	$effect(() => {
		if (!ui.saveTypeOpen) {
			reset();
			return;
		}
		if (entity && !$formData.name) {
			$formData.name = suggestedName(entity.id);
		}
	});

	function suggestedName(entityId: string): string {
		const slug = entityId.split('/').pop() ?? 'Type';
		const parts = slug.split(/[-_]+/).filter(Boolean);
		if (parts.length === 0) return 'CustomType';
		return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
	}
</script>

<Dialog.Root bind:open={ui.saveTypeOpen}>
	<Dialog.Content resizable class="sm:max-w-[420px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title id="save-type-title">Save as type</Dialog.Title>
		</Dialog.Header>

		<p id="save-type-desc" class="hint">
			Promote this entity's composition to a reusable EntityType in the world graph.
		</p>

		{#if entity && captured}
			<form method="POST" use:enhance class="space-y-4" aria-describedby="save-type-desc">
				<Form.Field {form} name="name">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Type name</Form.Label>
							<InputGroup.Root>
								<InputGroup.Input
									{...props}
									bind:value={$formData.name}
									aria-invalid={nameError ? 'true' : undefined}
									aria-describedby={nameError ? 'name-error' : undefined}
								/>
							</InputGroup.Root>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
					{#if nameError}
						<p id="name-error" class="field-error" role="alert">{nameError}</p>
					{/if}
				</Form.Field>

				<div class="field-block">
					<Label>Components captured</Label>
					<div class="chips">
						{#each captured.components as comp (comp)}
							<span class="chip">{comp}</span>
						{/each}
					</div>
				</div>

				<div class="field-block">
					<Label>Defaults (durable fields)</Label>
					<div class="preview-block">
						{#if defaultLines.length === 0}
							<span class="muted">No durable defaults</span>
						{:else}
							{#each defaultLines as line (line)}
								<div>{line}</div>
							{/each}
						{/if}
					</div>
					<p class="footnote">
						Position and other realtime fields are not saved on the type.
					</p>
				</div>

				<div class="checkbox-row">
					<Checkbox id="apply-type" bind:checked={$formData.applyToEntity} />
					<Label for="apply-type" class="checkbox-label">
						<strong>Apply type to this entity</strong>
						<span>Sets conformsTo on {entity.id.split('/').pop()}</span>
					</Label>
				</div>

				<div class="field-block">
					<Label>Preview</Label>
					<div class="preview-block type-preview">
						type:{$formData.name || '…'}<br />
						conformsTo: {$formData.name || '…'}
					</div>
				</div>

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (ui.saveTypeOpen = false)}>
						Cancel
					</Button>
					<Button type="submit" disabled={!!nameError}>Save</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<style>
	.hint {
		margin: 0 0 12px;
		font-size: 12px;
		color: var(--muted-foreground);
		line-height: 1.45;
	}

	.field-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-error {
		margin: 0;
		font-size: 11px;
		color: var(--destructive);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--card);
		border: 1px solid var(--border);
	}

	.preview-block {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted-foreground);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--viewport);
		line-height: 1.6;
		max-height: 120px;
		overflow-y: auto;
	}

	.type-preview {
		color: var(--foreground);
	}

	.muted {
		opacity: 0.7;
	}

	.footnote {
		margin: 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.checkbox-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	:global(.checkbox-label) {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	:global(.checkbox-label) strong {
		color: var(--foreground);
		font-weight: 500;
	}
</style>
