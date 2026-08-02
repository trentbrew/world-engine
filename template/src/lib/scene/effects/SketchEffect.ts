import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Screen-space cross-hatch / sketchbook effect. Self-contained: shades by
 * per-pixel luminance against a screen-aligned hatch pattern, so it needs no
 * depth or neighbour sampling (safe inside a merged EffectPass).
 */
const fragmentShader = /* glsl */ `
	uniform float intensity;

	float hatch(vec2 p, float angle, float scale) {
		float s = sin(angle);
		float c = cos(angle);
		float v = p.x * c - p.y * s;
		return abs(fract(v / scale) - 0.5) * 2.0;
	}

	void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
		float lum = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
		vec2 frag = uv * resolution;

		float scale = 6.0;
		float ink = 1.0;
		if (lum < 0.85) ink = min(ink, hatch(frag, 0.785, scale));
		if (lum < 0.6) ink = min(ink, hatch(frag, -0.785, scale));
		if (lum < 0.4) ink = min(ink, hatch(frag, 0.0, scale));
		if (lum < 0.2) ink = min(ink, hatch(frag, 1.571, scale * 0.7));

		float line = smoothstep(0.0, 0.5, ink);
		vec3 inked = mix(vec3(0.04), inputColor.rgb, line);
		outputColor = vec4(mix(inputColor.rgb, inked, intensity), inputColor.a);
	}
`;

export class SketchEffect extends Effect {
	constructor(intensity = 0.6) {
		super('SketchEffect', fragmentShader, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map([['intensity', new Uniform(intensity)]])
		});
	}

	set intensity(value: number) {
		const uniform = this.uniforms.get('intensity');
		if (uniform) uniform.value = value;
	}

	get intensity(): number {
		return this.uniforms.get('intensity')?.value ?? 0;
	}
}
