// Derived from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/grassField/index.tsx:390-494 @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ./VENDOR.md — upstream code, refactor deliberately.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE params → uniforms table.
//
// This is the single place that knows a param named `grColorBottom` drives a
// uniform named `uGrassBottom`. Upstream it lived inside the per-frame
// `useFrame` body; presets are keyed by PARAM name, not uniform name, so
// without this mapping a preset is meaningless.
//
// It is a LITERAL transcription of that block, in the original order. Some
// entries read other params (see `grPatchLinkColors` below), so reordering is
// not safe — do not "tidy" it.
//
// The one behavioural change from upstream: this does not run every frame.
// Upstream re-parsed ~20 CSS hex strings per frame via THREE.Color.set(); here
// it runs only when params actually change, and `tickGrassTime` carries the
// small per-frame hot path. See grassField.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { GrassFieldUniforms } from './uniforms';
import type { GrassParams } from './params';

/** Push a full params object into the uniform bag. */
export function applyGrassParams(u: GrassFieldUniforms, p: GrassParams): void {
	const s = u.surface;
	const f = u.flower;
	const b = u.bark;

	// Blades
	const rad = p.grWindDir * (Math.PI / 180);
	s.uWindDir.value.set(Math.cos(rad), Math.sin(rad));
	s.uWindStrength.value = p.grWindStrength;
	s.uWindSpeed.value = p.grWindSpeed;
	s.uWindFreq.value = p.grWindFreq;
	s.uWindTurb.value = p.grWindTurb;
	s.uWindLean.value = p.grWindLean;

	s.uGrassBottom.value.set(p.grColorBottom);
	s.uGrassTop.value.set(p.grColorTop);
	s.uGradStart.value = p.grGradStart;
	s.uGradEnd.value = p.grGradEnd;
	s.uGradPower.value = p.grGradPower;
	s.uBrightness.value = p.grBrightness;

	// Linked → the patch gradient IS the blade's bottom→top colors, so it matches
	// every preset without the presets having to set patch colors themselves.
	if (p.grPatchLinkColors) {
		s.uPatchLush.value.set(p.grColorBottom);
		s.uPatchDry.value.set(p.grColorTop);
	} else {
		s.uPatchLush.value.set(p.grPatchLush);
		s.uPatchDry.value.set(p.grPatchDry);
	}
	s.uPatchStrength.value = p.grPatchStrength;
	s.uPatchScale.value = p.grPatchScale;
	s.uPatchBias.value = p.grPatchBias;

	s.uShadowStrength.value = p.grShadowStrength;
	s.uShadowSamples.value = p.grShadowSamples;
	s.uShadowSampleY.value = p.grShadowSampleY;
	s.uShadowRadius.value = p.grShadowRadius;

	s.uTransColor.value.set(p.grTransColor);
	s.uTransStrength.value = p.grTransStrength;
	s.uTransPower.value = p.grTransPower;
	s.uTransTip.value = p.grTransTip;
	s.uTransShadow.value = p.grTransShadow;

	s.uDebugChannel.value = p.grDebugChannel;
	s.uWindFixLocal.value = p.grWindFixLocal ? 1 : 0;

	s.uRockFlatten.value = p.grRockFlatten;
	s.uRockBend.value = p.grRockBend;
	s.uRockRadiusMul.value = p.grRockRadiusMul;
	s.uRockFalloff.value = p.grRockFalloff;

	// Ground
	s.uTintFloor.value = p.grTintFloor ? 1 : 0;
	s.uFlatFloorNormal.value = p.grFlatFloorNormal;
	s.uDirtColor.value.set(p.grDirtColor);
	s.uDirtCoverage.value = p.grDirtCoverage;
	s.uDirtScale.value = p.grDirtScale;
	s.uDirtSoftness.value = p.grDirtSoftness;
	s.uDirtWarp.value = p.grDirtWarp;
	s.uDirtCut.value = p.grDirtCut;
	s.uDirtBlend.value = p.grDirtBlend;
	s.uGndVarColor.value.set(p.grGndVarColor);
	s.uGndVarScale.value = p.grGndVarScale;
	s.uGndVarStrength.value = p.grGndVarStrength;
	s.uGndGrainScale.value = p.grGndGrainScale;
	s.uGndGrainStrength.value = p.grGndGrainStrength;
	s.uGndReliefScale.value = p.grGndReliefScale;
	s.uGndReliefStrength.value = p.grGndReliefStrength;

	// Pine needles
	s.uLeafBottom.value.set(p.grLeafBottom);
	s.uLeafTop.value.set(p.grLeafTop);
	s.uLeafGradPower.value = p.grLeafGradPower;
	s.uLeafBrightness.value = p.grLeafBrightness;
	s.uLeafVarColor.value.set(p.grLeafVarColor);
	s.uLeafVarStrength.value = p.grLeafVarStrength;
	s.uLeafVarScale.value = p.grLeafVarScale;
	s.uLeafWindStrength.value = p.grLeafWindStrength;
	s.uLeafFlutterAmp.value = p.grLeafFlutterAmp;
	s.uLeafFlutterSpeed.value = p.grLeafFlutterSpeed;
	s.uLeafDip.value = p.grLeafDip;

	// Bark
	b.uBarkScale.value = p.grBarkScale;
	b.uBarkTint.value.set(p.grBarkTint);
	b.uBarkTintStrength.value = p.grBarkTintStrength;
	b.uBarkSaturation.value = p.grBarkSaturation;
	b.uBarkBrightness.value = p.grBarkBrightness;
	b.uBarkAOStrength.value = p.grBarkAOStrength;
	b.uBarkRelief.value = p.grBarkRelief;

	// Flowers — they share the grass wind direction and ground color, so the
	// whole field sways together and every base melts into the same soil.
	f.uWindDir.value.copy(s.uWindDir.value);
	f.uGrassColor.value.copy(s.uGrassBottom.value);
	f.uColorR.value.set(p.flColorR);
	f.uColorG.value.set(p.flColorG);
	f.uColorB.value.set(p.flColorB);
	f.uColorStem.value.set(p.flColorStem);
	f.uBrightness.value = p.flBrightness;
	f.uWindStrength.value = p.flWindStrength;
	f.uWindSpeed.value = p.flWindSpeed;
	f.uWindFreq.value = p.flWindFreq;
	f.uWindTurb.value = p.flWindTurb;
	f.uWindLean.value = p.flWindLean;
	f.uBendAmp.value = p.flBendAmp;
	f.uBendFreq.value = p.flBendFreq;
	f.uFlDirtMax.value = p.flDirtMax;
}

/**
 * The per-frame hot path: advance time and mirror it to the flowers.
 *
 * Upstream did this inside the same block as everything above, which meant ~95
 * assignments and ~20 hex-string parses every frame. Splitting it out is what
 * lets `applyGrassParams` run only on change — see the frame-budget note in
 * VENDOR.md.
 */
export function tickGrassTime(u: GrassFieldUniforms, delta: number): void {
	const t = (u.surface.uTime.value + delta) % 3600;
	u.surface.uTime.value = t;
	u.flower.uTime.value = t;
}
