<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import ColumnsIcon from '@lucide/svelte/icons/columns-3';
	import { getComponent, getType, isBuiltinComponent } from '$lib/engine/ontology/registry';
	import type { Entity, FieldSchema } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import AddFieldDialog from '$lib/ui/AddFieldDialog.svelte';
	import EditFieldDialog from '$lib/ui/EditFieldDialog.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { ui } from '$lib/ui/ui.svelte';

	type Column = { component: string; field: string; schema: FieldSchema };

	const collection = $derived(ui.collectionsCollection);
	const type = $derived.by(() => {
		void world.entities.length;
		void world.componentRevision;
		void world.typeRevision;
		return collection ? getType(collection) : undefined;
	});
	const meta = $derived(type?.collectionMeta);
	const title = $derived(meta?.plural ?? collection ?? 'Collection');

	// Multiple components? prefix column headers so field names stay unambiguous.
	const multiComponent = $derived((type?.components.length ?? 0) > 1);

	const columns = $derived.by<Column[]>(() => {
		// `world.entities` is reassigned on schema edits (addComponentField) and is
		// reliably reactive; the revision counters are not always tracked here.
		// ui.schemaRevision (proven-reactive here) drives recompute on field add;
		// used in the return so the dependency survives dead-code elimination.
		const rev = ui.schemaRevision + world.entities.length;
		const t = collection ? getType(collection) : undefined;
		if (!t) return [];
		const cols: Column[] = [];
		for (const component of t.components) {
			const schema = getComponent(component);
			if (!schema) continue;
			for (const [field, spec] of Object.entries(schema.fields)) {
				cols.push({ component, field, schema: spec });
			}
		}
		return rev >= 0 ? cols : cols;
	});

	let search = $state('');
	let addFieldOpen = $state(false);
	let editFieldOpen = $state(false);
	let editFieldTarget = $state<{ component: string; field: string } | null>(null);

	const records = $derived.by(() => {
		void world.entities.length;
		const all = collection ? world.recordsFor(collection) : [];
		const q = search.trim().toLowerCase();
		if (!q) return all;
		return all.filter((r) =>
			Object.values(r.components).some((bag) =>
				Object.values(bag as Record<string, unknown>).some(
					(v) => typeof v === 'string' && v.toLowerCase().includes(q)
				)
			)
		);
	});

	function cellValue(record: Entity, col: Column): unknown {
		const bag = record.components[col.component] as Record<string, unknown> | undefined;
		const raw = bag?.[col.field];
		if (raw !== undefined) return raw;
		return col.schema.default;
	}

	function commit(record: Entity, col: Column, value: unknown) {
		world.setField(record.id, col.component, col.field, value);
	}

	function browseAsset(record: Entity, col: Column) {
		ui.openAssetPick({ entityId: record.id, component: col.component, field: col.field });
	}

	function recordLabel(entity: Entity): string {
		for (const bag of Object.values(entity.components)) {
			for (const key of ['displayName', 'name', 'title', 'label']) {
				const v = (bag as Record<string, unknown>)[key];
				if (typeof v === 'string' && v.trim()) return v;
			}
		}
		return entity.id.split('/').pop() ?? entity.id;
	}

	function refCandidates(col: Column): Entity[] {
		void world.entities.length;
		const of = col.schema.of;
		if (of?.kind === 'record') return world.recordsFor(of.collection);
		if (of?.kind === 'entity') return world.entities.filter((e) => !e.id.startsWith('record:'));
		return [];
	}

	function headerLabel(col: Column): string {
		return multiComponent ? `${col.component}.${col.field}` : col.field;
	}

	function addRecord() {
		if (!collection) return;
		const record = world.createRecord(collection);
		if (record) ui.selectRecord(record.id);
	}

	function removeRecord(id: string) {
		if (world.deleteRecord(id) && ui.collectionsRecord === id) ui.selectRecord(null);
	}

	function deleteField(col: Column) {
		const result = world.removeComponentField(col.component, col.field);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success(`Removed field ${col.field}`);
		ui.bumpSchemaRevision();
	}

	function openEditField(col: Column) {
		editFieldTarget = { component: col.component, field: col.field };
		editFieldOpen = true;
	}
</script>

<div class="collection-table" aria-label="Collection records">
	{#if !collection}
		<div class="empty-state">
			<DatabaseIcon class="size-6" aria-hidden="true" />
			<h2>Collections</h2>
			<p>Select a collection on the left, or create one to manage game-global data.</p>
		</div>
	{:else}
		<div class="table-card chrome-float-card glass-panel-shell chrome-opacity-main chrome-main-card">
			<div class="table-toolbar">
			<div class="toolbar-title">
				<span class="title-text">{title}</span>
				<span class="title-count">{records.length}</span>
			</div>
			<input
				class="table-search"
				type="search"
				placeholder="Search records…"
				bind:value={search}
				aria-label="Search records"
			/>
			<button type="button" class="toolbar-btn" onclick={() => (addFieldOpen = true)}>
				<ColumnsIcon class="size-3.5" aria-hidden="true" />
				Add field
			</button>
			<button type="button" class="new-record-btn" onclick={addRecord}>
				<PlusIcon class="size-3.5" aria-hidden="true" />
				New record
			</button>
		</div>

		<div class="table-scroll">
			{#if columns.length === 0}
				<p class="table-empty">
					This collection has no fields yet.
					<button type="button" class="inline-link" onclick={() => (addFieldOpen = true)}>
						Add a field
					</button>
					to start authoring records.
				</p>
			{:else}
				<table class="records-table">
					<thead>
						<tr>
							<th class="col-index" scope="col">#</th>
							{#each columns as col (col.component + '.' + col.field)}
								<th scope="col">
									<span class="th-label">
										<span class="th-name">{headerLabel(col)}</span>
										<span class="th-type">{col.schema.t}</span>
									</span>
									{#if !isBuiltinComponent(col.component)}
										<button
											type="button"
											class="th-edit"
											aria-label="Edit field {col.field}"
											onclick={() => openEditField(col)}
										>
											<PencilIcon class="size-3" aria-hidden="true" />
										</button>
										<button
											type="button"
											class="th-delete"
											aria-label="Delete field {col.field}"
											onclick={() => deleteField(col)}
										>
											<TrashIcon class="size-3" aria-hidden="true" />
										</button>
									{/if}
								</th>
							{/each}
							<th class="col-actions" scope="col"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each records as record, i (record.id)}
							<tr class:active={ui.collectionsRecord === record.id}>
								<td class="col-index">{i + 1}</td>
								{#each columns as col (col.component + '.' + col.field)}
									{@const value = cellValue(record, col)}
									<td>
										{#if col.schema.t === 'boolean'}
											<input
												type="checkbox"
												checked={Boolean(value)}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.checked)}
											/>
										{:else if col.schema.t === 'number'}
											<input
												class="cell-input"
												type="number"
												value={typeof value === 'number' ? value : (value ?? '')}
												aria-label={col.field}
												onchange={(e) => commit(record, col, Number(e.currentTarget.value))}
											/>
										{:else if col.schema.t === 'color'}
											<input
												class="cell-color"
												type="color"
												value={String(value ?? '#000000')}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.value)}
											/>
										{:else if col.schema.t === 'select'}
											<select
												class="cell-select"
												value={String(value ?? '')}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.value)}
											>
												<option value="">— none —</option>
												{#each col.schema.options ?? [] as opt (opt)}
													<option value={opt}>{opt}</option>
												{/each}
											</select>
										{:else if col.schema.t === 'longtext'}
											<textarea
												class="cell-textarea"
												rows="1"
												value={typeof value === 'string' ? value : ''}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.value)}
											></textarea>
										{:else if col.schema.t === 'ref' && (col.schema.of?.kind === 'record' || col.schema.of?.kind === 'entity')}
											<select
												class="cell-select"
												value={String(value ?? '')}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.value)}
											>
												<option value="">— none —</option>
												{#each refCandidates(col) as cand (cand.id)}
													<option value={cand.id}>{recordLabel(cand)}</option>
												{/each}
											</select>
										{:else if col.schema.t === 'ref' && col.schema.of?.kind === 'asset'}
											<button
												type="button"
												class="cell-asset"
												aria-label={col.field}
												onclick={() => browseAsset(record, col)}
											>
												<span class="cell-asset-value">{value ? String(value) : 'Set asset…'}</span>
											</button>
										{:else}
											<input
												class="cell-input"
												type="text"
												value={typeof value === 'string' ? value : (value == null ? '' : JSON.stringify(value))}
												aria-label={col.field}
												onchange={(e) => commit(record, col, e.currentTarget.value)}
											/>
										{/if}
									</td>
								{/each}
								<td class="col-actions">
									<button
										type="button"
										class="row-delete"
										aria-label="Delete record"
										onclick={() => removeRecord(record.id)}
									>
										<TrashIcon class="size-3.5" aria-hidden="true" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if records.length === 0}
					<div class="table-empty-rows">
						<p>{search.trim() ? 'No records match your search.' : 'No records yet.'}</p>
						{#if !search.trim()}
							<button type="button" class="new-record-btn" onclick={addRecord}>
								<PlusIcon class="size-3.5" aria-hidden="true" />
								New record
							</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
		</div>
	{/if}
</div>

<AddFieldDialog bind:open={addFieldOpen} typeName={collection} unit="record" />
<EditFieldDialog bind:open={editFieldOpen} bind:target={editFieldTarget} typeName={collection} unit="record" />

<style>
	.collection-table {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}

	.table-card {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		pointer-events: auto;
	}

	.empty-state {
		margin: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		max-width: 420px;
		text-align: center;
		color: var(--muted-foreground);
	}

	.empty-state h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--foreground);
	}

	.empty-state p {
		font-size: 13px;
		line-height: 1.55;
	}

	.table-toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--chrome-divider);
		flex-shrink: 0;
	}

	.toolbar-title {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.title-text {
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
	}

	.title-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.table-search {
		margin-left: auto;
		width: min(240px, 40%);
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: var(--field-control-radius, var(--radius-sm));
		background: var(--card);
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
	}

	.new-record-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		border-radius: var(--field-control-radius, var(--radius-sm));
		background: color-mix(in srgb, var(--accent-entity) 12%, transparent);
		color: var(--accent-entity);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.new-record-btn:hover {
		background: color-mix(in srgb, var(--accent-entity) 20%, transparent);
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		border-radius: var(--field-control-radius, var(--radius-sm));
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.toolbar-btn:hover {
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}

	.inline-link {
		display: inline;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent-entity);
		font: inherit;
		font-size: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.table-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.table-empty,
	.table-empty-rows {
		padding: var(--spacing-lg);
		color: var(--muted-foreground);
		font-size: 13px;
		text-align: center;
	}

	.table-empty-rows {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.records-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	.records-table thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		text-align: left;
		padding: 8px 10px;
		background: var(--card);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		white-space: nowrap;
	}

	.th-label {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
	}

	.th-edit,
	.th-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		margin-left: 6px;
		vertical-align: middle;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--muted-foreground);
		opacity: 0.55;
		cursor: pointer;
	}

	.records-table thead th:hover .th-edit,
	.records-table thead th:hover .th-delete,
	.th-edit:focus-visible,
	.th-delete:focus-visible {
		opacity: 1;
	}

	.th-edit:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.th-delete:hover {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}

	.th-name {
		font-weight: 600;
		color: var(--foreground);
	}

	.th-type {
		margin-left: 6px;
		font-family: var(--font-mono);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
	}

	.records-table tbody td {
		padding: 4px 8px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 22%, transparent);
		vertical-align: middle;
	}

	.records-table tbody tr:hover {
		background: color-mix(in srgb, var(--foreground) 4%, transparent);
	}

	.records-table tbody tr.active {
		background: color-mix(in srgb, var(--accent-entity) 8%, transparent);
	}

	.col-index {
		width: 36px;
		color: var(--muted-foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		text-align: right;
	}

	.col-actions {
		width: 40px;
		text-align: center;
	}

	.cell-input,
	.cell-select {
		width: 100%;
		min-width: 80px;
		height: 26px;
		padding: 0 6px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
	}

	.cell-input:hover,
	.cell-select:hover {
		border-color: color-mix(in srgb, var(--border) 50%, transparent);
	}

	.cell-input:focus,
	.cell-select:focus {
		outline: none;
		border-color: var(--ring);
		background: var(--card);
	}

	.cell-color {
		width: 28px;
		height: 24px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
	}

	.cell-textarea {
		width: 100%;
		min-width: 120px;
		min-height: 26px;
		max-height: 120px;
		padding: 4px 6px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
		line-height: 1.4;
		resize: vertical;
	}

	.cell-textarea:hover {
		border-color: color-mix(in srgb, var(--border) 50%, transparent);
	}

	.cell-textarea:focus {
		outline: none;
		border-color: var(--ring);
		background: var(--card);
	}

	.cell-asset {
		display: flex;
		align-items: center;
		width: 100%;
		min-width: 100px;
		height: 26px;
		padding: 0 8px;
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--foreground);
		font-family: inherit;
		font-size: 12px;
		cursor: pointer;
		text-align: left;
	}

	.cell-asset:hover {
		border-color: var(--ring);
		background: var(--card);
	}

	.cell-asset-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--muted-foreground);
		opacity: 0;
		cursor: pointer;
	}

	.records-table tbody tr:hover .row-delete {
		opacity: 1;
	}

	.row-delete:hover {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
