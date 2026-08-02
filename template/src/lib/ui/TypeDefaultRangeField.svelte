<script lang="ts">
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';
	import { getInspectorFieldHelp } from '$lib/ui/inspectorFieldHelp';
	import { numericFieldBounds } from '$lib/ui/inspectorBounds';
	import { world } from '$lib/engine/runtime/world.svelte';

	interface Props {
		typeName: string;
		component: string;
		minField: string;
		maxField: string;
		label: string;
		readonly?: boolean;
	}

	let { typeName, component, minField, maxField, label, readonly = false }: Props = $props();

	const bounds = $derived(numericFieldBounds(component, minField) ?? { min: 0, max: 100, step: 1 });

	const minValue = $derived.by(() => {
		void world.typeRevision;
		const raw = world.typeDefaultValue(typeName, component, minField);
		return typeof raw === 'number' && !Number.isNaN(raw) ? raw : bounds.min;
	});

	const maxValue = $derived.by(() => {
		void world.typeRevision;
		const raw = world.typeDefaultValue(typeName, component, maxField);
		return typeof raw === 'number' && !Number.isNaN(raw) ? raw : bounds.max;
	});

	const inputId = $derived(
		`type-${typeName}-${component}-${minField}-${maxField}`.replace(/[^a-zA-Z0-9_-]/g, '-')
	);

	const span = $derived(Math.max(bounds.max - bounds.min, 1));
	const minPct = $derived(((minValue - bounds.min) / span) * 100);
	const maxPct = $derived(((maxValue - bounds.min) / span) * 100);

	const description = $derived(getInspectorFieldHelp(`${component}.${label}`));

	function commit(field: string, next: number) {
		if (readonly) return;
		world.setTypeDefault(typeName, component, field, next);
	}

	function onMinInput(event: Event) {
		let next = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isNaN(next)) next = bounds.min;
		if (next > maxValue) next = maxValue;
		commit(minField, next);
	}

	function onMaxInput(event: Event) {
		let next = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isNaN(next)) next = bounds.max;
		if (next < minValue) next = minValue;
		commit(maxField, next);
	}
</script>

<div class="field-row" class:field-row--disabled={readonly}>
	<InspectorFieldLabel {label} id={inputId} {component} field={minField} {description} />

	<div class="field-row-control">
		<div class="field-split">
			<FieldWell disabled={readonly} class="field-well--slider">
				<div class="range-well">
					<div class="slider-track" aria-hidden="true"></div>
					<div
						class="range-highlight"
						style:left="calc(8px + (100% - 16px) * {minPct / 100})"
						style:width="calc((100% - 16px) * {(maxPct - minPct) / 100})"
						aria-hidden="true"
					></div>
					<div
						class="slider-tick range-tick range-tick-min"
						style:left="calc(8px + (100% - 16px) * {minPct / 100})"
						aria-hidden="true"
					></div>
					<div
						class="slider-tick range-tick range-tick-max"
						style:left="calc(8px + (100% - 16px) * {maxPct / 100})"
						aria-hidden="true"
					></div>
					<input
						type="range"
						class="range-input range-input-min"
						min={bounds.min}
						max={bounds.max}
						step={bounds.step}
						value={minValue}
						disabled={readonly}
						aria-label="{label} minimum"
						oninput={onMinInput}
					/>
					<input
						type="range"
						class="range-input range-input-max"
						min={bounds.min}
						max={bounds.max}
						step={bounds.step}
						value={maxValue}
						disabled={readonly}
						aria-label="{label} maximum"
						oninput={onMaxInput}
					/>
				</div>
			</FieldWell>
			<FieldWell disabled={readonly} class="field-well--range-nums">
				<span class="range-nums" aria-hidden="true">
					{minValue}° – {maxValue}°
				</span>
			</FieldWell>
		</div>
	</div>
</div>
