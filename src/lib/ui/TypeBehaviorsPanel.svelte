<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import {
		applyLocomotionOverride,
		getLocomotionBindings,
		loadCatalog,
		LOCOMOTION_BINDING_KEYS,
		parseLocomotionOverride,
		type LocomotionBindingKey,
		type LocomotionBindings
	} from '$lib/engine/animation/clipCatalog';
	import type { EventAction } from '$lib/engine/ontology/schema';
	import { canEditTypeDefaultField } from '$lib/engine/runtime/typeAccess';
	import { world } from '$lib/engine/runtime/world.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';
	import {
		ACTION_KINDS,
		BEHAVIOR_TRIGGERS,
		createTypeEventsEditorModel
	} from '$lib/ui/typeEventsEditorModel.svelte';

	interface Props {
		typeName: string;
		readonly?: boolean;
	}

	let { typeName, readonly = false }: Props = $props();

	const model = createTypeEventsEditorModel(
		() => typeName,
		() => readonly
	);

	const LOCOMOTION_LABELS: Record<LocomotionBindingKey, string> = {
		idle: 'Idle',
		walk: 'Walk',
		jog: 'Jog',
		run: 'Run',
		sprint: 'Sprint',
		jumpStart: 'Jump start',
		jumpLoop: 'Jump loop',
		jumpLand: 'Jump land',
		doubleJumpStart: 'Double-jump start',
		doubleJumpLoop: 'Double-jump loop',
		doubleJumpLand: 'Double-jump land'
	};

	const locomotionEditable = $derived(
		canEditTypeDefaultField(typeName, 'Mesh3DAnimator', 'locomotion')
	);

	let locomotionRows = $state<
		{ key: LocomotionBindingKey; label: string; clip: string; catalogClip: string }[]
	>([]);
	let clipOptions = $state<string[]>([]);

	$effect(() => {
		const catalog = model.animatorCatalog;
		void world.typeRevision;
		void ui.schemaRevision;
		if (!catalog) {
			locomotionRows = [];
			clipOptions = [];
			return;
		}
		let cancelled = false;
		const override = parseLocomotionOverride(
			world.typeDefaultValue(typeName, 'Mesh3DAnimator', 'locomotion')
		);
		void Promise.all([getLocomotionBindings(catalog), loadCatalog(catalog)]).then(
			([pack, cat]) => {
				if (cancelled) return;
				const bindings = applyLocomotionOverride(pack.bindings, override);
				locomotionRows = LOCOMOTION_BINDING_KEYS.filter((key) => pack.bindings[key]).map(
					(key) => ({
						key,
						label: LOCOMOTION_LABELS[key],
						clip: bindings[key],
						catalogClip: pack.bindings[key]
					})
				);
				const ids = (cat.clips ?? []).map((c) => c.id).filter(Boolean);
				clipOptions = [...new Set([...ids, ...Object.values(pack.bindings)])].sort();
			}
		);
		return () => {
			cancelled = true;
		};
	});

	function setLocomotionBinding(key: LocomotionBindingKey, clipId: string) {
		if (!locomotionEditable) return;
		if (!clipOptions.includes(clipId)) {
			toast.error(`Unknown clip: ${clipId}`);
			return;
		}
		const current = parseLocomotionOverride(
			world.typeDefaultValue(typeName, 'Mesh3DAnimator', 'locomotion')
		);
		const next: Partial<LocomotionBindings> = { ...current };
		const catalogDefault = locomotionRows.find((r) => r.key === key)?.catalogClip;
		if (catalogDefault && clipId === catalogDefault) {
			delete next[key];
		} else {
			next[key] = clipId;
		}
		const ok = world.setTypeDefault(typeName, 'Mesh3DAnimator', 'locomotion', next);
		if (!ok) toast.error('Could not save locomotion binding');
		else toast.success(`${LOCOMOTION_LABELS[key]} → ${clipId}`);
	}
</script>

<section class="type-behaviors" aria-label="Type events">
	{#snippet actionParamFields()}
		<div class="field-row">
			<span class="field-label">Action</span>
			<div class="field-row-control">
				<FieldWell>
					<select bind:value={model.actionKind} aria-label="Event action" class="field-value">
						{#each ACTION_KINDS as option (option.id)}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</FieldWell>
			</div>
		</div>

		{#if model.actionKind === 'set'}
			<div class="field-row">
				<span class="field-label">Field</span>
				<div class="field-row-control">
					<FieldWell disabled={model.fieldOptions.length === 0}>
						<select
							bind:value={model.fieldPath}
							disabled={model.fieldOptions.length === 0}
							aria-label="Set field path"
							class="field-value"
						>
							<option value="">Choose field</option>
							{#each model.fieldOptions as option (option.path)}
								<option value={option.path}>{option.path}</option>
							{/each}
						</select>
					</FieldWell>
				</div>
			</div>
			<div class="field-row">
				<span class="field-label">Value</span>
				<div class="field-row-control">
					<FieldWell>
						<input
							type="text"
							bind:value={model.rawValue}
							aria-label="Set field value"
							class="field-value field-value--left"
							placeholder={model.selectedField?.schema.default != null
								? String(model.selectedField.schema.default)
								: 'value'}
						/>
					</FieldWell>
				</div>
			</div>
		{:else if model.actionKind === 'spawn'}
			<div class="field-row">
				<span class="field-label">Type</span>
				<div class="field-row-control">
					<FieldWell disabled={model.spawnTypeOptions.length === 0}>
						<select
							bind:value={model.spawnType}
							disabled={model.spawnTypeOptions.length === 0}
							aria-label="Spawn type"
							class="field-value"
						>
							{#each model.spawnTypeOptions as name (name)}
								<option value={name}>{name}</option>
							{/each}
						</select>
					</FieldWell>
				</div>
			</div>
		{:else if model.actionKind === 'destroy'}
			<div class="field-row">
				<span class="field-label">Target</span>
				<div class="field-row-control">
					<FieldWell>
						<select bind:value={model.destroyTarget} class="field-value">
							<option value="self">self</option>
						</select>
					</FieldWell>
				</div>
			</div>
		{:else if model.actionKind === 'score'}
			<div class="field-row">
				<span class="field-label">Points</span>
				<div class="field-row-control">
					<FieldWell>
						<input
							type="number"
							step="1"
							bind:value={model.scoreAmount}
							aria-label="Score points"
							class="field-value field-value--left"
						/>
					</FieldWell>
				</div>
			</div>
		{:else if model.actionKind === 'sfx'}
			<div class="field-row">
				<span class="field-label">Sound</span>
				<div class="field-row-control">
					<FieldWell>
						<input
							type="text"
							bind:value={model.sfxId}
							placeholder="Bing"
							class="field-value field-value--left"
						/>
					</FieldWell>
				</div>
			</div>
		{/if}
	{/snippet}

	<div class="events-lede">
		Author type-level events (create / step / destroy) that every instance inherits.
	</div>

	{#if locomotionRows.length > 0}
		<article class="event-card locomotion-card" aria-label="Locomotion clips">
			<header>
				<span class="trigger-label">Locomotion</span>
				<span class="action-count">
					{locomotionEditable ? 'editable bindings' : 'from animation catalog'}
				</span>
			</header>
			<ol>
				{#each locomotionRows as row (row.key)}
					<li class:locomotion-edit={locomotionEditable}>
						{#if locomotionEditable}
							<label class="loco-row">
								<span class="loco-label">{row.label}</span>
								<FieldWell>
									<select
										class="field-value"
										aria-label="{row.label} locomotion clip"
										value={row.clip}
										onchange={(event) => {
											const value = (event.currentTarget as HTMLSelectElement).value;
											setLocomotionBinding(row.key, value);
										}}
									>
										{#each clipOptions as clipId (clipId)}
											<option value={clipId}>{clipId}</option>
										{/each}
									</select>
								</FieldWell>
							</label>
						{:else}
							<span>{row.label} → {row.clip}</span>
						{/if}
					</li>
				{/each}
			</ol>
			<p class="locomotion-hint">
				{#if locomotionEditable}
					Overrides the catalog map for this type when used as a Player avatar — not create/step/destroy
					events. Reset a row to the catalog default by picking the catalog clip.
				{:else}
					Walk / run / jump play from this catalog when the type is used as a Player avatar — not as
					create/step/destroy events.
				{/if}
			</p>
		</article>
	{/if}

	{#if model.eventEntries.length > 0}
		<div class="event-groups">
			{#each model.eventEntries as entry (entry.id)}
				<article class="event-card">
					<header>
						<span class="trigger-label">{entry.label}</span>
						<span class="action-count">
							{entry.actions.length} action{entry.actions.length === 1 ? '' : 's'}
						</span>
					</header>
					<ol>
						{#each entry.actions as action, index (`${entry.id}-${index}`)}
							<li class:editing={model.isEditingAction(entry.id, index)}>
								{#if model.isEditingAction(entry.id, index)}
									<form
										class="inline-edit"
										aria-label="Edit {entry.label} action {index + 1}"
										onsubmit={(event) => {
											event.preventDefault();
											model.commitEditAction();
										}}
									>
										{@render actionParamFields()}
										<div class="inline-edit-actions">
											<Button type="submit" size="sm">
												<CheckIcon class="size-3.5" aria-hidden="true" />
												Save
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => model.cancelEditAction()}
											>
												Cancel
											</Button>
										</div>
									</form>
								{:else}
									<span class="action-text">{model.actionSummary(action as EventAction)}</span>
									{#if !readonly}
										<span class="action-controls">
											<button
												type="button"
												class="action-btn"
												aria-label="Move {entry.label} action {index + 1} up"
												disabled={index === 0}
												onclick={() => model.moveAction(entry.id, index, -1)}
											>
												<ChevronUpIcon class="size-3" aria-hidden="true" />
											</button>
											<button
												type="button"
												class="action-btn"
												aria-label="Move {entry.label} action {index + 1} down"
												disabled={index === entry.actions.length - 1}
												onclick={() => model.moveAction(entry.id, index, 1)}
											>
												<ChevronDownIcon class="size-3" aria-hidden="true" />
											</button>
											{#if model.isActionEditable(action as EventAction)}
												<button
													type="button"
													class="action-btn"
													aria-label="Edit {entry.label} action {index + 1}"
													onclick={() => model.beginEditAction(entry.id, index)}
												>
													<PencilIcon class="size-3" aria-hidden="true" />
												</button>
											{/if}
											<button
												type="button"
												class="action-btn action-remove"
												aria-label="Remove {entry.label} action {index + 1}"
												onclick={() => model.removeAction(entry.id, index)}
											>
												<XIcon class="size-3" aria-hidden="true" />
											</button>
										</span>
									{/if}
								{/if}
							</li>
						{/each}
					</ol>
				</article>
			{/each}
		</div>
	{:else}
		<div class="empty-events">
			{#if readonly}
				No create / step / destroy events on this type.
			{:else}
				No create / step / destroy events yet. Add one below
				{#if locomotionRows.length > 0}
					— locomotion clips are listed above
				{/if}.
			{/if}
		</div>
	{/if}

	{#if readonly}
		<div class="readonly-hint">
			<p>Built-in type — its events are read-only.</p>
			<Button
				variant="outline"
				size="sm"
				class="readonly-hint-btn"
				onclick={() => ui.openNewObjectTypeDialog(typeName)}
			>
				Duplicate to edit…
			</Button>
		</div>
	{/if}

	{#if !readonly && !model.editing}
		<form
			class="add-action"
			aria-label="Add type event action"
			onsubmit={(event) => {
				event.preventDefault();
				model.addBehaviorAction();
			}}
		>
			<div class="field-row">
				<span class="field-label">Event</span>
				<div class="field-row-control">
					<FieldWell>
						<select bind:value={model.trigger} aria-label="Event trigger" class="field-value">
							{#each BEHAVIOR_TRIGGERS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</FieldWell>
				</div>
			</div>

			{@render actionParamFields()}

			<Button
				type="submit"
				size="sm"
				disabled={model.actionKind === 'set' && model.fieldOptions.length === 0}
			>
				<PlusIcon class="size-3.5" aria-hidden="true" />
				Add action
			</Button>
		</form>
	{/if}
</section>

<style>
	.type-behaviors {
		display: grid;
		align-content: start;
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
	}

	.events-lede {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--muted-foreground);
	}

	.event-groups {
		display: grid;
		gap: 6px;
	}

	.event-card {
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--background) 72%, transparent);
	}

	.event-card header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
	}

	.trigger-label {
		font-size: 11px;
		font-weight: 600;
	}

	.action-count {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	ol {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 6px 8px;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.45;
	}

	li.editing {
		flex-direction: column;
		align-items: stretch;
	}

	li.locomotion-edit {
		display: block;
	}

	.loco-row {
		display: grid;
		grid-template-columns: 88px 1fr;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.loco-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 500;
		color: var(--muted-foreground);
	}

	.action-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.action-controls {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
	}

	.action-btn {
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
		cursor: pointer;
	}

	.action-btn:hover:not(:disabled) {
		color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.action-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.action-btn.action-remove:hover:not(:disabled) {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}

	.inline-edit {
		display: grid;
		gap: 8px;
		width: 100%;
		padding: 2px 0;
	}

	.inline-edit-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.readonly-hint {
		display: grid;
		gap: 6px;
		justify-items: start;
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.readonly-hint p {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--muted-foreground);
	}

	.empty-events {
		padding: 6px 0;
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.locomotion-hint {
		margin: 0;
		padding: 6px 8px 8px;
		font-size: 10px;
		line-height: 1.4;
		color: var(--muted-foreground);
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.locomotion-card ol {
		max-height: 160px;
		overflow-y: auto;
	}

	.add-action {
		display: grid;
		gap: 8px;
		align-items: end;
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
	}

	.field-row {
		display: grid;
		grid-template-columns: 64px 1fr;
		align-items: center;
		gap: 8px;
	}

	.field-label {
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.field-row-control {
		min-width: 0;
	}

	.add-action :global(select.field-value),
	.add-action :global(input.field-value) {
		width: 100%;
		min-width: 0;
		border: 0;
		background: transparent;
		font-size: 11px;
		color: var(--foreground);
	}
</style>
