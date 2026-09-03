// Vendored from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/watercolor/WatercolorFilter.tsx @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ../../engine/render/grass/VENDOR.md — upstream code, refactor deliberately.
//
// Upstream's React wrapper drove these uniforms from leva and built the paper
// texture in a `useMemo`. Replaced here by `setParams` plus the
// `createWatercolorEffect` factory, which owns the texture and its disposal.

import { BlendFunction, Effect } from 'postprocessing';
import { Color, RepeatWrapping, Uniform, type Texture } from 'three';
import { makeProceduralGrainTexture } from './watercolorTextures/grainTexture';

// ─────────────────────────────────────────────────────────────────────────────
// The last layer: posterise, saturate, tone map, then lay the whole frame on
// paper.
//
// ⚠ IT ENDS IN AN ACES CURVE, so it must be the last thing that touches light.
// Upstream relied on @react-three/postprocessing forcing
// `gl.toneMapping = NoToneMapping` while the composer was mounted — this pass
// IS the scene's tone mapping. ViewportComposer here always appends its own
// ToneMappingEffect, so enabling watercolor must set `style.toneMapping` to
// 'none' or the frame is tone-mapped twice and washes out.
//
// The order inside is deliberate and not interchangeable:
//
//   1. QUANTISE on luminance, not on colour. Stepping each channel separately
//      shifts hue at every step boundary; stepping the value and then pushing
//      the ORIGINAL colour toward black or white keeps the hue and only bands
//      the value, which is what watercolour actually does.
//   2. SATURATE, after the banding, so the flats come back up — posterising
//      through a luminance ramp always costs some chroma.
//   3. ACES last of the three: it is the curve that maps the result into
//      display range, so anything after it would be outside the range it just
//      established.
//   4. PAPER, multiplied over the graded result.
// ─────────────────────────────────────────────────────────────────────────────

export type WatercolorParams = {
	mix: number;
	steps: number;
	quantLow: number;
	quantHigh: number;
	shadowTint: string;
	saturation: number;
	paperStrength: number;
	paperScale: number;
};

export const WATERCOLOR_DEFAULTS: WatercolorParams = {
	mix: 1,
	steps: 16,
	quantLow: 0.2,
	quantHigh: 0.7,
	shadowTint: '#1a1a1a',
	saturation: 1.5,
	paperStrength: 0.35,
	paperScale: 1
};

const WATERCOLOR_FRAG = /* glsl */ `
  uniform sampler2D uPaper;
  uniform float uPaperStrength;
  uniform float uPaperScale;
  uniform float uSteps;
  uniform float uQuantLow;
  uniform float uQuantHigh;
  uniform vec3  uShadowTint;
  uniform float uSaturation;
  uniform float uMix;

  vec3 wcACES(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 wcSat(vec3 rgb, float adjustment) {
    // Rec.709 luminance weights — the same basis the quantiser uses, so the
    // two agree on what "value" means.
    vec3 W = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(rgb, W));
    return mix(intensity, rgb, adjustment);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // ── 1. Quantise the VALUE ────────────────────────────────────────────
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float n = max(uSteps, 2.0);
    float qn = floor(lum * (n - 1.0) + 0.5) / (n - 1.0);

    // The clamp is what keeps this from being a hard posterise: it throws away
    // the ends of the ramp, so nothing is ever pushed the whole way to the
    // shadow tint or the whole way to white. Widening it toward 0..1 is the
    // knob for a harsher, more graphic result.
    qn = clamp(qn, uQuantLow, uQuantHigh);

    vec3 graded = (qn < 0.5)
      ? mix(uShadowTint, color, qn * 2.0)
      : mix(color, vec3(1.0), (qn - 0.5) * 2.0);

    // ── 2 & 3. Chroma back up, then into display range ───────────────────
    graded = wcSat(graded, uSaturation);
    graded = wcACES(graded);

    // ── 4. Paper ─────────────────────────────────────────────────────────
    // Aspect-corrected so the fibre stays round on a wide viewport instead of
    // being stretched with the frame.
    vec2 puv = (uv - 0.5) * vec2(aspect, 1.0) * uPaperScale + 0.5;
    vec3 paper = texture2D(uPaper, puv).rgb;
    // Mixed toward WHITE by strength rather than multiplied raw. A raw multiply
    // makes the pass all-or-nothing, and — worse — an unbound or dark sampler
    // then takes the whole frame to black with no clue where it came from.
    // This way strength 0 is a guaranteed no-op.
    graded *= mix(vec3(1.0), paper, uPaperStrength);

    // Whole pass on one fader, so it can be dialled against the rest of the
    // stack instead of only being on or off.
    outputColor = vec4(mix(color, graded, uMix), inputColor.a);
  }
`;

export class WatercolorEffect extends Effect {
	private readonly paper: Texture;

	constructor(paper: Texture, params: Partial<WatercolorParams> = {}) {
		super('WatercolorEffect', WATERCOLOR_FRAG, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, Uniform>([
				['uPaper', new Uniform(paper)],
				['uPaperStrength', new Uniform(0.35)],
				['uPaperScale', new Uniform(1)],
				['uSteps', new Uniform(16)],
				['uQuantLow', new Uniform(0.2)],
				['uQuantHigh', new Uniform(0.7)],
				['uShadowTint', new Uniform(new Color(0.1, 0.1, 0.1))],
				['uSaturation', new Uniform(1.5)],
				['uMix', new Uniform(1)]
			])
		});
		this.paper = paper;
		this.setParams({ ...WATERCOLOR_DEFAULTS, ...params });
	}

	setParams(params: Partial<WatercolorParams>): void {
		const u = this.uniforms;
		if (params.mix !== undefined) u.get('uMix')!.value = params.mix;
		if (params.steps !== undefined) u.get('uSteps')!.value = params.steps;
		if (params.quantLow !== undefined) u.get('uQuantLow')!.value = params.quantLow;
		if (params.quantHigh !== undefined) u.get('uQuantHigh')!.value = params.quantHigh;
		if (params.saturation !== undefined) u.get('uSaturation')!.value = params.saturation;
		if (params.paperStrength !== undefined)
			u.get('uPaperStrength')!.value = params.paperStrength;
		if (params.paperScale !== undefined) u.get('uPaperScale')!.value = params.paperScale;
		if (params.shadowTint !== undefined)
			(u.get('uShadowTint')!.value as Color).set(params.shadowTint);
	}

	/** Owns the paper texture it was built with — see `createWatercolorEffect`. */
	override dispose(): void {
		this.paper.dispose();
		super.dispose();
	}
}

/**
 * Procedural rather than a PNG: it costs less than fetching an image, and it
 * means the pass has paper bound from the first frame — which is the difference
 * between "subtle" and "the screen is black".
 */
export function createWatercolorEffect(params: Partial<WatercolorParams> = {}): WatercolorEffect {
	const paper = makeProceduralGrainTexture({
		size: 512,
		// Near-isotropic: paper tooth is not wood grain, so the strong stretch
		// the bark preset wants would read as brushed metal here.
		stretch: 1.4,
		frequency: 28,
		octaves: 4,
		contrast: 0.8,
		seed: 7
	});
	paper.wrapS = paper.wrapT = RepeatWrapping;
	paper.needsUpdate = true;
	return new WatercolorEffect(paper, params);
}
