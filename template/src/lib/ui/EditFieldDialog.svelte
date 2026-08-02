<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { getComponent, listCollections } from '$lib/engine/ontology/registry';
	import type { FieldSchema, FieldType, RefTarget } from '$lib/engine/ontology/schema';
	import { buildFieldSchema, validateFieldName } from '$lib/engine/runtime/schemaAccess';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type FieldTarget = { component: string; field: string };

	type Props = {
		open?: boolean;
		target?: FieldTarget | null;
		typeName?: string | null;
		unit?: string;
	};

	let {
		open = $bindable(false),
		target = $bindable<FieldTarget | null>(null),
		typeName = null,
		unit = 'record'
	}: Props = $props();

	let originalField = $state('');
	let fieldName = $state('');
	let fieldType = $state<FieldType>('string');
	let refKind = $state<'record' | 'asset' | 'entity'>('record');
	let refCollection = $state('');
	let optionsText = $state('');
	let preservedDefault = $state<unknown>(undefined);

	function parseOptions(): string[] {
		return optionsText
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
	}

	const fieldError = $derived.by(() => {
		const valid = validateFieldName(fieldName);
		if (!valid.ok) return valid.error;
		const trimmed = fieldName.trim();
		if (
			trimmed !== originalField &&
			target &&
			getComponent(target.component)?.fields[trimmed]
		) {
			return `Field "${trimmed}" already exists`;
		}
		return '';
	});

	let seededKey = $state('');

	$effect(() => {
		if (!open || !target) {
			seededKey = '';
			return;
		}
		// Seed the form once per opened target; never re-seed (would clobber edits).
		const key = `${target.component}.${target.field}`;
		if (key === seededKey) return;
		const schema = getComponent(target.component)?.fields[target.field];
		if (!schema) return;
		seededKey = key;

		originalField = target.field;
		fieldName = target.field;
		fieldType = schema.t;
		preservedDefault = schema.default;
		optionsText = schema.options?.join(', ') ?? '';
		if (schema.of?.kind === 'record') {
			refKind = 'record';
			refCollection = schema.of.collection;
		} else if (schema.of?.kind === 'asset') {
			refKind = 'asset';
			refCollection = '';
		} else if (schema.of?.kind === 'entity') {
			refKind = 'entity';
			refCollection = '';
		} else {
			refKind = 'record';
			const cols = listCollections().filter((name) => name !== typeName);
			refCollection = cols[0] ?? '';
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
		if (!target || fieldError) return;
		// `target.field` is the authoritative original name (synchronous); don't rely
		// on the effect-populated `originalField`, which can lag a fast submit.
		const original = target.field;
		const current = getComponent(target.component)?.fields[original];
		if (!current) return;
		if (fieldType === 'ref' && refKind === 'record' && !refCollection.trim()) {
			toast.error('Choose a target collection for this ref');
			return;
		}
		if (fieldType === 'select' && parseOptions().length === 0) {
			toast.error('Add at least one option for a select field');
			return;
		}

		const trimmed = fieldName.trim();
		const finalName = trimmed || original;
		if (finalName !== original) {
			const renamed = world.renameComponentField(target.component, original, finalName);
			if (!renamed.ok) {
				toast.error(renamed.error);
				return;
			}
		}

		// If the form was populated for this target (effect ran), use its edited
		// values; otherwise preserve the existing spec so a fast submit only renames.
		const initialized = originalField === original;
		const spec = initialized
			? buildFieldSchema(fieldType, {
					of: refTarget(),
					options: fieldType === 'select' ? parseOptions() : undefined,
					default: preservedDefault ?? current.default
				})
			: structuredClone(current);
		const edited = world.editComponentField(target.component, finalName, spec);
		if (!edited.ok) {
			toast.error(edited.error);
			return;
		}

		toast.success(finalName === original ? `Updated field ${finalName}` : `Renamed field to ${finalName}`);
		ui.bumpSchemaRevision();
		open = false;
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(next) => {
		open = next;
		if (!next) target = null;
	}}
>
	<Dialog.Content class="sm:max-w-[400px]" showCloseButton={true}>
		<Dialog.Header>
			<Dialog.Title id="edit-field-title">Edit field</Dialog.Title>
			{#if typeName && target}
				<Dialog.Description>
					Edit <strong>{target.component}.{originalField || target.field}</strong> on every
					<strong>{typeName}</strong>
					{unit}.
				</Dialog.Description>
			{/if}
		</Dialog.Header>

		{#if target}
			<form method="POST" class="space-y-4" onsubmit={submit}>
				<div class="space-y-2">
					<Label for="edit-field-name">Field name</Label>
					<input
						id="edit-field-name"
						class="field-input"
						bind:value={fieldName}
						autocomplete="off"
					/>
					{#if fieldError}
						<p class="field-error">{fieldError}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="edit-field-type">Type</Label>
					<select id="edit-field-type" class="field-input" bind:value={fieldType}>
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
						<Label for="edit-field-options">Options</Label>
						<input
							id="edit-field-options"
							class="field-input"
							placeholder="low, medium, high"
							bind:value={optionsText}
							autocomplete="off"
							aria-describedby="edit-field-options-hint"
						/>
						<p id="edit-field-options-hint" class="hint">Comma-separated. First is the default.</p>
					</div>
				{/if}

				{#if fieldType === 'ref'}
					<div class="space-y-2">
						<Label for="edit-ref-kind">Reference target</Label>
						<select id="edit-ref-kind" class="field-input" bind:value={refKind}>
							<option value="record">Another collection record</option>
							<option value="asset">Asset</option>
							<option value="entity">Room entity</option>
						</select>
					</div>
					{#if refKind === 'record'}
						<div class="space-y-2">
							<Label for="edit-ref-collection">Collection</Label>
							<select id="edit-ref-collection" class="field-input" bind:value={refCollection}>
								{#each listCollections() as name (name)}
									<option value={name}>{name}</option>
								{/each}
							</select>
						</div>
					{/if}
				{/if}

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" disabled={!!fieldError || !fieldName.trim()}>Save field</Button>
				</Dialog.Footer>
			</form>
		{/if}
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
