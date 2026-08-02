import { SKY_PRESET_LABELS, type SkyPresetId } from '$lib/scene/skyPresets';

/** Off = disabled / hidden; On = enabled. */
export const NONE_ON_OPTIONS = [
	{ value: 'off', label: 'None' },
	{ value: 'on', label: 'On' }
] as const;

export const skySelectOptions = [
	{ value: 'none', label: 'None' },
	...(Object.entries(SKY_PRESET_LABELS) as [SkyPresetId, string][]).map(([value, label]) => ({
		value,
		label
	}))
];

export function boolToNoneOn(enabled: boolean): 'off' | 'on' {
	return enabled ? 'on' : 'off';
}

export function noneOnToBool(value: string | number | boolean): boolean {
	return value === 'on' || value === true;
}

export function skySelectValue(enabled: boolean, preset: SkyPresetId): string {
	return enabled ? preset : 'none';
}

export function applySkySelect(value: string): { enabled: boolean; preset: SkyPresetId } {
	if (value === 'none') {
		return { enabled: false, preset: 'afternoon' };
	}
	return { enabled: true, preset: value as SkyPresetId };
}
