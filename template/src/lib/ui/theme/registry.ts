export type ThemeId = 'default' | 'violet-bloom';

export type ThemeMeta = {
	id: ThemeId;
	label: string;
	swatch: [string, string, string, string];
};

/** Preset registry — tweakcn-compatible token blocks live in themes.css */
export const THEME_REGISTRY: ThemeMeta[] = [
	{
		id: 'default',
		label: 'Default',
		swatch: ['oklch(0.145 0 0)', 'oklch(0.922 0 0)', 'oklch(0.205 0 0)', 'oklch(0.35 0 0)']
	},
	{
		id: 'violet-bloom',
		label: 'Violet Bloom',
		swatch: ['oklch(0.16 0.03 300)', 'oklch(0.72 0.18 300)', 'oklch(0.22 0.04 300)', 'oklch(0.4 0.06 300)']
	}
];

export const DEFAULT_THEME_ID: ThemeId = 'default';

export function isThemeId(value: string): value is ThemeId {
	return THEME_REGISTRY.some((entry) => entry.id === value);
}
