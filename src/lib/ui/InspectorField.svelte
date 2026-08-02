<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { formatColor, parseColor, swatchHex } from '$lib/engine/render/colorParse';
	import FieldWell from '$lib/ui/FieldWell.svelte';
	import InspectorFieldLabel from '$lib/ui/InspectorFieldLabel.svelte';
	import { handleNumberNudgeKeydown } from '$lib/ui/shellKeyboard';

	type FieldKind = 'text' | 'number' | 'boolean' | 'color' | 'slider' | 'select';

	interface Props {
		label: string;
		id: string;
		kind?: FieldKind;
		value?: string | number | boolean;
		min?: number;
		max?: number;
		step?: number;
		defaultValue?: number;
		options?: { value: string; label: string }[];
		disabled?: boolean;
		dirty?: boolean;
		hint?: string;
		description?: string;
		component?: string;
		field?: string;
		resettable?: boolean;
		onReset?: () => void;
		onChange?: (value: string | number | boolean) => void;
	}

	let {
		label,
		id,
		kind = 'text',
		value = '',
		min = 0,
		max = 100,
		step = 1,
		defaultValue,
		options = [],
		disabled = false,
		dirty = false,
		hint,
		description,
		component,
		field,
		resettable = false,
		onReset,
		onChange
	}: Props = $props();

	const parsedColor = $derived(parseColor(String(value ?? '#ffffff')));
	const selectValue = $derived(String(value ?? options[0]?.value ?? ''));
	const sliderValue = $derived(typeof value === 'number' ? value : Number(value) || min);
	const numberValue = $derived(typeof value === 'number' ? value : Number(value) || 0);
	const sliderPct = $derived(
		max === min ? 0 : Math.min(100, Math.max(0, ((sliderValue - min) / (max - min)) * 100))
	);
	const dirtyHintId = $derived(`${id}-dirty-hint`);
	const ariaDescribedBy = $derived(dirty ? dirtyHintId : undefined);

	function nudgeNumber(event: KeyboardEvent) {
		const current = typeof value === 'number' ? value : Number(value) || 0;
		handleNumberNudgeKeydown(event, current, (next) => onChange?.(next));
	}

	function clampNumber(raw: string): number {
		const n = Number(raw);
		if (Number.isNaN(n)) return min;
		return Math.min(max, Math.max(min, n));
	}

	function resetSlider(event: MouseEvent) {
		event.preventDefault();
		if (disabled || defaultValue === undefined) return;
		onChange?.(defaultValue);
	}

	function toggleBool() {
		if (disabled) return;
		onChange?.(!Boolean(value));
	}
</script>

<div
	class="field-row"
	class:field-row--dirty={dirty}
	class:field-row--disabled={disabled}
	aria-describedby={ariaDescribedBy}
>
	<InspectorFieldLabel
		{label}
		{id}
		{description}
		{component}
		{field}
		{dirty}
		{resettable}
		{onReset}
	/>

	<div class="field-row-control">
		{#if hint}
			<p class="field-hint">{hint}</p>
		{/if}

		{#if kind === 'boolean'}
			<FieldWell {disabled} {dirty}>
				<button
					type="button"
					class="bool-well"
					{disabled}
					aria-pressed={Boolean(value)}
					onclick={toggleBool}
				>
					<span class="bool-box" class:bool-box--on={Boolean(value)} aria-hidden="true"></span>
					<span class="bool-text">{Boolean(value) ? 'on' : 'off'}</span>
				</button>
			</FieldWell>
		{:else if kind === 'color'}
			<div class="field-split">
				<FieldWell {disabled} {dirty} class="field-well--grow">
					<div class="color-well">
					<input
						type="text"
						class="field-value field-value--color field-value--left"
						{id}
							{disabled}
							value={String(value ?? '')}
							aria-label="{label} hex"
							onchange={(event) => onChange?.(event.currentTarget.value)}
						/>
						<input
							type="color"
							class="color-swatch-input"
							value={swatchHex(String(value ?? '#ffffff'))}
							{disabled}
							oninput={(event) => {
								const next = formatColor(event.currentTarget.value, parsedColor.opacity);
								onChange?.(next);
							}}
							aria-label="{label} color"
						/>
					</div>
				</FieldWell>
				<FieldWell {disabled} class="field-well--alpha">
					<span class="field-axis">a</span>
					<input
						id="{id}-alpha"
						class="field-value field-value--left"
						type="number"
						min={0}
						max={100}
						step={1}
						{disabled}
						value={String(Math.round(parsedColor.opacity * 100))}
						aria-label="{label} opacity percent"
						onchange={(event) => {
							const opacity =
								Math.min(100, Math.max(0, Number(event.currentTarget.value) || 0)) / 100;
							onChange?.(formatColor(parsedColor.hex, opacity));
						}}
					/>
				</FieldWell>
			</div>
		{:else if kind === 'slider'}
			<div class="field-split">
				<FieldWell
					{disabled}
					{dirty}
					class="field-well--slider"
					title="Double-click to reset"
					ondblclick={resetSlider}
				>
					<div class="slider-well">
						<div class="slider-track" aria-hidden="true"></div>
						<div class="slider-tick" style:left="calc(8px + (100% - 16px) * {sliderPct / 100})"></div>
						<input
							type="range"
							class="slider-input"
							{min}
							{max}
							{step}
							{disabled}
							value={sliderValue}
							aria-label={label}
							oninput={(event) => onChange?.(Number(event.currentTarget.value))}
						/>
					</div>
				</FieldWell>
				<FieldWell {disabled} {dirty} class="field-well--num">
					<input
						id="{id}-value"
						class="field-value field-value--left slider-num"
						type="number"
						{min}
						{max}
						{step}
						{disabled}
						value={String(value ?? 0)}
						aria-label="{label} value"
						onchange={(event) => onChange?.(clampNumber(event.currentTarget.value))}
						onkeydown={nudgeNumber}
					/>
				</FieldWell>
			</div>
		{:else if kind === 'number'}
			<FieldWell {disabled} {dirty}>
				<input
					{id}
					class="field-value"
					type="number"
					step="any"
					{disabled}
					value={String(numberValue)}
					aria-label={label}
					onchange={(event) => onChange?.(Number(event.currentTarget.value) || 0)}
					onkeydown={nudgeNumber}
				/>
			</FieldWell>
		{:else if kind === 'select'}
			<FieldWell {disabled} {dirty}>
				<Select.Root
					type="single"
					value={selectValue}
					onValueChange={(next) => next && onChange?.(next)}
				>
					<Select.Trigger
						{id}
						class="field-select-trigger w-full !rounded-none !border-0 !bg-transparent !shadow-none focus-visible:!ring-0"
						size="sm"
						{disabled}
					>
						<span class="select-value">
							{options.find((option) => option.value === selectValue)?.label ?? selectValue}
						</span>
						<span class="select-chevrons" aria-hidden="true">▴▾</span>
					</Select.Trigger>
					<Select.Content>
						{#each options as option (option.value)}
							<Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</FieldWell>
		{:else}
			<FieldWell {disabled} {dirty}>
				<input
					{id}
					class="field-value field-value--left"
					type="text"
					{disabled}
					value={String(value ?? '')}
					aria-label={label}
					onchange={(event) => onChange?.(event.currentTarget.value)}
				/>
			</FieldWell>
		{/if}
	</div>
</div>

<style>
	.field-hint {
		margin: 0 0 4px;
		font-size: 11px;
		color: var(--muted-foreground);
		line-height: 1.4;
	}
</style>
