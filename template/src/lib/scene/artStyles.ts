/** Art-style presets — one-click looks layered over individual shader knobs.
 *
 * `StyleConfig` is scene-defining: it is persisted in the scene document and
 * synced to all peers (see sceneDocument.ts / SceneSettingsSync.svelte).
 */

export type ArtStyleId = 'realistic' | 'toon' | 'ink' | 'clay' | 'noir' | 'custom';

export type MaterialMode = 'standard' | 'toon';

export type ToneMappingId =
	| 'none'
	| 'linear'
	| 'reinhard'
	| 'cineon'
	| 'aces'
	| 'agx'
	| 'neutral';

export type StyleConfig = {
	materialMode: MaterialMode;
	toneMapping: ToneMappingId;
	exposure: number;
	fog: { enabled: boolean; color: string; near: number; far: number };
	bloom: { enabled: boolean; intensity: number; threshold: number };
	vignette: { enabled: boolean; darkness: number };
	grain: { enabled: boolean; opacity: number };
	/** Always-on art outline (distinct from the editor selection outline). */
	outline: { enabled: boolean; color: string; thickness: number };
	/** Cross-hatch / sketchbook post effect. */
	sketch: { enabled: boolean; intensity: number };
};

export type SceneStyle = { artStyle: ArtStyleId } & StyleConfig;

function base(): StyleConfig {
	return {
		materialMode: 'standard',
		toneMapping: 'aces',
		exposure: 1.4,
		fog: { enabled: false, color: '#0a0a0a', near: 20, far: 120 },
		bloom: { enabled: false, intensity: 0.6, threshold: 0.85 },
		vignette: { enabled: false, darkness: 0.5 },
		grain: { enabled: false, opacity: 0.15 },
		outline: { enabled: false, color: '#0a0a0a', thickness: 2 },
		sketch: { enabled: false, intensity: 0.6 }
	};
}

export const ART_STYLE_PRESETS: Record<Exclude<ArtStyleId, 'custom'>, StyleConfig> = {
	realistic: base(),
	toon: {
		...base(),
		materialMode: 'toon',
		toneMapping: 'neutral',
		outline: { enabled: true, color: '#1a1a1a', thickness: 2 }
	},
	ink: {
		...base(),
		materialMode: 'toon',
		toneMapping: 'none',
		exposure: 1.1,
		grain: { enabled: true, opacity: 0.22 },
		outline: { enabled: true, color: '#101010', thickness: 3 },
		sketch: { enabled: true, intensity: 0.75 }
	},
	clay: {
		...base(),
		materialMode: 'standard',
		toneMapping: 'neutral',
		exposure: 1.05,
		bloom: { enabled: true, intensity: 0.25, threshold: 0.9 }
	},
	noir: {
		...base(),
		materialMode: 'toon',
		toneMapping: 'aces',
		exposure: 0.95,
		grain: { enabled: true, opacity: 0.28 },
		vignette: { enabled: true, darkness: 0.7 },
		outline: { enabled: true, color: '#000000', thickness: 2 }
	}
};

export const ART_STYLE_LABELS: Record<ArtStyleId, string> = {
	realistic: 'Realistic',
	toon: 'Toon',
	ink: 'Ink',
	clay: 'Clay',
	noir: 'Noir',
	custom: 'Custom'
};

export const DEFAULT_ART_STYLE: ArtStyleId = 'realistic';

export function defaultSceneStyle(): SceneStyle {
	return { artStyle: DEFAULT_ART_STYLE, ...structuredClone(ART_STYLE_PRESETS.realistic) };
}

/** Deep-copy a preset into a fresh SceneStyle tagged with its id. */
export function sceneStyleFromPreset(id: Exclude<ArtStyleId, 'custom'>): SceneStyle {
	return { artStyle: id, ...structuredClone(ART_STYLE_PRESETS[id]) };
}
