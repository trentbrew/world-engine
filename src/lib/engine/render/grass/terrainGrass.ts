// Terrain-owned grass — scatters blades (and, when flower textures are
// supplied, upstream's cross-billboard flowers) onto an arbitrary displaced
// surface (the terrain's heightmap mesh). Reuses the vendored grass core as-is:
// createGrassFieldUniforms / makeBladeMaterial / scatterBlades / scatterFlowers.
//
// Blades and flowers are baked in the SURFACE'S LOCAL space: the sampler is a
// detached Mesh sharing the surface geometry, so its matrixWorld is identity
// and scatter* emits instance matrices in mesh-local coordinates. Mount the
// returned group under the same transform as the surface and they align for any
// entity transform (mirrors the grass field's "scatter detached, mount under
// entity" invariant). For a mount under a DIFFERENT transform (cross-entity
// scatter), pass `mountMatrix` (`inv(consumerWorld) * surfaceWorld`) to rebase
// the baked instances into the mount's local space.

import {
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	Vector3,
	type DirectionalLight,
	type Material
} from 'three';
import { createGrassFieldUniforms, type GrassFieldUniforms } from './uniforms';
import { scatterBlades, scatterFlowers } from './scatter';
import { applyGrassParams, tickGrassTime } from './applyParams';
import type { GrassParams } from './params';
import type { FlowerTextureSet } from './grassField';

export type TerrainGrassOptions = {
	params: GrassParams;
	/** Shared grass uniforms — default created here; pass the same object the
	 *  terrain ground blend uses so dirt and blades read one source. */
	uniforms?: GrassFieldUniforms;
	/**
	 * Flower texture sets (mask, RGB zones, base→tip gradient per variant).
	 * Flowers render only when these are present AND `params.flEnabled` —
	 * the shader has nothing to sample without them. Gated the same way as
	 * the full grass field (see grassField.ts `hasFlowerTextures`).
	 */
	flowers?: { a: FlowerTextureSet; b: FlowerTextureSet };
	/**
	 * Maps surface-local instance matrices into the mount's local space:
	 * `inv(consumerWorld) * surfaceWorld`. Omitted (or identity) keeps the
	 * historical behavior — instances stay in surface-local space for mounting
	 * under the surface's own transform. Required when the consumer lives under
	 * a different transform than the surface (cross-entity scatter).
	 */
	mountMatrix?: Matrix4;
	/**
	 * Drop instances scattered below this SURFACE-LOCAL Y. Set it to the water
	 * line so an island's submerged rim comes up bare instead of growing a lawn
	 * across the seabed. Applied before `mountMatrix`, while the baked matrices
	 * are still in the surface's own frame.
	 */
	minY?: number;
	onWarn?: (message: string) => void;
};

export type TerrainGrassHandle = {
	/** Mount this (blades plus optional flowers, already in surface-local space). */
	object3D: Group;
	/** The grass uniforms driving this field (blades + any ground blend). */
	uniforms: GrassFieldUniforms;
	/** Per-frame. `sun` mirrors the scene's directional light into uSunDir/uSunColor. */
	update(delta: number, sun: DirectionalLight | null): void;
	/** Non-structural param change — uniforms only (wind, colors). */
	setParams(next: GrassParams): void;
	dispose(): void;
};

const sunPos = new Vector3();
const sunTarget = new Vector3();

/**
 * Compact an instanced mesh in place, keeping only instances at or above `minY`.
 *
 * Survivors are moved to the front of the buffer and `count` is lowered, rather
 * than the usual trick of scaling rejects to zero: a degenerate instance still
 * costs a vertex shader invocation, and an island's rim can be a large fraction
 * of the field.
 */
function cullBelow(mesh: InstancedMesh, minY: number): void {
	const m = new Matrix4();
	let kept = 0;
	for (let i = 0; i < mesh.count; i++) {
		mesh.getMatrixAt(i, m);
		// Column-major: elements[13] is the translation's Y.
		if (m.elements[13]! < minY) continue;
		if (kept !== i) mesh.setMatrixAt(kept, m);
		kept++;
	}
	mesh.count = kept;
	mesh.instanceMatrix.needsUpdate = true;
}

export function createTerrainGrass(
	surface: Mesh,
	opts: TerrainGrassOptions
): TerrainGrassHandle {
	const u = opts.uniforms ?? createGrassFieldUniforms();

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
	if (opts.minY !== undefined) cullBelow(blades, opts.minY);
	// Cross-entity mount: rebase surface-local instances into the mount's local
	// space (build-time only; the common same-transform case passes identity).
	if (opts.mountMatrix) {
		const m = new Matrix4();
		for (let i = 0; i < blades.count; i++) {
			blades.getMatrixAt(i, m);
			m.premultiply(opts.mountMatrix);
			blades.setMatrixAt(i, m);
		}
		blades.instanceMatrix.needsUpdate = true;
	}
	const group = new Group();
	group.name = 'TerrainGrassField';
	group.add(blades);
	const owned: { geometries: InstancedMesh['geometry'][]; materials: Material[] } = {
		geometries: [blades.geometry],
		materials: [blades.material as Material]
	};

	// Flowers share the sampler (surface-local space) and the dirt uniforms, so
	// they cull onto grass and off bare earth exactly like the field's own.
	if (opts.params.flEnabled && opts.flowers) {
		// Textures are bound once — they never change for the life of the field.
		u.flowerTexA.uFlowerMask.value = opts.flowers.a[0];
		u.flowerTexA.uFlowerRGB.value = opts.flowers.a[1];
		u.flowerTexA.uFlowerGradient.value = opts.flowers.a[2];
		u.flowerTexB.uFlowerMask.value = opts.flowers.b[0];
		u.flowerTexB.uFlowerRGB.value = opts.flowers.b[1];
		u.flowerTexB.uFlowerGradient.value = opts.flowers.b[2];
		for (const im of scatterFlowers(sampler, {
			uniforms: u.flower,
			texA: u.flowerTexA,
			texB: u.flowerTexB,
			dirt: u.surface,
			density: opts.params.flDensity,
			maxCount: opts.params.flMaxCount,
			size: opts.params.flSize,
			mixA: opts.params.flMixA
		})) {
			if (opts.minY !== undefined) cullBelow(im, opts.minY);
			if (opts.mountMatrix) {
				const m = new Matrix4();
				for (let i = 0; i < im.count; i++) {
					im.getMatrixAt(i, m);
					m.premultiply(opts.mountMatrix);
					im.setMatrixAt(i, m);
				}
				im.instanceMatrix.needsUpdate = true;
			}
			owned.geometries.push(im.geometry);
			owned.materials.push(im.material as Material);
			if (im.customDepthMaterial) owned.materials.push(im.customDepthMaterial as Material);
			group.add(im);
		}
	}
	applyGrassParams(u, opts.params);

	return {
		object3D: group,
		uniforms: u,
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
			for (const g of owned.geometries) g.dispose();
			for (const m of owned.materials) m.dispose();
		}
	};
}
