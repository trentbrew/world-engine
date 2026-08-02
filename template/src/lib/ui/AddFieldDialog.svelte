<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { listCollections } from '$lib/engine/ontology/registry';
	import type { FieldType, RefTarget } from '$lib/engine/ontology/schema';
	import { buildFieldSchema, validateFieldName } from '$lib/engine/runtime/schemaAccess';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type Props = {
		open?: boolean;
		/** The editable type (object or collection) to add a field to. */
		typeName: string | null;
		/** Noun for the copy — "record" for collections, "instance" for objects. */
		unit?: string;
	};

	let { open = $bindable(false), typeName, unit = 'record' }: Props = $props();

	let fieldName = $state('');
	let fieldType = $state<FieldType>('string');
	let refKind = $state<'record' | 'asset' | 'entity'>('record');
	let refCollection = $state('');
	let optionsText = $state('');
	let targetComponent = $state('');
	let newComponent = $state('');

	function parseOptions(): string[] {
		return optionsText
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
	}

	const editableComponents = $derived.by(() => {
		void world.componentRevision;
		return typeName ? world.editableComponentsForType(typeName) : [];
	});

	const needsComponentPick = $derived(editableComponents.length > 1);
	const needsNewComponent = $derived(editableComponents.length === 0);

	const fieldError = $derived.by(() => {
		const valid = validateFieldName(fieldName);
		if (!valid.ok) return valid.error;
		return '';
	});

	$effect(() => {
		if (!open) {
			fieldName = '';
			fieldType = 'string';
			refKind = 'record';
			refCollection = '';
			optionsText = '';
			targetComponent = '';
			newComponent = '';
		} else if (typeName) {
			newComponent = `${typeName}Data`;
			if (editableComponents.length === 1) targetComponent = editableComponents[0] ?? '';
			const cols = listCollections().filter((name) => name !== typeName);
			if (cols.length > 0) refCollection = cols[0] ?? '';
		}
	});

	function refTarget(): RefTarget | undefined {
		if (fieldType !== 'ref') return undefined;
		if (refKind === 'record') {
			if (!refCollection.trim()) return undefined;
			return { kind: 'record', collection: refCollection.trim() };
		}
		if (refKind === 'asset') return { kind: 'asset' };
		return { kind: 'entity' };
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!typeName || fieldError) return;
		if (fieldType === 'ref' && refKind === 'record' && !refCollection.trim()) {
			toast.error('Choose a target collection for this ref');
			return;
		}
		if (fieldType === 'select' && parseOptions().length === 0) {
			toast.error('Add at least one option for a select field');
			return;
		}
		if (needsComponentPick && !targetComponent) {
			toast.error('Choose a component to extend');
			return;
		}
		if (needsNewComponent && !newComponent.trim()) {
			toast.error('Name the new schema component');
			return;
		}

		const spec = buildFieldSchema(fieldType, {
			of: refTarget(),
			options: fieldType === 'select' ? parseOptions() : undefined
		});
		const result = world.addTypeField(typeName, {
			component: needsComponentPick ? targetComponent : undefined,
			newComponent: needsNewComponent ? newComponent.trim() : undefined,
			field: fieldName.trim(),
			spec
		});

		if (!result.ok) {
			toast.error(result.error);
			return;
		}

		toast.success(`Added field ${fieldName.trim()}`);
		ui.bumpSchemaRevision();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[400px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title id="add-field-title">Add field</Dialog.Title>
			{#if typeName}
				<Dialog.Description>
					New field on every <strong>{typeName}</strong>
					{unit}.
				</Dialog.Description>
			{/if}
		</Dialog.Header>

		<form method="POST" class="space-y-4" onsubmit={submit}>
			{#if needsNewComponent}
				<div class="space-y-2">
					<Label for="new-schema-component">Schema component</Label>
					<input
						id="new-schema-component"
						class="field-input"
						bind:value={newComponent}
						autocomplete="off"
						aria-describedby="new-schema-component-hint"
					/>
					<p id="new-schema-component-hint" class="hint">
						This type has no editable schema yet — a new component will be created and attached.
					</p>
				</div>
			{:else if needsComponentPick}
				<div class="space-y-2">
					<Label for="target-component">Component</Label>
					<select id="target-component" class="field-input" bind:value={targetComponent}>
						{#each editableComponents as name (name)}
							<option value={name}>{name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="field-name">Field name</Label>
				<input
					id="field-name"
					class="field-input"
					placeholder="powerLevel"
					bind:value={fieldName}
					autocomplete="off"
				/>
				{#if fieldError}
					<p class="field-error">{fieldError}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="field-type">Type</Label>
				<select id="field-type" class="field-input" bind:value={fieldType}>
					<option value="string">Text</option>
					<option value="longtext">Long text</option>
					<option value="number">Number</option>
					<option value="boolean">Boolean</option>
					<option value="select">Select</option>
					<option value="color">Color</option>
					<option value="ref">Reference</option>
				</select>
			</div>

			{#if fieldType === 'select'}
				<div class="space-y-2">
					<Label for="field-options">Options</Label>
					<input
						id="field-options"
						class="field-input"
						placeholder="low, medium, high"
						bind:value={optionsText}
						autocomplete="off"
						aria-describedby="field-options-hint"
					/>
					<p id="field-options-hint" class="hint">Comma-separated. First is the default.</p>
				</div>
			{/if}

			{#if fieldType === 'ref'}
				<div class="space-y-2">
					<Label for="ref-kind">Reference target</Label>
					<select id="ref-kind" class="field-input" bind:value={refKind}>
						<option value="record">Another collection record</option>
						<option value="asset">Asset</option>
						<option value="entity">Room entity</option>
					</select>
				</div>
				{#if refKind === 'record'}
					<div class="space-y-2">
						<Label for="ref-collection">Collection</Label>
						<select id="ref-collection" class="field-input" bind:value={refCollection}>
							{#each listCollections() as name (name)}
								<option value={name}>{name}</option>
							{/each}
						</select>
					</div>
				{/if}
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!fieldError || !fieldName.trim()}>Add field</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<style>
	.field-input {
		width: 100%;
		height: 32px;
		padding: 0 10px;
		border-radius: var(--field-control-radius, 6px);
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		background: var(--background);
		font-size: 13px;
	}

	select.field-input {
		cursor: pointer;
	}

	.field-error {
		margin: 0;
		font-size: 11px;
		color: var(--destructive);
	}

	.hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}
</style>
