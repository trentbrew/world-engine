/** Art-style presets — one-click looks layered over individual shader knobs.
 *
 * `StyleConfig` is scene-defining: it is persisted in the scene document and
 * synced to all peers (see sceneDocument.ts / SceneSettingsSync.svelte).
 */

export type ArtStyleId =
	| 'realistic'
	| 'toon'
	| 'ink'
	| 'clay'
	| 'noir'
	| 'painterly'
	| 'custom';

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
	/**
	 * Anisotropic Kuwahara paint filter. Runs as its own composer pass (it is a
	 * `Pass`, not an `Effect`, so it cannot merge into the grade). `radius` is
	 * THE cost knob — the filter samples 8 sectors × radius × 5 per pixel.
	 */
	kuwahara: { enabled: boolean; radius: number; alpha: number };
	/**
	 * Sobel ink lines. Distinct from `outline` above: that one is
	 * postprocessing's mesh-selection outline, this one edge-detects the frame.
	 * Reads the depth buffer, so it runs in its own pass right after RenderPass.
	 */
	ink: {
		enabled: boolean;
		strength: number;
		thickness: number;
		threshold: number;
		color: string;
	};
	/**
	 * Watercolor grade: posterise → saturate → ACES → paper.
	 * ⚠ Ends in a tone-mapping curve, so when enabled it OWNS the grade and the
	 * composer's own ToneMappingEffect is dropped — see ViewportComposer.
	 */
	watercolor: {
		enabled: boolean;
		mix: number;
		steps: number;
		saturation: number;
		paperStrength: number;
	};
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
		sketch: { enabled: false, intensity: 0.6 },
		kuwahara: { enabled: false, radius: 3, alpha: 2 },
		ink: {
			enabled: false,
			// Upstream defaults this to 0 because a leva slider drove it. Here the
			// UI is a None/On toggle, and the shader early-returns at strength 0 —
			// so a 0 default would make "On" silently do nothing.
			strength: 0.55,
			thickness: 5.1,
			threshold: 1.25,
			color: '#2b2118'
		},
		watercolor: {
			enabled: false,
			mix: 1,
			steps: 16,
			saturation: 1.5,
			paperStrength: 0.35
		}
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
	},
	// Ink first, then paint, then paper — the ink is laid down BEFORE the
	// Kuwahara so the brush flattens it and breaks up its edges, which reads as
	// ink laid with a brush rather than vector art over a painting. Tone mapping
	// is 'none' because watercolor ends in its own ACES curve and owns the grade.
	painterly: {
		...base(),
		materialMode: 'standard',
		toneMapping: 'none',
		exposure: 1.1,
		kuwahara: { enabled: true, radius: 3, alpha: 2 },
		ink: {
			enabled: true,
			strength: 0.55,
			thickness: 5.1,
			threshold: 1.25,
			color: '#2b2118'
		},
		watercolor: {
			enabled: true,
			mix: 1,
			steps: 16,
			saturation: 1.5,
			paperStrength: 0.35
		}
	}
};

export const ART_STYLE_LABELS: Record<ArtStyleId, string> = {
	realistic: 'Realistic',
	toon: 'Toon',
	ink: 'Ink',
	clay: 'Clay',
	noir: 'Noir',
	painterly: 'Painterly',
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
