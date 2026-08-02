<script lang="ts">
	import { getComponent } from '$lib/engine/ontology/registry';
	import type { FieldType } from '$lib/engine/ontology/schema';
	import { world } from '$lib/engine/runtime/world.svelte';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorField from '$lib/ui/InspectorField.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';
	import MeshFieldRow from '$lib/ui/MeshFieldRow.svelte';
	import { numericFieldBounds } from '$lib/ui/inspectorBounds';
	import { ui } from '$lib/ui/ui.svelte';
	import { handleNumberNudgeKeydown } from '$lib/ui/shellKeyboard';
	import { Euler, Quaternion } from 'three';

	const EULER_ORDER = 'XYZ' as const;
	const DEG = 180 / Math.PI;
	const RAD = Math.PI / 180;

	interface Props {
		typeName: string;
		component: string;
		field: string;
		readonly?: boolean;
	}

	let { typeName, component, field, readonly = false }: Props = $props();

	const schema = $derived.by(() => {
		const rev = ui.schemaRevision + world.componentRevision;
		return rev >= 0 ? getComponent(component)?.fields[field] : undefined;
	});
	const value = $derived(world.typeDefaultValue(typeName, component, field));
	const fieldType = $derived(schema?.t ?? inferType(value));
	const inputId = $derived(
		`type-${typeName}-${component}-${field}`.replace(/[^a-zA-Z0-9_-]/g, '-')
	);
	const bounds = $derived(numericFieldBounds(component, field));
	const enumOptionsList = $derived(enumOptions());

	function inferType(val: unknown): FieldType {
		if (typeof val === 'number') return 'number';
		if (typeof val === 'boolean') return 'boolean';
		if (Array.isArray(val)) return val.length === 2 ? 'vec2' : 'vec3';
		return 'string';
	}

	function commit(next: unknown) {
		if (readonly) return;
		world.setTypeDefault(typeName, component, field, next);
	}

	function browseAssets() {
		if (readonly) return;
		ui.openAssetPick({ typeName, component, field });
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

	const vecAxes = ['x', 'y', 'z'] as const;
	const eulerAxes = ['pitch', 'yaw', 'roll'] as const;
	const vec2Axes = ['x', 'y'] as const;

	function vec3Parts(val: unknown): [string, string, string] {
		const arr = Array.isArray(val) ? val : [0, 0, 0];
		return [String(arr[0] ?? 0), String(arr[1] ?? 0), String(arr[2] ?? 0)];
	}

	function commitVec3(index: number, raw: string) {
		const parts = vec3Parts(value);
		parts[index] = raw;
		commit(parts.map((part) => Number(part) || 0));
	}

	function nudgeVec3(index: number, event: KeyboardEvent) {
		const parts = vec3Parts(value).map((part) => Number(part) || 0);
		handleNumberNudgeKeydown(event, parts[index], (next) => {
			parts[index] = next;
			commit(parts);
		});
	}

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
</script>

{#snippet axisRow(
	axes: readonly string[],
	parts: string[],
	commitAt: (index: number, raw: string) => void,
	nudgeAt: (index: number, event: KeyboardEvent) => void,
	degrees = false
)}
	{@const firstAxisId = `${inputId}-${axes[0]}`}
	<div class="field-row" class:field-row--disabled={readonly}>
		<InspectorFieldLabel label={field} id={firstAxisId} {component} {field} />
		<div class="field-row-control">
			<div class="field-axis-row">
				{#each parts as part, index (index)}
					{@const axisId = `${inputId}-${axes[index]}`}
					<FieldWell disabled={readonly}>
						<span class="field-axis">{axes[index]}</span>
						<input
							id={axisId}
							class="field-value field-value--left"
							value={part}
							readonly={readonly}
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
{:else if fieldType === 'select' && (schema?.options?.length ?? 0) > 0}
	<InspectorField
		id={inputId}
		label={field}
		kind="select"
		{component}
		{field}
		value={String(value ?? schema?.options?.[0] ?? '')}
		options={(schema?.options ?? []).map((o) => ({ value: o, label: o }))}
		disabled={readonly}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'longtext'}
	<div class="field-row" class:field-row--disabled={readonly}>
		<InspectorFieldLabel label={field} id={inputId} {component} {field} />
		<div class="field-row-control">
			<textarea
				id={inputId}
				class="field-value field-textarea"
				rows="3"
				value={typeof value === 'string' ? value : ''}
				readonly={readonly}
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
		disabled={readonly}
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
		disabled={readonly}
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
		defaultValue={typeof schema?.default === 'number' ? schema.default : bounds.min}
		disabled={readonly}
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
		disabled={readonly}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'color'}
	<InspectorField
		id={inputId}
		label={field}
		kind="color"
		{component}
		{field}
		value={String(value ?? '#ffffff')}
		disabled={readonly}
		onChange={(next) => commit(next)}
	/>
{:else if fieldType === 'vec2'}
	{@const parts = vec2Parts(value)}
	{@render axisRow(vec2Axes, parts, commitVec2, nudgeVec2)}
{:else if fieldType === 'vec3'}
	{@const parts = vec3Parts(value)}
	{@render axisRow(vecAxes, parts, commitVec3, nudgeVec3)}
{:else if fieldType === 'ref' && field === 'mesh'}
	<MeshFieldRow
		id={inputId}
		{component}
		{field}
		{value}
		disabled={readonly}
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
		disabled={readonly}
		onChange={(next) => commit(next)}
	/>
{/if}
