<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { getComponent, getType, isBuiltinComponent, isBuiltinType } from '$lib/engine/ontology/registry';
	import {
		canEditTypeDefaultField,
		canEditTypeDefaults,
		canRemoveTypeComponent,
		isEditableObjectType
	} from '$lib/engine/runtime/typeAccess';
	import { world } from '$lib/engine/runtime/world.svelte';
	import AddTypeComponentMenu from '$lib/ui/AddTypeComponentMenu.svelte';
	import AddFieldDialog from '$lib/ui/AddFieldDialog.svelte';
	import EditFieldDialog from '$lib/ui/EditFieldDialog.svelte';
	import ColumnsIcon from '@lucide/svelte/icons/columns-3';
	import InspectorEmptyState from '$lib/ui/InspectorEmptyState.svelte';
	import { layoutComponentFields } from '$lib/ui/inspectorFieldLayout';
	import TypeDefaultFieldInput from '$lib/ui/TypeDefaultFieldInput.svelte';
	import TypeDefaultRangeField from '$lib/ui/TypeDefaultRangeField.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	interface Props {
		/** When true, omit the type header (parent inspector owns it). */
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();

	function fieldsForComponent(component: string): [string, unknown][] {
		// Use the schema revision in the returned branch so field rows update after
		// add/delete without relying on stripped `void world.*Revision` reads.
		const rev = ui.schemaRevision + world.componentRevision + world.typeRevision;
		const schema = getComponent(component);
		// Behaviors panel owns Mesh3DAnimator.locomotion editing — hide raw json here.
		const keys = Object.keys(schema?.fields ?? {}).filter(
			(key) => !(component === 'Mesh3DAnimator' && key === 'locomotion')
		);
		const fields = keys.map((key) => [key, world.typeDefaultValue(ui.selectedObjectType!, component, key)] as [
			string,
			unknown
		]);
		return rev >= 0 ? fields : fields;
	}

	function fieldRowsForComponent(component: string) {
		const fields = fieldsForComponent(component);
		const values = new Map(fields);
		return layoutComponentFields(
			component,
			fields.map(([name]) => name)
		).map((row) => ({
			...row,
			entries: row.fields.map((name) => [name, values.get(name)] as [string, unknown])
		}));
	}

	const typeName = $derived(ui.selectedObjectType);
	const objectType = $derived.by(() => {
		// ui.schemaRevision (proven-reactive) drives recompute when a field/component
		// is added; used in the condition so the dep survives dead-code elimination.
		const rev = ui.schemaRevision + world.typeRevision;
		return typeName && rev >= 0 ? getType(typeName) : undefined;
	});
	const editable = $derived(typeName ? isEditableObjectType(typeName) : false);
	const defaultsEditable = $derived(typeName ? canEditTypeDefaults(typeName) : false);
	const componentNames = $derived(objectType?.components ?? []);
	let openSections = $derived(componentNames.length > 0 ? [...componentNames] : []);
	let addFieldOpen = $state(false);
	let editFieldOpen = $state(false);
	let editFieldTarget = $state<{ component: string; field: string } | null>(null);

	function fieldReadonly(component: string, field: string): boolean {
		if (!typeName) return true;
		return !canEditTypeDefaultField(typeName, component, field);
	}

	function removeComponent(name: string) {
		if (!typeName) return;
		if (world.removeTypeComponent(typeName, name)) {
			toast.success(`Removed ${name}`);
			openSections = openSections.filter((section) => section !== name);
		} else {
			toast.error(`Cannot remove ${name}`);
		}
	}

	function deleteField(component: string, field: string) {
		const result = world.removeComponentField(component, field);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success(`Removed field ${field}`);
		ui.bumpSchemaRevision();
	}

	function openEditField(component: string, field: string) {
		editFieldTarget = { component, field };
		editFieldOpen = true;
	}

	function openCreateFromInstance() {
		const entity = world.selectedEntity;
		if (!entity) {
			toast.error('Select an instance in Rooms first');
			return;
		}
		ui.saveTypeEntityId = entity.id;
		ui.saveTypeOpen = true;
	}
</script>

<aside class="object-type-editor" aria-label="Object type editor">
	{#if !embedded}
		<div class="panel-header">
			{#if objectType && typeName}
				<div class="header-row">
					<span class="header-title">{typeName}</span>
					{#if isBuiltinType(typeName)}
						<Badge variant="outline" class="type-badge">Built-in</Badge>
					{:else}
						<Badge variant="outline" class="type-badge">Custom</Badge>
					{/if}
				</div>
				<p class="header-hint">
					{#if editable}
						Define what every instance of this object carries into a room.
					{:else if typeName === 'Player' && defaultsEditable}
						Visual defaults apply to the avatar this world spawns. Duplicate to customize composition.
					{:else}
						Built-in template — duplicate to customize, or place instances in Rooms.
					{/if}
				</p>
			{:else}
				<span class="header-muted">No object type selected</span>
			{/if}
		</div>
	{:else if objectType && typeName}
		<p class="header-hint embedded-hint">
			{#if editable}
				Define what every instance of this object carries into a room.
			{:else if typeName === 'Player' && defaultsEditable}
				Visual defaults apply to the avatar this world spawns. Duplicate to customize composition.
			{:else}
				Built-in template — duplicate to customize, or place instances in Rooms.
			{/if}
		</p>
	{/if}

	<div class="panel-body">
		{#if objectType && typeName}
			{#if componentNames.length === 0}
				<InspectorEmptyState
					title="No capabilities"
					hint="Add capabilities to define what this object type includes."
				/>
			{:else}
				<Accordion.Root type="multiple" bind:value={openSections} class="inspector-accordion">
					{#each componentNames as name (name)}
						<Accordion.Item value={name}>
							<div class="component-header">
								<Accordion.Trigger class="inspector-trigger component-trigger">{name}</Accordion.Trigger>
								{#if editable && canRemoveTypeComponent(typeName, name)}
									<Button
										variant="ghost"
										size="icon"
										class="remove-component"
										aria-label="Remove {name} capability"
										onclick={(event) => {
											event.stopPropagation();
											removeComponent(name);
										}}
									>
										<XIcon class="size-3" aria-hidden="true" />
									</Button>
								{/if}
							</div>
							<Accordion.Content class="inspector-content">
								{#each fieldRowsForComponent(name) as row (row.key)}
									{#if row.widget === 'header'}
										<div class="field-subsection">{row.label ?? row.key}</div>
									{:else if row.widget === 'range' && row.fields.length === 2}
										<TypeDefaultRangeField
											{typeName}
											component={name}
											minField={row.fields[0]}
											maxField={row.fields[1]}
											label={row.label ?? row.key}
											readonly={fieldReadonly(name, row.fields[0]) ||
												fieldReadonly(name, row.fields[1])}
										/>
									{:else}
										{#each row.entries as [field] (field)}
											{#if editable && !isBuiltinComponent(name)}
												<div class="type-field-row">
													<TypeDefaultFieldInput
														{typeName}
														component={name}
														{field}
														readonly={fieldReadonly(name, field)}
													/>
													<button
														type="button"
														class="field-edit"
														aria-label="Edit field {field}"
														onclick={() => openEditField(name, field)}
													>
														<PencilIcon class="size-3" aria-hidden="true" />
													</button>
													<button
														type="button"
														class="field-delete"
														aria-label="Delete field {field}"
														onclick={() => deleteField(name, field)}
													>
														<XIcon class="size-3" aria-hidden="true" />
													</button>
												</div>
											{:else}
												<TypeDefaultFieldInput
													{typeName}
													component={name}
													{field}
													readonly={fieldReadonly(name, field)}
												/>
											{/if}
										{/each}
									{/if}
								{/each}
							</Accordion.Content>
						</Accordion.Item>
					{/each}
				</Accordion.Root>
			{/if}
		{:else}
			<InspectorEmptyState
				title="Select an object type"
				hint="Pick a type in the left panel to edit its capabilities and defaults."
			/>
		{/if}
	</div>

	{#if editable && typeName}
		<div class="type-footer type-footer--row">
			<AddTypeComponentMenu {typeName} />
			<Button
				variant="outline"
				size="sm"
				class="inspector-footer-btn"
				onclick={() => (addFieldOpen = true)}
			>
				<ColumnsIcon class="size-3.5" aria-hidden="true" />
				Add field
			</Button>
		</div>
	{:else if typeName && !editable}
		<div class="type-footer type-footer--stacked">
			<Button
				variant="outline"
				size="sm"
				class="inspector-footer-btn"
				onclick={() => ui.openNewObjectTypeDialog(typeName)}
			>
				Duplicate type…
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="inspector-footer-btn"
				onclick={openCreateFromInstance}
			>
				Create from room selection…
			</Button>
		</div>
	{/if}
</aside>

<AddFieldDialog bind:open={addFieldOpen} {typeName} unit="instance" />
<EditFieldDialog bind:open={editFieldOpen} bind:target={editFieldTarget} {typeName} unit="instance" />

<style>
	.object-type-editor {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
		height: 100%;
		width: 100%;
		pointer-events: auto;
	}

	.panel-header {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		flex-shrink: 0;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.header-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 13px;
	}

	.header-muted {
		color: var(--muted-foreground);
		font-weight: 500;
		font-size: 13px;
	}

	.header-hint {
		margin: 6px 0 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.embedded-hint {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md) 0;
		flex-shrink: 0;
	}

	:global(.type-badge) {
		font-family: var(--font-mono);
		font-size: 10px;
		flex-shrink: 0;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.type-footer {
		flex-shrink: 0;
		padding: var(--spacing-sm);
		border-top: 1px solid color-mix(in srgb, var(--border) 20%, transparent);
	}

	.type-footer--stacked {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.type-footer--row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.type-footer--row :global(.inspector-footer-btn) {
		flex-shrink: 0;
	}

	:global(.inspector-accordion) {
		padding: var(--spacing-sm) var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.inspector-trigger) {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
		padding-left: 0;
		padding-right: 0;
		position: sticky;
		top: 0;
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		z-index: 10;
	}

	:global(.inspector-content) {
		padding-left: var(--spacing-md);
		padding-right: 0;
	}

	.component-header {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	:global(.component-trigger) {
		flex: 1;
		min-width: 0;
	}

	:global(.remove-component) {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		color: var(--muted-foreground);
	}

	.field-subsection {
		margin: 10px 0 6px;
		padding-top: 8px;
		border-top: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.type-field-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.type-field-row :global(.field-row) {
		flex: 1;
		min-width: 0;
	}

	.field-edit,
	.field-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--muted-foreground);
		opacity: 0.55;
		cursor: pointer;
	}

	.type-field-row:hover .field-edit,
	.type-field-row:hover .field-delete,
	.field-edit:focus-visible,
	.field-delete:focus-visible {
		opacity: 1;
	}

	.field-edit:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.field-delete:hover {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}
</style>
