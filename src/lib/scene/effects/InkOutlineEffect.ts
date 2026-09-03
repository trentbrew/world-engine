// Vendored from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/outline/OutlineFilter.tsx @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ../../engine/render/grass/VENDOR.md — upstream code, refactor deliberately.
//
// Renamed from upstream's `OutlineEffect`: `postprocessing` exports a class of
// that name and ViewportComposer already imports it for editor selection
// outlines. This is the art outline, and the two must not collide.
//
// Upstream's React wrapper (`OutlinePass`, `useOutlineControls`) drove the
// uniforms from leva through `useEffect`. That is replaced here by `setParams`
// / `setTexel` / `setCameraRange`, called from ViewportComposer.

import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Color, Uniform, Vector2, type PerspectiveCamera } from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Ink lines, by edge-detecting the frame. A 3×3 Sobel, 8 taps per pixel.
//
// ── What it detects: DEPTH or LUMINANCE ──────────────────────────────────────
//
//   DEPTH — geometry only. A shadow does not change depth, and neither does the
//   shading gradient running around a curved surface, so neither gets inked.
//   What survives is the silhouette and the places the form folds in front of
//   itself. This is what "outline" usually means.
//
//   LUMINANCE — anything that changes brightness. Silhouettes, but also cast
//   shadows, terminators, specular flecks and texture detail.
//
// ⚠ The depth source outlines what the DEPTH BUFFER contains, which is not the
// same set of things the viewer can see. Invisible helper geometry that still
// writes depth gets outlined like anything else — the classic offender being a
// shadow-catching ground plane: transparent in colour, fully present in depth,
// drawing an ink horizon across an empty background. Set `depthWrite = false`
// on any such mesh.
//
// ⚠ ORDERING (this is why the effect cannot join a merged EffectPass):
// `postprocessing` attaches the scene depth texture to the composer's INITIAL
// input buffer, and every pass with `needsSwap` rotates it. A few passes in,
// that attachment has been used as a render target and cleared — an outline
// running later would read depth 1.0 everywhere and draw nothing. It must sit
// in its own EffectPass immediately after RenderPass.
// ─────────────────────────────────────────────────────────────────────────────

/** Edge signal. Values are the `uSource` uniform, not display order. */
export const OUTLINE_SOURCE = {
	/** Geometry only. Ignores shadows and shading. Needs the depth buffer, so it
	 *  only works before any pass that swaps buffers. */
	DEPTH: 1,
	/** Every brightness change. The only option once depth is gone. */
	LUMINANCE: 0
} as const;

export type OutlineSource = (typeof OUTLINE_SOURCE)[keyof typeof OUTLINE_SOURCE];

export type InkOutlineParams = {
	strength: number;
	thickness: number;
	threshold: number;
	softness: number;
	color: string;
	source: OutlineSource;
};

export const INK_OUTLINE_DEFAULTS: InkOutlineParams = {
	strength: 0,
	thickness: 5.1,
	threshold: 1.25,
	softness: 0.01,
	color: '#2b2118',
	source: OUTLINE_SOURCE.DEPTH
};

const OUTLINE_FRAG = /* glsl */ `
  uniform float uStrength;
  uniform float uThickness;
  uniform float uThreshold;
  uniform float uSoftness;
  uniform vec3  uColor;
  uniform vec2  uTexel;
  uniform int   uSource;
  uniform float uNear;
  uniform float uFar;

  float lumAt(vec2 p) {
    // Rec.601, matching the weights the paint pass collapses its variance with,
    // so both agree on what counts as a change in value.
    return dot(texture2D(inputBuffer, p).rgb, vec3(0.299, 0.587, 0.114));
  }

  /**
   * Window depth back to a distance in view units.
   *
   * The raw buffer is wildly non-linear — most of its range is spent on the
   * first few percent of the frustum — so a Sobel straight over it would find a
   * cliff at every near edge and nothing at all further out.
   */
  float linearizeDepth(float d) {
    return (uNear * uFar) / (uFar - d * (uFar - uNear));
  }

  /** readDepth(), not a raw texture2D: the buffer may be RGBA-packed depending
   *  on what the renderer could allocate, and the helper handles both. */
  float depthAt(vec2 p) {
    return linearizeDepth(readDepth(p));
  }

  // The \`depth\` parameter is not decoration. postprocessing only declares
  // depthBuffer and readDepth() for an effect whose mainImage SIGNATURE names
  // it — see integrateEffect's depthParamRegExp — so dropping it here would
  // leave the two helpers above referring to identifiers that do not exist.
  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    if (uStrength <= 0.0) { outputColor = inputColor; return; }

    // Thickness is a texel multiplier rather than a blur radius: widening the
    // Sobel's reach is what thickens the line, and it stays one 3x3 kernel at
    // any width instead of costing more samples.
    vec2 t = uTexel * uThickness;

    float s00, s10, s20, s01, s11, s21, s02, s12, s22;

    if (uSource == ${OUTLINE_SOURCE.DEPTH}) {
      s00 = depthAt(uv + vec2(-t.x, -t.y));
      s10 = depthAt(uv + vec2( 0.0, -t.y));
      s20 = depthAt(uv + vec2( t.x, -t.y));
      s01 = depthAt(uv + vec2(-t.x,  0.0));
      // The centre tap arrives as a parameter already — one fetch saved.
      s11 = linearizeDepth(depth);
      s21 = depthAt(uv + vec2( t.x,  0.0));
      s02 = depthAt(uv + vec2(-t.x,  t.y));
      s12 = depthAt(uv + vec2( 0.0,  t.y));
      s22 = depthAt(uv + vec2( t.x,  t.y));
    } else {
      s00 = lumAt(uv + vec2(-t.x, -t.y));
      s10 = lumAt(uv + vec2( 0.0, -t.y));
      s20 = lumAt(uv + vec2( t.x, -t.y));
      s01 = lumAt(uv + vec2(-t.x,  0.0));
      s11 = 0.0; // unused by the kernel; only depth needs the centre tap
      s21 = lumAt(uv + vec2( t.x,  0.0));
      s02 = lumAt(uv + vec2(-t.x,  t.y));
      s12 = lumAt(uv + vec2( 0.0,  t.y));
      s22 = lumAt(uv + vec2( t.x,  t.y));
    }

    float gx = -s00 - 2.0 * s01 - s02 + s20 + 2.0 * s21 + s22;
    float gy = -s00 - 2.0 * s10 - s20 + s02 + 2.0 * s12 + s22;
    float g = sqrt(gx * gx + gy * gy);

    // Depth gradients are in world units, so the same step reads as a bigger
    // number up close than far away and one threshold could not serve both.
    // Dividing by the centre distance makes the measure scale-invariant: the
    // threshold then means "this much depth change per unit of distance", and a
    // silhouette inks the same whether it is two metres out or twenty.
    if (uSource == ${OUTLINE_SOURCE.DEPTH}) {
      g /= max(s11, 1e-3);
    }

    // Soft threshold, not a step: a hard cut aliases badly along a diagonal,
    // and the softness knob is also what turns a technical line into one with
    // some weight to it.
    float edge = smoothstep(uThreshold, uThreshold + max(uSoftness, 1e-4), g);

    outputColor = vec4(mix(inputColor.rgb, uColor, edge * uStrength), inputColor.a);
  }
`;

export class InkOutlineEffect extends Effect {
	constructor(params: Partial<InkOutlineParams> = {}) {
		super('InkOutlineEffect', OUTLINE_FRAG, {
			blendFunction: BlendFunction.NORMAL,
			// CONVOLUTION: mainImage reads inputBuffer away from its own uv, so it
			// cannot be merged with neighbours that assume it does not.
			// DEPTH: asks the composer for a depth texture. Declared unconditionally
			// — the source is a uniform, so the same compiled effect has to be able
			// to answer either way.
			attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
			uniforms: new Map<string, Uniform>([
				['uStrength', new Uniform(0)],
				['uThickness', new Uniform(1)],
				['uThreshold', new Uniform(0.25)],
				['uSoftness', new Uniform(0.12)],
				['uColor', new Uniform(new Color('#2b2118'))],
				['uTexel', new Uniform(new Vector2(1 / 1280, 1 / 720))],
				['uSource', new Uniform(OUTLINE_SOURCE.DEPTH as number)],
				['uNear', new Uniform(0.1)],
				['uFar', new Uniform(100)]
			])
		});
		this.setParams({ ...INK_OUTLINE_DEFAULTS, ...params });
	}

	setParams(params: Partial<InkOutlineParams>): void {
		const u = this.uniforms;
		if (params.strength !== undefined) u.get('uStrength')!.value = params.strength;
		if (params.thickness !== undefined) u.get('uThickness')!.value = params.thickness;
		if (params.threshold !== undefined) u.get('uThreshold')!.value = params.threshold;
		if (params.softness !== undefined) u.get('uSoftness')!.value = params.softness;
		if (params.source !== undefined) u.get('uSource')!.value = params.source;
		if (params.color !== undefined) (u.get('uColor')!.value as Color).set(params.color);
	}

	/**
	 * One texel of the DRAWING buffer, not of the CSS box — the shader steps in
	 * real pixels, so a line would come out half as wide on a dpr-2 canvas if
	 * this used the layout size.
	 */
	setTexel(width: number, height: number, dpr = 1): void {
		const texel = this.uniforms.get('uTexel')!.value as Vector2;
		texel.set(1 / Math.max(width * dpr, 1), 1 / Math.max(height * dpr, 1));
	}

	/**
	 * Read live rather than hard-coded: linearising depth is meaningless without
	 * the exact frustum that produced it, and a scene is free to change near/far
	 * at runtime.
	 */
	setCameraRange(camera: PerspectiveCamera): void {
		this.uniforms.get('uNear')!.value = camera.near ?? 0.1;
		this.uniforms.get('uFar')!.value = camera.far ?? 100;
	}
}
