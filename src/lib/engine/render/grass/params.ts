// Derived from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/grassField/utils/controls.ts @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ./VENDOR.md — upstream code, refactor deliberately.
//
// ─────────────────────────────────────────────────────────────────────────────
// The leva panel, re-expressed as a plain params object.
//
// Upstream kept these as ~100 leva descriptors read from inside the React
// component. Here they are ordinary data: the world file supplies them through
// the `GrassField` component bag, the inspector renders them from SPEC, and
// agents mutate them with set_entity_field. No leva anywhere.
//
// SPEC is the single source of truth. `GrassParams`, `GRASS_DEFAULTS` and
// `GRASS_PARAM_META` are all derived from it, so a knob cannot start at one
// value in the type and a different one in the UI.
//
// DELIBERATE OMISSION: upstream's "Grass Scene" folder also carried
// scale / posX-Z / rotX-Z. Those are NOT here — in this engine an entity's
// position is owned by its `Transform` component, and a second source of
// placement would fight it (and double-transform the world-space-scattered
// blades). Only the PBR-override knobs from that folder survive.
//
// Everything here is a live uniform EXCEPT the keys in REBUILD_KEYS, which
// change instance geometry and respawn the InstancedMeshes.
//
// Defaults are tuned for the demo GLB, whose grass surface is ~14.8 × 14.8
// world units (≈ 218 u²). Density is per u². If you plug in your own model,
// density and blade length are the first two to revisit.
// ─────────────────────────────────────────────────────────────────────────────

import { GRASS_PRESETS } from './presets';

type Spec = {
	v: number | string | boolean;
	label: string;
	group: string;
	min?: number;
	max?: number;
	step?: number;
	rebuilds?: boolean;
	options?: Record<string, number>;
};

/**
 * `v` is intentionally NOT const-asserted: TypeScript then infers `number`,
 * `string` or `boolean` per entry, which is exactly the shape `GrassParams`
 * wants.
 */
const SPEC = {
	// ── Blades (all rebuild) ────────────────────────────────────────────────
	grDensity: { v: 300, min: 1, max: 300, step: 1, label: 'Density (blades/u²)', group: 'Blades', rebuilds: true },
	grMaxCount: { v: 53000, min: 100, max: 60000, step: 100, label: 'Max Blades', group: 'Blades', rebuilds: true },
	grMinWidth: { v: 0.06, min: 0.005, max: 0.5, step: 0.005, label: 'Min Width', group: 'Blades', rebuilds: true },
	grMaxWidth: { v: 0.06, min: 0.005, max: 0.5, step: 0.005, label: 'Max Width', group: 'Blades', rebuilds: true },
	grMinLength: { v: 0.15, min: 0.02, max: 3, step: 0.01, label: 'Min Length', group: 'Blades', rebuilds: true },
	grMaxLength: { v: 0.25, min: 0.02, max: 3, step: 0.01, label: 'Max Length', group: 'Blades', rebuilds: true },
	grTiltMax: { v: 0.16, min: 0, max: 1.5, step: 0.01, label: 'Max Tilt', group: 'Blades', rebuilds: true },
	// Bend quality. Wind moves vertices, so a blade bends along a POLYLINE with
	// one joint per segment — at high wind, 3 segments starts showing its
	// elbows. The only param that costs vertices, and it pays that 50,000×.
	grSegments: { v: 3, min: 1, max: 8, step: 1, label: 'Segments (2·n−1 tris)', group: 'Blades', rebuilds: true },

	// ── Colour ──────────────────────────────────────────────────────────────
	grColorBottom: { v: '#4f7c13', label: 'Color Bottom', group: 'Color' },
	grColorTop: { v: '#79a01c', label: 'Color Top', group: 'Color' },
	// Holding the bottom colour near the ground is what lets blade bases melt
	// into the terrain instead of banding.
	grGradStart: { v: 0.15, min: 0, max: 1, step: 0.01, label: 'Gradient Start (base)', group: 'Color' },
	grGradEnd: { v: 1.0, min: 0, max: 1, step: 0.01, label: 'Gradient End (tip)', group: 'Color' },
	grGradPower: { v: 1.6, min: 0.2, max: 6, step: 0.1, label: 'Gradient Curve (>1 = more base)', group: 'Color' },
	grBrightness: { v: 0.8, min: 0.01, max: 2, step: 0.05, label: 'Brightness', group: 'Color' },
	grShadowStrength: { v: 0.35, min: 0, max: 1, step: 0.01, label: 'Shadow Strength', group: 'Color' },
	// Shadow is sampled at a RING of points around each blade and averaged into
	// a soft penumbra. Widen the radius and a moving caster edge (swaying trees)
	// fades across the grass instead of snapping — that's what stops wind flicker.
	grShadowRadius: { v: 0, min: 0, max: 1.5, step: 0.01, label: 'Shadow Softness (radius)', group: 'Color' },
	grShadowSamples: { v: 1, min: 1, max: 4, step: 1, label: 'Shadow Taps', group: 'Color' },
	grShadowSampleY: { v: 0.15, min: 0, max: 1, step: 0.05, label: 'Shadow Sample Height', group: 'Color' },
	grTintFloor: { v: true, label: 'Tint Ground To Match', group: 'Color' },
	// Matches the ground's shading normal to the blades' (forced +Y) so the same
	// colour lands on the same NdotL and the ground stops reading as a different
	// green than the blade bases.
	grFlatFloorNormal: { v: 1, min: 0, max: 1, step: 0.05, label: 'Flatten Ground Normal', group: 'Color' },

	// ── Patches ─────────────────────────────────────────────────────────────
	// A slow noise sampled at each blade's world position indexes a lush→dry
	// gradient, so the field drifts between colours in organic blotches.
	grPatchStrength: { v: 0.73, min: 0, max: 1, step: 0.01, label: 'Strength (0 = off)', group: 'Patches' },
	// On: the patch gradient reuses the blade's Bottom → Top, so it tracks every
	// preset for free. Off: the two custom colours below.
	grPatchLinkColors: { v: true, label: 'Match Grass Colors', group: 'Patches' },
	grPatchDry: { v: '#b8a94e', label: 'Dry Color (if unlinked)', group: 'Patches' },
	grPatchLush: { v: '#6f9a2a', label: 'Lush Color (if unlinked)', group: 'Patches' },
	grPatchScale: { v: 0.9, min: 0.01, max: 1, step: 0.01, label: 'Scale (bigger = smaller patches)', group: 'Patches' },
	grPatchBias: { v: 1.6, min: 0.2, max: 5, step: 0.1, label: 'Dry Bias (>1 = less dry)', group: 'Patches' },

	// ── Ground ──────────────────────────────────────────────────────────────
	// Procedural dirt painted on the ground. Blades sample the same mask, so
	// over dirt they shrink and take the earth colour — the grass thins into the
	// patch instead of ending at a line.
	grDirtColor: { v: '#ac956c', label: 'Dirt Color', group: 'Ground' },
	grDirtCoverage: { v: 0.41, min: 0, max: 1, step: 0.01, label: 'Coverage (0 = off)', group: 'Ground' },
	grDirtScale: { v: 0.4, min: 0.01, max: 1, step: 0.01, label: 'Patch Scale', group: 'Ground' },
	grDirtSoftness: { v: 0.06, min: 0.01, max: 0.5, step: 0.01, label: 'Edge Softness', group: 'Ground' },
	grDirtWarp: { v: 0.2, min: 0, max: 3, step: 0.05, label: 'Warp (ragged edges)', group: 'Ground' },
	grDirtCut: { v: 1.0, min: 0, max: 1, step: 0.05, label: 'Blade Shortening On Dirt', group: 'Ground' },
	grDirtBlend: { v: 0.8, min: 0, max: 1, step: 0.05, label: 'Blade Color Blend', group: 'Ground' },
	// Texture + relief for the dirt itself, weighted by the dirt mask so it
	// never shows under the grass (there the ground must stay exactly the
	// blades' bottom colour).
	grGndVarColor: { v: '#c4a77d', label: 'Variation Color', group: 'Ground' },
	grGndVarStrength: { v: 0.9, min: 0, max: 2, step: 0.05, label: 'Variation Strength', group: 'Ground' },
	grGndVarScale: { v: 1.24, min: 0.01, max: 2, step: 0.01, label: 'Variation Scale', group: 'Ground' },
	grGndGrainStrength: { v: 0.95, min: 0, max: 2, step: 0.05, label: 'Grain Strength', group: 'Ground' },
	grGndGrainScale: { v: 6.7, min: 0.5, max: 20, step: 0.1, label: 'Grain Scale', group: 'Ground' },
	grGndReliefStrength: { v: 0.0, min: 0, max: 4, step: 0.05, label: 'Relief Strength', group: 'Ground' },
	grGndReliefScale: { v: 0.05, min: 0.05, max: 4, step: 0.05, label: 'Relief Scale', group: 'Ground' },

	// ── Trampling ───────────────────────────────────────────────────────────
	// Each rock is fed to the shader as a world-space sphere; blades inside it
	// are flattened and splayed.
	grRockFlatten: { v: 1.0, min: 0, max: 1, step: 0.05, label: 'Flatten Under Rocks', group: 'Trampling' },
	grRockBend: { v: 0.41, min: 0, max: 2, step: 0.01, label: 'Bend Away', group: 'Trampling' },
	grRockRadiusMul: { v: 0.2, min: 0.2, max: 3, step: 0.05, label: 'Radius Multiplier', group: 'Trampling' },
	grRockFalloff: { v: 0.35, min: 0.01, max: 3, step: 0.01, label: 'Falloff (soft edge)', group: 'Trampling' },

	// ── Translucency ────────────────────────────────────────────────────────
	// Light through the blades — a warm glow on backlit grass, driven by the
	// scene's directional light mirrored into uSunDir.
	grTransColor: { v: '#c1e54d', label: 'Color', group: 'Translucency' },
	grTransStrength: { v: 2.5, min: 0, max: 3, step: 0.05, label: 'Strength (0 = off)', group: 'Translucency' },
	grTransPower: { v: 6.4, min: 0.5, max: 16, step: 0.1, label: 'Falloff (higher = tighter)', group: 'Translucency' },
	grTransTip: { v: 1.0, min: 0, max: 1, step: 0.05, label: 'Tip Bias (1 = tips only)', group: 'Translucency' },
	grTransShadow: { v: 1, min: 0, max: 1, step: 0.05, label: 'Killed By Shadow', group: 'Translucency' },

	// ── Wind ────────────────────────────────────────────────────────────────
	grWindStrength: { v: 0.1, min: 0, max: 0.25, step: 0.001, label: 'Strength', group: 'Wind' },
	grWindSpeed: { v: 1.3, min: 0.1, max: 6, step: 0.05, label: 'Speed', group: 'Wind' },
	grWindFreq: { v: 0.47, min: 0.05, max: 3, step: 0.025, label: 'Frequency', group: 'Wind' },
	grWindDir: { v: 243, min: 0, max: 360, step: 1, label: 'Direction °', group: 'Wind' },
	grWindTurb: { v: 0.04, min: 0, max: 1, step: 0.01, label: 'Turbulence', group: 'Wind' },
	grWindLean: { v: 0.05, min: 0, max: 3, step: 0.05, label: 'Lean', group: 'Wind' },

	// ── Trunk bark ──────────────────────────────────────────────────────────
	grBarkScale: { v: 5.6, min: 0.1, max: 20, step: 0.1, label: 'Texture Scale', group: 'Bark' },
	grBarkTint: { v: '#8a6a4a', label: 'Tint', group: 'Bark' },
	grBarkTintStrength: { v: 0, min: 0, max: 1, step: 0.05, label: 'Tint Strength', group: 'Bark' },
	grBarkSaturation: { v: 0.7, min: 0, max: 2, step: 0.05, label: 'Saturation (0 = greyscale)', group: 'Bark' },
	grBarkBrightness: { v: 1.55, min: 0.1, max: 3, step: 0.05, label: 'Brightness', group: 'Bark' },
	grBarkAOStrength: { v: 0.45, min: 0, max: 1, step: 0.05, label: 'AO Strength', group: 'Bark' },
	grBarkRelief: { v: 1.5, min: 0, max: 10, step: 0.1, label: 'Relief (height bump)', group: 'Bark' },

	// ── Pine leaves ─────────────────────────────────────────────────────────
	// The GLB's photographic leaf texture is kept only for its alpha cut-out;
	// these colours replace its RGB entirely.
	grLeafBottom: { v: '#1c3b23', label: 'Color Bottom (inner)', group: 'Pine Leaves' },
	grLeafTop: { v: '#5c8338', label: 'Color Top (outer)', group: 'Pine Leaves' },
	grLeafGradPower: { v: 1.1, min: 0.2, max: 6, step: 0.1, label: 'Gradient Curve', group: 'Pine Leaves' },
	grLeafBrightness: { v: 1.05, min: 0.1, max: 3, step: 0.05, label: 'Brightness', group: 'Pine Leaves' },
	grLeafVarColor: { v: '#1e4430', label: 'Variation Color', group: 'Pine Leaves' },
	grLeafVarStrength: { v: 0.6, min: 0, max: 2, step: 0.05, label: 'Variation Strength', group: 'Pine Leaves' },
	grLeafVarScale: { v: 2.5, min: 0.1, max: 20, step: 0.1, label: 'Variation Scale', group: 'Pine Leaves' },
	// Direction, speed and frequency come from Wind above — canopies answer to
	// the same gust as the blades. Only amplitude and flutter are leaf-specific.
	grLeafWindStrength: { v: 1.5, min: 0, max: 3, step: 0.01, label: 'Wind Strength (0 = still)', group: 'Pine Leaves' },
	grLeafFlutterAmp: { v: 0.35, min: 0, max: 2, step: 0.05, label: 'Flutter Amount', group: 'Pine Leaves' },
	grLeafFlutterSpeed: { v: 3.2, min: 0, max: 10, step: 0.1, label: 'Flutter Speed', group: 'Pine Leaves' },
	grLeafDip: { v: 1.0, min: 0, max: 1, step: 0.05, label: 'Pendulum Dip', group: 'Pine Leaves' },

	// ── Breakdown / debug ───────────────────────────────────────────────────
	// Repaints the blade with an intermediate value the shader already computes
	// (so it IS the real shader — see shaders/debug.ts).
	grDebugChannel: {
		v: 0,
		label: 'Debug View',
		group: 'Breakdown',
		options: {
			Off: 0,
			'Height Mask (vBH)': 1,
			'Dirt Mask': 2,
			'Rock Influence': 3,
			'Shadow Factor': 4,
			'Translucency Only': 5,
			'Blade Normals': 6
		}
	},
	grWindFixLocal: { v: true, label: 'Fix Wind Space (off = fan-out bug)', group: 'Breakdown' },

	// ── Flowers ─────────────────────────────────────────────────────────────
	flEnabled: { v: true, label: 'Enabled', group: 'Flowers', rebuilds: true },
	flDensity: { v: 0.6, min: 0, max: 5, step: 0.05, label: 'Density', group: 'Flowers', rebuilds: true },
	flMaxCount: { v: 257, min: 1, max: 1000, step: 1, label: 'Max Count', group: 'Flowers', rebuilds: true },
	flSize: { v: 0.6, min: 0.05, max: 3, step: 0.05, label: 'Size', group: 'Flowers', rebuilds: true },
	flMixA: { v: 0.4, min: 0, max: 1, step: 0.05, label: 'Variant Mix', group: 'Flowers', rebuilds: true },
	// Flowers grow in grass, not bare earth. Culled in the shader against the
	// same dirt mask the ground paints, so this one is live.
	flDirtMax: { v: 0.15, min: 0, max: 1, step: 0.05, label: 'Hide On Dirt (1 = never)', group: 'Flowers' },
	// The RGB map's dominant channel picks one of these slots per pixel; a
	// neutral pixel is a stem or leaf.
	flColorR: { v: '#b084c7', label: 'Color R', group: 'Flower Color' },
	flColorG: { v: '#cbb36a', label: 'Color G', group: 'Flower Color' },
	flColorB: { v: '#9287ff', label: 'Color B', group: 'Flower Color' },
	flColorStem: { v: '#648029', label: 'Color Stems/Leaves', group: 'Flower Color' },
	flBrightness: { v: 1.0, min: 0, max: 3, step: 0.05, label: 'Brightness', group: 'Flower Color' },
	flWindStrength: { v: 0.15, min: 0, max: 2, step: 0.01, label: 'Strength', group: 'Flower Wind' },
	flWindSpeed: { v: 0.8, min: 0, max: 5, step: 0.05, label: 'Speed', group: 'Flower Wind' },
	flWindFreq: { v: 0.3, min: 0, max: 3, step: 0.01, label: 'Frequency', group: 'Flower Wind' },
	flWindTurb: { v: 0.2, min: 0, max: 1, step: 0.01, label: 'Turbulence', group: 'Flower Wind' },
	flWindLean: { v: 0.25, min: 0, max: 2, step: 0.01, label: 'Lean', group: 'Flower Wind' },
	flBendAmp: { v: 0.2, min: 0, max: 1, step: 0.01, label: 'Bend Amplitude', group: 'Flower Wind' },
	flBendFreq: { v: 3.0, min: 0, max: 20, step: 0.5, label: 'Bend Frequency', group: 'Flower Wind' },

	// ── PBR override for the GLB's own meshes ───────────────────────────────
	// Flattens rocks and anything the field doesn't repaint out of their
	// authored realistic look.
	matOverride: { v: true, label: 'Override GLB Material', group: 'Material' },
	roughness: { v: 1, min: 0, max: 1, step: 0.01, label: 'Roughness', group: 'Material' },
	metalness: { v: 0, min: 0, max: 1, step: 0.01, label: 'Metalness', group: 'Material' },
	envIntensity: { v: 0.4, min: 0, max: 3, step: 0.05, label: 'Env Intensity', group: 'Material' },
	flatShading: { v: true, label: 'Flat Shading', group: 'Material' }
} satisfies Record<string, Spec>;

/** Every tunable on a grass field, typed from SPEC. */
export type GrassParams = { -readonly [K in keyof typeof SPEC]: (typeof SPEC)[K]['v'] };

export type GrassParamKey = keyof GrassParams;

export type GrassParamMeta = Omit<Spec, 'v'>;

export const GRASS_PARAM_META = Object.fromEntries(
	Object.entries(SPEC).map(([key, { v: _v, ...meta }]) => [key, meta])
) as Record<GrassParamKey, GrassParamMeta>;

export const GRASS_DEFAULTS = Object.fromEntries(
	Object.entries(SPEC).map(([key, { v }]) => [key, v])
) as GrassParams;

export const GRASS_PARAM_KEYS = Object.keys(SPEC) as GrassParamKey[];

/**
 * Params that change instance GEOMETRY — how many blades/flowers there are and
 * how big — and so respawn the InstancedMeshes. Everything else is a live
 * uniform and is free to drag around.
 */
export const REBUILD_KEYS = GRASS_PARAM_KEYS.filter(
	(key) => GRASS_PARAM_META[key].rebuilds
);

/** True when going from `a` to `b` requires respawning instance geometry. */
export function needsRebuild(a: GrassParams, b: GrassParams): boolean {
	return REBUILD_KEYS.some((key) => a[key] !== b[key]);
}

/**
 * Resolve a named preset into a complete params object.
 *
 * A preset names only the values it CHANGES, so it must be applied on top of a
 * known baseline rather than on top of whatever the previous preset left
 * behind — otherwise switching A → B → A gives a different look the second
 * time, since B's fields would linger wherever A stays silent. Upstream got
 * this right by resetting to `default` first; the same rule holds here, and
 * `scripts/grass-params-smoke.ts` asserts the round trip.
 *
 * Unknown preset names fall back to defaults rather than throwing — a world
 * file is data, and a typo should not take the scene down.
 */
export function resolveGrassParams(
	preset = 'default',
	overrides?: Partial<GrassParams>
): GrassParams {
	const named = GRASS_PRESETS[preset];
	return {
		...GRASS_DEFAULTS,
		...(coerceGrassParams(GRASS_PRESETS.default?.values ?? {}) as GrassParams),
		...(named ? (coerceGrassParams(named.values) as GrassParams) : {}),
		...(overrides ?? {})
	};
}

export function isKnownPreset(preset: string): boolean {
	return preset in GRASS_PRESETS;
}

export const GRASS_PRESET_KEYS = Object.keys(GRASS_PRESETS);

/** Drop unknown keys and coerce to the type SPEC declares for each. */
export function coerceGrassParams(patch: Record<string, unknown>): Partial<GrassParams> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(patch)) {
		if (!(key in SPEC)) continue;
		const expected = typeof GRASS_DEFAULTS[key as GrassParamKey];
		if (expected === 'number') {
			const n = Number(value);
			if (Number.isFinite(n)) out[key] = n;
		} else if (expected === 'boolean') {
			out[key] = value === true || value === 'true';
		} else if (typeof value === 'string') {
			out[key] = value;
		}
	}
	return out as Partial<GrassParams>;
}
