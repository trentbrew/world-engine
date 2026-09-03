// Terrain-owned grass — scatters blades onto an arbitrary displaced surface
// (the terrain's heightmap mesh). Reuses the vendored grass core as-is:
// createGrassFieldUniforms / makeBladeMaterial / scatterBlades.
//
// Blades are baked in the SURFACE'S LOCAL space: the sampler is a detached Mesh
// sharing the surface geometry, so its matrixWorld is identity and scatterBlades
// emits instance matrices in mesh-local coordinates. Mount the returned
// InstancedMesh under the same transform as the surface and they align for any
// entity transform (mirrors the grass field's "scatter detached, mount under
// entity" invariant).

import { InstancedMesh, Mesh, Vector3, type DirectionalLight, type Material } from 'three';
import { createGrassFieldUniforms } from './uniforms';
import { scatterBlades } from './scatter';
import { applyGrassParams, tickGrassTime } from './applyParams';
import type { GrassParams } from './params';

export type TerrainGrassOptions = {
	params: GrassParams;
	onWarn?: (message: string) => void;
};

export type TerrainGrassHandle = {
	/** Mount this (InstancedMesh of blades, already in surface-local space). */
	object3D: InstancedMesh;
	/** Per-frame. `sun` mirrors the scene's directional light into uSunDir/uSunColor. */
	update(delta: number, sun: DirectionalLight | null): void;
	/** Non-structural param change — uniforms only (wind, colors). */
	setParams(next: GrassParams): void;
	dispose(): void;
};

const sunPos = new Vector3();
const sunTarget = new Vector3();

export function createTerrainGrass(
	surface: Mesh,
	opts: TerrainGrassOptions
): TerrainGrassHandle {
	const u = createGrassFieldUniforms();

	// Detached sampler: fresh identity matrixWorld, shared geometry. scatterBlades
	// reads geometry (surface-local) × matrixWorld (identity) → blade matrices are
	// in the terrain's local space, which matches its own mesh. Do NOT dispose the
	// sampler's geometry — the surface still owns it.
	const sampler = new Mesh(surface.geometry);
	sampler.updateMatrixWorld(true);

	const blades = scatterBlades(sampler, {
		uniforms: u.surface,
		density: opts.params.grDensity,
		maxCount: opts.params.grMaxCount,
		minWidth: opts.params.grMinWidth,
		maxWidth: opts.params.grMaxWidth,
		minLength: opts.params.grMinLength,
		maxLength: opts.params.grMaxLength,
		tiltMax: opts.params.grTiltMax,
		segments: opts.params.grSegments
	});
	blades.name = 'TerrainGrass';
	applyGrassParams(u, opts.params);

	return {
		object3D: blades,
		update(delta: number, sun: DirectionalLight | null) {
			tickGrassTime(u, delta);
			if (!sun) return;
			sun.getWorldPosition(sunPos);
			sun.target.getWorldPosition(sunTarget);
			u.surface.uSunDir.value.subVectors(sunPos, sunTarget).normalize();
			u.surface.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
		},
		setParams(next: GrassParams) {
			applyGrassParams(u, next);
		},
		dispose() {
			blades.geometry.dispose();
			(blades.material as Material).dispose();
		}
	};
}
