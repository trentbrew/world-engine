// Derived from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/waterFloor/index.tsx @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ../grass/VENDOR.md — upstream code, refactor deliberately.
//
// ─────────────────────────────────────────────────────────────────────────────
// The cel-shaded water surface, as a plain three.js object.
//
// SCOPED DOWN DELIBERATELY. Upstream's waterFloor is seven R3F components: a
// GPU wave simulation (a ping-pong PDE on render targets at a fixed 60Hz), a
// sparkle layer, a depth-intersection band, a seabed, a shadow catcher, a global
// object registry singleton, and this surface. Only the surface is ported.
//
// The rest fights this engine's model rather than fitting it: the wave sim wants
// to own its own clock, and the registry is a module-level singleton in an
// engine where everything else is an entity. Those are worth revisiting as
// engine systems, not as a translation.
//
// The ripple UNIFORMS are kept (they are part of this shader) and exposed as
// params, but nothing emits ripples yet — upstream drove them from a
// `useWaterRipple` gameplay hook. Count stays 0 until an engine system feeds it.
// ─────────────────────────────────────────────────────────────────────────────

import {
	Color,
	DoubleSide,
	FrontSide,
	Mesh,
	PlaneGeometry,
	ShaderMaterial,
	Vector2,
	type Camera
} from 'three';

import { FRAG, VERT } from './waterShaders';

export type WaterParams = {
	scale: number;
	cellSmoothness: number;
	edgeThreshold: number;
	edgeSoftness: number;
	flowX: number;
	flowZ: number;
	cellSpeed: number;
	noiseScale: number;
	noiseFlowSpeed: number;
	distortAmount: number;
	deepColor: string;
	midColor: string;
	midPos: number;
	highlightColor: string;
	opacity: number;
	deepOpacity: number;
	fadeDistance: number;
	fadeStrength: number;
};

export const WATER_DEFAULTS: WaterParams = {
	scale: 0.23,
	cellSmoothness: 0.46,
	edgeThreshold: 0.09,
	edgeSoftness: 0.1,
	flowX: 0.07,
	flowZ: -0.23,
	cellSpeed: 0.55,
	noiseScale: 0.87,
	noiseFlowSpeed: 0.11,
	distortAmount: 0.26,
	deepColor: '#27a3d8',
	midColor: '#59c0e8',
	midPos: 0.31,
	highlightColor: '#ffffff',
	opacity: 1.0,
	deepOpacity: 0.37,
	fadeDistance: 275,
	fadeStrength: 1.3
};

export type WaterSurfaceOptions = {
	params?: WaterParams;
	/** Side length of the plane. */
	size?: number;
	/**
	 * Follow the camera in XZ so the surface reads as an endless ocean.
	 *
	 * Upstream did this unconditionally with a 600×600 plane. Here it is OFF by
	 * default: an entity owns its own position through Transform, and a mesh that
	 * silently relocates itself every frame fights the gizmo, the collider and
	 * the author's mental model. Worlds that genuinely want an ocean opt in.
	 */
	infinite?: boolean;
};

export type WaterSurfaceHandle = {
	object3D: Mesh;
	setParams(next: WaterParams): void;
	/** Advance flow. `delta` is a per-frame delta, as with grass's tickGrassTime — the shader time is accumulated internally. */
	update(delta: number, camera?: Camera): void;
	dispose(): void;
};

const RIPPLE_SLOTS = 8;

export function createWaterSurface(opts: WaterSurfaceOptions = {}): WaterSurfaceHandle {
	const { size = 40, infinite = false } = opts;

	const uniforms = {
		uTime: { value: 0 },
		uScale: { value: 0.3 },
		uSmoothness: { value: 0.55 },
		uEdgeThreshold: { value: 0.067 },
		uEdgeSoftness: { value: 0.01 },
		uFlowX: { value: 0 },
		uFlowZ: { value: 0.05 },
		uCellSpeed: { value: 0.3 },
		uNoiseScale: { value: 1.52 },
		uNoiseFlowSpeed: { value: 0.2 },
		uDistortAmount: { value: 0.3 },
		uDeepColor: { value: new Color('#1a3a5c') },
		uMidColor: { value: new Color('#59c0e8') },
		uMidPos: { value: 0.084 },
		uHighlight: { value: new Color('#ffffff') },
		uOpacity: { value: 1.0 },
		uDeepOpacity: { value: 0.45 },
		uFadeDistance: { value: 90.0 },
		uFadeStrength: { value: 1.4 },
		uCamXZ: { value: new Vector2() },
		// Ripple uniforms — see the header: the shader reads them, nothing feeds
		// them yet, and count 0 makes the whole block a no-op.
		uRippleCenters: { value: Array.from({ length: RIPPLE_SLOTS }, () => new Vector2()) },
		uRippleTimes: { value: new Array(RIPPLE_SLOTS).fill(0) },
		uRippleCount: { value: 0 },
		uRippleSpeed: { value: 1.5 },
		uRippleWidth: { value: 0.12 },
		uRippleStrength: { value: 5.5 },
		uRippleDecay: { value: 1.6 },
		uRippleRings: { value: 2 },
		uRippleSpacing: { value: 1.0 }
	};

	const geometry = new PlaneGeometry(size, size);
	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		// Upstream used FrontSide on a camera-following plane always viewed from
		// above. An entity-placed surface can be looked at from underneath, so a
		// finite one is double-sided; an infinite one keeps upstream's behaviour.
		side: infinite ? FrontSide : DoubleSide,
		vertexShader: VERT,
		fragmentShader: FRAG,
		uniforms
	});

	const object3D = new Mesh(geometry, material);
	object3D.name = 'WaterSurface';
	// Lie in the XZ play plane.
	object3D.rotation.x = -Math.PI / 2;
	object3D.renderOrder = 2;
	if (infinite) object3D.frustumCulled = false;

	function apply(p: WaterParams) {
		uniforms.uScale.value = p.scale;
		uniforms.uSmoothness.value = p.cellSmoothness;
		uniforms.uEdgeThreshold.value = p.edgeThreshold;
		uniforms.uEdgeSoftness.value = p.edgeSoftness;
		uniforms.uFlowX.value = p.flowX;
		uniforms.uFlowZ.value = p.flowZ;
		uniforms.uCellSpeed.value = p.cellSpeed;
		uniforms.uNoiseScale.value = p.noiseScale;
		uniforms.uNoiseFlowSpeed.value = p.noiseFlowSpeed;
		uniforms.uDistortAmount.value = p.distortAmount;
		uniforms.uDeepColor.value.set(p.deepColor);
		uniforms.uMidColor.value.set(p.midColor);
		uniforms.uMidPos.value = p.midPos;
		uniforms.uHighlight.value.set(p.highlightColor);
		uniforms.uOpacity.value = p.opacity;
		uniforms.uDeepOpacity.value = p.deepOpacity;
		uniforms.uFadeDistance.value = p.fadeDistance;
		uniforms.uFadeStrength.value = p.fadeStrength;
	}

	apply(opts.params ?? WATER_DEFAULTS);

	return {
		object3D,

		setParams(next: WaterParams) {
			apply(next);
		},

		update(delta: number, camera?: Camera) {
			// Accumulate, don't store the delta: the shader advances flow via
			// sin(uTime * uCellSpeed) + uTime * uFlowX, so uTime must be an
			// absolute elapsed clock. Feeding it raw delta (≈0.016) freezes the
			// surface — that's the bug this guards against.
			uniforms.uTime.value = (uniforms.uTime.value + delta) % 3600;
			// The distance fade is measured from the camera, so it needs the camera
			// position even when the surface itself stays put. Nullable during
			// first frames before Threlte's camera ref resolves.
			if (camera) {
				uniforms.uCamXZ.value.set(camera.position.x, camera.position.z);
				if (infinite) {
					object3D.position.x = camera.position.x;
					object3D.position.z = camera.position.z;
				}
			}
		},

		dispose() {
			geometry.dispose();
			material.dispose();
		}
	};
}
