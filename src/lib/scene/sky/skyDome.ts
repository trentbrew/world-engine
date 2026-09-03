// Derived from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/skyDome/SkyDome.tsx @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ../../engine/render/grass/VENDOR.md — upstream code, refactor deliberately.
//
// ─────────────────────────────────────────────────────────────────────────────
// The stylized sky dome, as a plain three.js object.
//
// Same split as the grass field: a framework-agnostic core with an imperative
// lifecycle, wrapped by a thin Threlte component. Upstream this was a single
// 1560-line R3F component driven by ~60 leva knobs.
//
// This does NOT replace the engine's existing physical `<Sky>` (Preetham
// atmospheric scattering). That one does daylight, and only daylight — no moon,
// stars, clouds or aurora. This one is a painted dome that does all of those and
// no scattering. They are alternatives, selected by `ui.scene.sky.kind`.
//
// Rendering: a BackSide unit sphere with depthWrite/depthTest off and
// renderOrder -100, so it draws first, behind everything, and never pollutes the
// depth buffer. It follows the camera each frame, which is what makes it a sky
// rather than a very large ball.
// ─────────────────────────────────────────────────────────────────────────────

import {
	BackSide,
	Color,
	Mesh,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type Camera
} from 'three';

import { SKY_FRAG, SKY_VERT } from './skyDomeShaders';
import { SKY_PRESETS, type SkyMode, type SkyPreset } from './stylizedSkyPresets';

export type { SkyMode } from './stylizedSkyPresets';

export const STYLIZED_SKY_MODES: SkyMode[] = ['sunrise', 'day', 'sunset', 'night'];

export type StylizedSkyOptions = {
	mode?: SkyMode;
	/** Sphere radius. Must sit inside the camera's far plane. */
	radius?: number;
	/**
	 * Lifts the sphere centre above the camera so horizontal rays meet the dome
	 * with dir.y below the cloud floor. Without it the cloud UVs blow up as
	 * dir.y → 0 (they divide by it) and the horizon smears.
	 */
	offsetY?: number;
};

export type StylizedSkyHandle = {
	object3D: Mesh;
	setMode(mode: SkyMode): void;
	/** Follow the camera and advance cloud/star/aurora animation. */
	update(elapsed: number, camera: Camera): void;
	dispose(): void;
};

/** Every uniform the dome shader reads, at its upstream default. */
function createUniforms() {
	return {
		uSkyLow: { value: new Color('#011851') },
		uSkyHigh: { value: new Color('#011f9d') },
		uHorizonLine: { value: 0.1 },
		uHorizonSpread: { value: 0.35 },
		uMoonDir: { value: new Vector3(0, 0.6, -0.8).normalize() },
		uMoonColor: { value: new Color('#fff8d0') },
		uMoonGlowColor: { value: new Color('#1a3580') },
		uMoonSize: { value: 0.06 },
		uMoonGlowFalloff: { value: 8 },
		uMoonGlowIntensity: { value: 0.6 },
		uMoonEdgeSoftness: { value: 0.02 },
		uMoonPhasePos: { value: 0.3 },
		uMoonPhaseSoftness: { value: 0.2 },
		uMoonPhaseAngle: { value: 0.0 },
		uMoonEmission: { value: 0.35 },
		uMoonSpotColor: { value: new Color('#3a6ab5') },
		uMoonSpotScale: { value: 1.8 },
		uMoonSpotStrength: { value: 0.8 },
		uMoonSpotThreshold: { value: 0.55 },
		uMoonSpotSharpness: { value: 0.04 },
		uMoonSpotOctaves: { value: 4 },
		uSideWarp: { value: 0 },
		uSideTwist: { value: 0 },
		uAuroraIntensity: { value: 0 },
		uAuroraColor1: { value: new Color('#3affd8') },
		uAuroraColor2: { value: new Color('#7b5bff') },
		uAuroraFloor: { value: 0.15 },
		uAuroraCeil: { value: 0.75 },
		uAuroraScale: { value: 3.0 },
		uAuroraSpeed: { value: 0.02 },
		uAuroraThresh: { value: 0.55 },
		uAuroraSoft: { value: 0.25 },
		uAuroraWav: { value: 1.5 },
		uStarDensity: { value: 150 },
		uStarSize: { value: 0.03 },
		uStarBrightness: { value: 2.0 },
		uStarFloor: { value: 0.0 },
		uStarDriftY: { value: 0.002 },
		uStarDriftZ: { value: 0.0 },
		uStarTwinkleSpeed: { value: 1.2 },
		uStarTwinkleAmount: { value: 0.5 },
		uTime: { value: 0 },
		uCloudMorphSpeed: { value: 0.03 },
		uCloudSpeed: { value: 0 },
		uCloudScale: { value: 2.2 },
		uCloudDensity: { value: 0.45 },
		uCloudSharpness: { value: 0.06 },
		uCloudCore: { value: new Color('#030d1f') },
		uCloudEdge: { value: new Color('#2a5299') },
		uCloudRim: { value: new Color('#8bbfee') },
		uCloudEdgeWidth: { value: 0.35 },
		uCloudRimStrength: { value: 1.7 },
		uMoonLightRadius: { value: 0.06 },
		uMoonLightSoftness: { value: 0.5 },
		uCloudDarkenFar: { value: 0.25 },
		uCloudStretch: { value: 0.6 },
		uCloudFloor: { value: 0.04 },
		uCloudCeiling: { value: 1.0 },
		uCloudOpacity: { value: 0.9 },
		uCloudOctaves: { value: 6 },
		uCloudAmplitude: { value: 0.5 },
		uCloudGrain: { value: 0.08 },
		uCloudSkew: { value: 0.6 }
	};
}

type SkyUniforms = ReturnType<typeof createUniforms>;

const DEG = Math.PI / 180;

/**
 * Push one preset into the uniforms.
 *
 * Transcribed from upstream's `useFrame` body, minus the leva indirection: there
 * every value came from a panel that the preset had pushed into, so a preset
 * effectively WAS the uniform set. Here the preset is read directly.
 *
 * Feature flags gate rather than set: upstream forces the relevant uniform to 0
 * when a preset disables a feature, which is why `night` can define aurora
 * values that `day` simply never shows.
 */
function applyPreset(u: SkyUniforms, p: SkyPreset): void {
	if (p.skyLow) u.uSkyLow.value.set(p.skyLow);
	if (p.skyHigh) u.uSkyHigh.value.set(p.skyHigh);
	if (p.horizonLine !== undefined) u.uHorizonLine.value = p.horizonLine;
	if (p.horizonSpread !== undefined) u.uHorizonSpread.value = p.horizonSpread;

	// Moon / sun disc — the same system serves both.
	const elRad = (p.moonElev ?? 0) * DEG;
	const azRad = (p.moonAzim ?? 180) * DEG;
	u.uMoonDir.value.set(
		Math.cos(elRad) * Math.sin(azRad),
		Math.sin(elRad),
		Math.cos(elRad) * Math.cos(azRad)
	);
	if (p.moonColor) u.uMoonColor.value.set(p.moonColor);
	if (p.moonGlowColor) u.uMoonGlowColor.value.set(p.moonGlowColor);
	u.uMoonSize.value = p.moonEnabled ? (p.moonSize ?? 0.025) : 0;
	if (p.moonGlowFalloff !== undefined) u.uMoonGlowFalloff.value = p.moonGlowFalloff;
	if (p.moonGlowIntensity !== undefined) u.uMoonGlowIntensity.value = p.moonGlowIntensity;
	if (p.moonEdgeSoftness !== undefined) u.uMoonEdgeSoftness.value = p.moonEdgeSoftness;
	if (p.moonPhasePos !== undefined) u.uMoonPhasePos.value = p.moonPhasePos;
	if (p.moonPhaseSoftness !== undefined) u.uMoonPhaseSoftness.value = p.moonPhaseSoftness;
	if (p.moonPhaseAngle !== undefined) u.uMoonPhaseAngle.value = p.moonPhaseAngle * DEG;
	if (p.moonEmission !== undefined) u.uMoonEmission.value = p.moonEmission;
	if (p.moonSpotColor) u.uMoonSpotColor.value.set(p.moonSpotColor);
	if (p.moonSpotStrength !== undefined) u.uMoonSpotStrength.value = p.moonSpotStrength;

	// Stars — brightness is the gate, so a daytime preset keeps its star values.
	if (p.starDensity !== undefined) u.uStarDensity.value = p.starDensity;
	if (p.starSize !== undefined) u.uStarSize.value = p.starSize;
	u.uStarBrightness.value = p.starsEnabled ? (p.starBrightness ?? 2.0) : 0;
	if (p.starFloor !== undefined) u.uStarFloor.value = p.starFloor;

	// Side distortion is off unless a preset opts in (upstream used it for a
	// boss fight); there is no engine feature behind it yet.
	u.uSideWarp.value = 0;
	u.uSideTwist.value = 0;

	u.uAuroraIntensity.value = p.auroraEnabled ? (p.auroraIntensity ?? 0) : 0;
	if (p.auroraColor1) u.uAuroraColor1.value.set(p.auroraColor1);
	if (p.auroraColor2) u.uAuroraColor2.value.set(p.auroraColor2);

	// Clouds
	if (p.cloudMorphSpeed !== undefined) u.uCloudMorphSpeed.value = p.cloudMorphSpeed;
	if (p.cloudSpeed !== undefined) u.uCloudSpeed.value = p.cloudSpeed;
	if (p.cloudScale !== undefined) u.uCloudScale.value = p.cloudScale;
	if (p.cloudDensity !== undefined) u.uCloudDensity.value = p.cloudDensity;
	if (p.cloudSharpness !== undefined) u.uCloudSharpness.value = p.cloudSharpness;
	if (p.cloudCore) u.uCloudCore.value.set(p.cloudCore);
	if (p.cloudEdge) u.uCloudEdge.value.set(p.cloudEdge);
	if (p.cloudRim) u.uCloudRim.value.set(p.cloudRim);
	if (p.cloudEdgeWidth !== undefined) u.uCloudEdgeWidth.value = p.cloudEdgeWidth;
	if (p.cloudRimStrength !== undefined) u.uCloudRimStrength.value = p.cloudRimStrength;
	if (p.moonLightRadius !== undefined) u.uMoonLightRadius.value = p.moonLightRadius;
	if (p.moonLightSoftness !== undefined) u.uMoonLightSoftness.value = p.moonLightSoftness;
	if (p.cloudDarkenFar !== undefined) u.uCloudDarkenFar.value = p.cloudDarkenFar;
	if (p.cloudStretch !== undefined) u.uCloudStretch.value = p.cloudStretch;
	if (p.cloudFloor !== undefined) u.uCloudFloor.value = p.cloudFloor;
	if (p.cloudCeiling !== undefined) u.uCloudCeiling.value = p.cloudCeiling;
	u.uCloudOpacity.value = p.cloudsEnabled ? (p.cloudOpacity ?? 0.9) : 0;
	if (p.cloudOctaves !== undefined) u.uCloudOctaves.value = p.cloudOctaves;
	if (p.cloudAmplitude !== undefined) u.uCloudAmplitude.value = p.cloudAmplitude;
	if (p.cloudGrain !== undefined) u.uCloudGrain.value = p.cloudGrain;
	// uCloudSkew has no preset field upstream — presets never varied it, so it
	// stays at its shader default rather than being invented here.
}

export function createStylizedSky(opts: StylizedSkyOptions = {}): StylizedSkyHandle {
	const { radius = 400, offsetY = 0 } = opts;

	const uniforms = createUniforms();
	const geometry = new SphereGeometry(1, 32, 24);
	const material = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		depthTest: false,
		vertexShader: SKY_VERT,
		fragmentShader: SKY_FRAG,
		uniforms
	});

	const object3D = new Mesh(geometry, material);
	object3D.name = 'StylizedSkyDome';
	// Draw before everything else, and never let the engine's frustum culling
	// drop it — it is always "around" the camera, and its bounds move with it.
	object3D.renderOrder = -100;
	object3D.frustumCulled = false;
	object3D.scale.setScalar(radius);

	applyPreset(uniforms, SKY_PRESETS[opts.mode ?? 'night']);

	return {
		object3D,

		setMode(mode: SkyMode) {
			const preset = SKY_PRESETS[mode];
			if (preset) applyPreset(uniforms, preset);
		},

		update(elapsed: number, camera: Camera) {
			object3D.position.set(
				camera.position.x,
				camera.position.y + offsetY,
				camera.position.z
			);
			uniforms.uTime.value = elapsed;
		},

		dispose() {
			geometry.dispose();
			material.dispose();
		}
	};
}
