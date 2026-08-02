<script lang="ts">
	import { getComponent } from '$lib/engine/ontology/registry';
	import type { FieldType } from '$lib/engine/ontology/schema';
	import { canInspectField } from '$lib/engine/collab/editingPolicy';
	import { isReadOnlyField } from '$lib/engine/runtime/setField';
	import { world } from '$lib/engine/runtime/world.svelte';
	import {
		clampGroundTransformPosition,
		groundPositionLockedAxis,
		shouldClampGroundPosition
	} from '$lib/engine/render/groundTransform';
	import { worldProfile } from '$lib/engine/world/worldProfile.svelte';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorField from '$lib/ui/InspectorField.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';
	import MeshFieldRow from '$lib/ui/MeshFieldRow.svelte';
	import RefField from '$lib/ui/RefField.svelte';
	import {
		isInspectorAxisDirty,
		isInspectorFieldDirty,
		resolveInspectorFieldDefault
	} from '$lib/ui/inspectorFieldDirty';
	import { numericFieldBounds } from '$lib/ui/inspectorBounds';
	import { ui } from '$lib/ui/ui.svelte';
	import { handleNumberNudgeKeydown } from '$lib/ui/shellKeyboard';
	import { Euler, Quaternion } from 'three';

	const EULER_ORDER = 'XYZ' as const;
	const DEG = 180 / Math.PI;
	const RAD = Math.PI / 180;

	interface Props {
		entityId: string;
		component: string;
		field: string;
		value: unknown;
	}

	let { entityId, component, field, value }: Props = $props();

	const entity = $derived(world.getEntity(entityId));
	const schema = $derived(getComponent(component)?.fields[field]);
	const fieldType = $derived(schema?.t ?? inferType(value));
	const readonly = $derived(
		isReadOnlyField(component, field, value) ||
			(entity !== undefined && !canInspectField(entity, component, field))
	);
	const inputId = $derived(
		`${entityId}-${component}-${field}`.replace(/[^a-zA-Z0-9_-]/g, '-')
	);
	const bounds = $derived(numericFieldBounds(component, field));
	const numericDefault = $derived.by(() => {
		const d = schema?.default;
		if (typeof d === 'number' && !Number.isNaN(d)) return d;
		return bounds?.min ?? 0;
	});
	const fieldDefault = $derived(
		entity ? resolveInspectorFieldDefault(entity, component, field) : undefined
	);
	const dirty = $derived(
		entity ? isInspectorFieldDirty(entity, component, field, value) : false
	);
	const resettable = $derived(!readonly && fieldDefault !== undefined);
	const groundPositionLock = $derived(
		entity && shouldClampGroundPosition(entity, component, field)
			? groundPositionLockedAxis(worldProfile.profile.plane)
			: -1
	);

	function finalizeVec3(vec: [number, number, number]): [number, number, number] {
		if (entity && shouldClampGroundPosition(entity, component, field)) {
			return clampGroundTransformPosition(worldProfile.profile.plane, vec);
		}
		return vec;
	}

	function inferType(val: unknown): FieldType {
		if (typeof val === 'number') return 'number';
		if (typeof val === 'boolean') return 'boolean';
		if (Array.isArray(val)) return val.length === 2 ? 'vec2' : 'vec3';
		return 'string';
	}

	function commit(next: unknown) {
		world.setField(entityId, component, field, next);
	}

	function resetField() {
		if (fieldDefault !== undefined) commit(fieldDefault);
	}

	function vec3Parts(val: unknown): [string, string, string] {
		const arr = Array.isArray(val) ? val : [0, 0, 0];
		return [String(arr[0] ?? 0), String(arr[1] ?? 0), String(arr[2] ?? 0)];
	}

	function commitVec3(index: number, raw: string) {
		const parts = vec3Parts(value);
		parts[index] = raw;
		const vec = finalizeVec3(parts.map((part) => Number(part) || 0) as [number, number, number]);
		commit(vec);
	}

	function nudgeVec3(index: number, event: KeyboardEvent) {
		if (index === groundPositionLock) return;
		const parts = vec3Parts(value).map((part) => Number(part) || 0);
		handleNumberNudgeKeydown(event, parts[index], (next) => {
			parts[index] = next;
			commit(finalizeVec3(parts as [number, number, number]));
		});
	}

	function browseAssets() {
		ui.openAssetPick({ entityId, component, field });
	}

	function enumOptions(): { value: string; label: string }[] {
		if (field === 'anchor') {
			return [
				{ value: 'origin', label: 'origin' },
				{ value: 'bottom', label: 'bottom' },
				{ value: 'center', label: 'center' }
			];
		}
		if (field === 'kind' && component === 'Light') {
			return [
				{ value: 'ambient', label: 'ambient' },
				{ value: 'directional', label: 'directional' }
			];
		}
		if (component === 'Physics' && field === 'body') {
			return ['fixed', 'dynamic', 'kinematic'].map((v) => ({ value: v, label: v }));
		}
		if (component === 'Physics' && field === 'collider') {
			return ['box', 'ball', 'capsule', 'hull', 'trimesh'].map((v) => ({ value: v, label: v }));
		}
		return [];
	}

	const enumOptionsList = $derived(enumOptions());
	const vecAxes = ['x', 'y', 'z'] as const;
	const eulerAxes = ['pitch', 'yaw', 'roll'] as const;
	const vec2Axes = ['x', 'y'] as const;

	function vec2Parts(val: unknown): [string, string] {
		const arr = Array.isArray(val) ? val : [0, 0];
		return [String(arr[0] ?? 0), String(arr[1] ?? 0)];
	}

	function commitVec2(index: number, raw: string) {
		const parts = vec2Parts(value);
		parts[index] = raw;
		commit(parts);
	}

	function nudgeVec2(index: number, event: KeyboardEvent) {
		const parts = vec2Parts(value).map((part) => Number(part) || 0);
		handleNumberNudgeKeydown(event, parts[index], (next) => {
			parts[index] = next;
			commit(parts);
		});
	}

	function quatParts(val: unknown): [number, number, number, number] {
		if (Array.isArray(val) && val.length >= 4) {
			return [
				Number(val[0]) || 0,
				Number(val[1]) || 0,
				Number(val[2]) || 0,
				Number(val[3]) ?? 1
			];
		}
		return [0, 0, 0, 1];
	}

	function eulerDegreeParts(val: unknown): [string, string, string] {
		const [x, y, z, w] = quatParts(val);
		const euler = new Euler().setFromQuaternion(new Quaternion(x, y, z, w), EULER_ORDER);
		return [
			String(Math.round(euler.x * DEG * 1000) / 1000),
			String(Math.round(euler.y * DEG * 1000) / 1000),
			String(Math.round(euler.z * DEG * 1000) / 1000)
		];
	}

	function commitEulerDegrees(index: number, raw: string) {
		const parts = eulerDegreeParts(value);
		parts[index] = raw;
		const euler = new Euler(
			(Number(parts[0]) || 0) * RAD,
			(Number(parts[1]) || 0) * RAD,
			(Number(parts[2]) || 0) * RAD,
			EULER_ORDER
		);
		const q = new Quaternion().setFromEuler(euler);
		commit([q.x, q.y, q.z, q.w]);
	}

	function nudgeEulerDegrees(index: number, event: KeyboardEvent) {
		const parts = eulerDegreeParts(value).map((part) => Number(part) || 0);
		handleNumberNudgeKeydown(event, parts[index], (next) => {
			parts[index] = next;
			const euler = new Euler(
				parts[0] * RAD,
				parts[1] * RAD,
				parts[2] * RAD,
				EULER_ORDER
			);
			const q = new Quaternion().setFromEuler(euler);
			commit([q.x, q.y, q.z, q.w]);
		});
	}

	function axisDirty(index: number): boolean {
		if (!entity) return false;
		return isInspectorAxisDirty(entity, component, field, index, value);
	}

	function anyAxisDirty(parts: readonly unknown[]): boolean {
		return parts.some((_, index) => axisDirty(index));
	}
</script>

{#snippet axisRow(
	axes: readonly string[],
	parts: string[],
	commitAt: (index: number, raw: string) => void,
	nudgeAt: (index: number, event: KeyboardEvent) => void,
	degrees = false,
	lockedAxisIndex = -1
)}
	{@const firstAxisId = `${inputId}-${axes[0]}`}
	<div
		class="field-row"
		class:field-row--dirty={anyAxisDirty(parts)}
		class:field-row--disabled={readonly}
	>
		<InspectorFieldLabel
			{field}
			id={firstAxisId}
			{component}
			dirty={anyAxisDirty(parts)}
			{resettable}
			onReset={resetField}
			label={field}
		/>
		<div class="field-row-control">
			<div class="field-axis-row">
				{#each parts as part, index (index)}
					{@const axisId = `${inputId}-${axes[index]}`}
					{@const axisLocked = index === lockedAxisIndex}
					<FieldWell disabled={readonly || axisLocked} dirty={axisDirty(index)}>
						<span class="field-axis">{axes[index]}</span>
						<input
							id={axisId}
							class="field-value field-value--left"
							value={part}
							readonly={readonly || axisLocked}
							aria-label="{field} {axes[index]}{degrees ? ' degrees' : ''}"
							onchange={(e) => commitAt(index, e.currentTarget.value)}
							onkeydown={(event) => nudgeAt(index, event)}
						/>
					</FieldWell>
				{/each}
			</div>
		</div>
	</div>
{/snippet}

{#if fieldType === 'quat'}
	{@const parts = eulerDegreeParts(value)}
	{@render axisRow(eulerAxes, parts, commitEulerDegrees, nudgeEulerDegrees, true)}
{:else if readonly}
	<div class="field-row field-row--disabled">
		<InspectorFieldLabel label={field} id={inputId} {component} {field} />
		<div class="field-row-control">
			<FieldWell disabled>
				<input
					id={inputId}
					class="field-value"
					readonly
					value={typeof value === 'string' ? value : JSON.stringify(value)}
					aria-label={field}
				/>
			</FieldWell>
		</div>
	</div>
{:else if fieldType === 'select' && (schema?.options?.length ?? 0) > 0}
	<InspectorField
		id={inputId}
		label={field}
		kind="select"
		{component}
		{field}
		value={String(value ?? schema?.options?.[0] ?? '')}
		options={(schema?.options ?? []).map((o) => ({ value: o, label: o }))}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'longtext'}
	<div class="field-row" class:field-row--dirty={dirty} class:field-row--disabled={readonly}>
		<InspectorFieldLabel
			label={field}
			id={inputId}
			{component}
			{field}
			{dirty}
			{resettable}
			onReset={resetField}
		/>
		<div class="field-row-control">
			<textarea
				id={inputId}
				class="field-value field-textarea"
				rows="3"
				value={typeof value === 'string' ? value : ''}
				aria-label={field}
				onchange={(e) => commit(e.currentTarget.value)}
			></textarea>
		</div>
	</div>
{:else if enumOptionsList.length > 0}
	<InspectorField
		id={inputId}
		label={field}
		kind="select"
		{component}
		{field}
		value={String(value ?? enumOptionsList[0]?.value ?? '')}
		options={enumOptionsList}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'boolean'}
	<InspectorField
		id={inputId}
		label={field}
		kind="boolean"
		{component}
		{field}
		value={Boolean(value)}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'number' && bounds}
	<InspectorField
		id={inputId}
		label={field}
		kind="slider"
		{component}
		{field}
		value={typeof value === 'number' ? value : Number(value) || bounds.min}
		min={bounds.min}
		max={bounds.max}
		step={bounds.step}
		defaultValue={numericDefault}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'number'}
	<InspectorField
		id={inputId}
		label={field}
		kind="number"
		{component}
		{field}
		value={typeof value === 'number' ? value : Number(value) || 0}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'color'}
	<InspectorField
		id={inputId}
		label={field}
		kind="color"
		{component}
		{field}
		value={String(value ?? '#d4d4d4')}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'vec2'}
	{@const parts = vec2Parts(value)}
	{@render axisRow(vec2Axes, parts, commitVec2, nudgeVec2)}
{:else if fieldType === 'vec3'}
	{@const parts = vec3Parts(value)}
	{@render axisRow(vecAxes, parts, commitVec3, nudgeVec3, false, groundPositionLock)}
{:else if fieldType === 'ref' && schema?.of}
	<RefField {entityId} {component} {field} {value} target={schema.of} />
{:else if fieldType === 'ref' && field === 'mesh'}
	<MeshFieldRow
		id={inputId}
		{component}
		{field}
		{value}
		disabled={readonly}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
		onBrowse={browseAssets}
	/>
{:else}
	<InspectorField
		id={inputId}
		label={field}
		kind="text"
		{component}
		{field}
		value={String(value ?? '')}
		{dirty}
		{resettable}
		onReset={resetField}
		onChange={(next) => commit(next)}
	/>
{/if}
