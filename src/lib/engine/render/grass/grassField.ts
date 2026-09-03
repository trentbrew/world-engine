// Derived from stylized-components (MIT, © 2026 Christian Ortiz).
// Upstream: src/components/grassField/index.tsx @ c0c02c47971e70b214a25de01ac9633e7608fc84
// See ./VENDOR.md — upstream code, refactor deliberately.
//
// ─────────────────────────────────────────────────────────────────────────────
// The grass field, as a plain three.js object with an imperative lifecycle.
//
// Upstream this was an R3F component: a `useMemo` for the build, a `useFrame`
// for the uniforms, and leva for the params. Here the build is `createGrassField`
// / `rebuild`, the frame work is `update`, and params are ordinary data. The
// Threlte view (GrassFieldView.svelte) is a thin shell over this — the same
// split the engine already uses for SparkRendererHost / sparkRendererLifecycle.
//
// It turns a GLB into a stylized grass field by rewiring it by MESH / MATERIAL
// NAME, which is the whole integration contract:
//
//   groundMesh     the surface blades and flowers scatter onto, repainted with
//                  the grass colour + procedural dirt
//   rockMaterial   meshes that press the grass down around them (trampling)
//   trunkMaterial  meshes repainted with the bark texture set
//   leafMaterial   meshes whose photographic RGB is replaced (alpha kept)
//
// Anything unrecognised is left as authored, with an optional PBR override.
// ─────────────────────────────────────────────────────────────────────────────

import {
	Color,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Vector3,
	Vector4,
	type BufferGeometry,
	type DirectionalLight,
	type Material,
	type Object3D,
	type Texture
} from 'three';

import { createGrassFieldUniforms, type GrassFieldUniforms } from './uniforms';
import { MAX_ROCKS } from './shaders/grassBlade';
import { makeGroundMaterial } from './materials/groundMaterial';
import { makePineLeafMaterial, makePineLeafDepthMaterial } from './materials/pineLeafMaterial';
import { makeBarkMaterial } from './materials/barkMaterial';
import { scatterBlades, scatterFlowers } from './scatter';
import { applyGrassParams, tickGrassTime } from './applyParams';
import { GRASS_DEFAULTS, needsRebuild, type GrassParams } from './params';

/** Bark maps in this order: colour, ambient occlusion, height. */
export type BarkTextures = [Texture, Texture, Texture];
/** Flower maps per variant: mask, RGB zones, base→tip gradient. */
export type FlowerTextureSet = [Texture, Texture, Texture];

export type GrassFieldOptions = {
	/**
	 * The loaded GLB scene to dress. Loading is the caller's job — the Threlte
	 * view uses `useGltf`, which keeps this module free of any loader.
	 *
	 * OPTIONAL. With no model, the field builds its own flat ground plane of
	 * `groundSize` and scatters onto that. Blades and ground need no textures
	 * and no model, so a bare grass field is the zero-asset default; a GLB adds
	 * rocks, trunks and canopies on top.
	 */
	gltfScene?: Object3D;
	/** Side length of the built-in ground plane. Ignored when `gltfScene` is set. */
	groundSize?: number;
	/** Only needed to repaint trunk meshes — a model-less field never uses them. */
	bark?: BarkTextures;
	/** Both variants are required for flowers; without them flowers stay off. */
	flowerA?: FlowerTextureSet;
	flowerB?: FlowerTextureSet;
	params?: GrassParams;
	groundMesh?: string;
	rockMaterial?: string;
	trunkMaterial?: string;
	leafMaterial?: string;
	wireframe?: boolean;
	/** Called with a human-readable problem instead of writing to the console. */
	onWarn?: (message: string) => void;
};

export type GrassFieldHandle = {
	/** Mount this. Instances are in ITS local space — see the note in rebuild(). */
	object3D: Group;
	/** Live uniforms only. Cheap; safe to call on every param edit. */
	setParams(next: GrassParams): void;
	/** Respawns instance geometry. Only needed when a REBUILD_KEYS param moved. */
	rebuild(next: GrassParams): void;
	/** True if going from the current params to `next` would need a rebuild. */
	wouldRebuild(next: GrassParams): boolean;
	/**
	 * Per-frame. `sun` mirrors the scene's directional light into uSunDir/uSunColor
	 * for translucency — our injected GLSL cannot reach Lambert's own light
	 * uniforms. Pass null when there is no directional light.
	 */
	update(delta: number, sun: DirectionalLight | null): void;
	setWireframe(on: boolean): void;
	dispose(): void;
};

const DEFAULT_NAMES = {
	groundMesh: 'grass-floor',
	rockMaterial: 'RocksStylized_M',
	trunkMaterial: 'Material.011',
	// Blender exported the pine-needle material with a hash for a name.
	leafMaterial: '2237f4d60830642a24d65276e7abe1e6'
};

const sunPos = new Vector3();
const sunTarget = new Vector3();

export function createGrassField(opts: GrassFieldOptions): GrassFieldHandle {
	const {
		gltfScene,
		bark,
		flowerA,
		flowerB,
		groundMesh = DEFAULT_NAMES.groundMesh,
		rockMaterial = DEFAULT_NAMES.rockMaterial,
		trunkMaterial = DEFAULT_NAMES.trunkMaterial,
		leafMaterial = DEFAULT_NAMES.leafMaterial,
		onWarn = (m: string) => console.warn(m)
	} = opts;

	const u: GrassFieldUniforms = createGrassFieldUniforms();

	// Textures are bound once — they never change for the life of the field.
	if (bark) {
		const [barkColor, barkAO, barkHeight] = bark;
		u.bark.uBarkColorMap.value = barkColor;
		u.bark.uBarkAOMap.value = barkAO;
		u.bark.uBarkHeightMap.value = barkHeight;
	}
	/** Flowers sample three maps per variant; without them the shader has nothing. */
	const hasFlowerTextures = Boolean(flowerA && flowerB);
	if (flowerA && flowerB) {
		u.flowerTexA.uFlowerMask.value = flowerA[0];
		u.flowerTexA.uFlowerRGB.value = flowerA[1];
		u.flowerTexA.uFlowerGradient.value = flowerA[2];
		u.flowerTexB.uFlowerMask.value = flowerB[0];
		u.flowerTexB.uFlowerRGB.value = flowerB[1];
		u.flowerTexB.uFlowerGradient.value = flowerB[2];
	}

	/** The mount point. Never transformed here — the entity's Transform owns that. */
	const object3D = new Group();
	object3D.name = 'GrassField';

	let params: GrassParams = opts.params ?? { ...GRASS_DEFAULTS };
	let wireframe = opts.wireframe ?? false;
	let pbrMaterials: MeshStandardMaterial[] = [];
	let built: Object3D | null = null;
	/** Everything this module created and must therefore free. */
	let owned: { geometries: BufferGeometry[]; materials: Material[] } = {
		geometries: [],
		materials: []
	};

	function disposeBuilt() {
		if (!built) return;
		object3D.remove(built);
		for (const g of owned.geometries) g.dispose();
		for (const m of owned.materials) m.dispose();
		owned = { geometries: [], materials: [] };
		pbrMaterials = [];
		built = null;
	}

	/**
	 * The zero-asset path: a flat plane to scatter onto, standing in for the
	 * GLB's ground mesh. Rotated −90° on X so it lies in the XZ play plane, and
	 * segmented so the area-weighted sampler has more than two triangles to
	 * distribute across.
	 */
	function makeGroundPlane(size: number): Mesh {
		const geo = new PlaneGeometry(size, size, 8, 8);
		geo.rotateX(-Math.PI / 2);
		const mesh = new Mesh(geo, new MeshStandardMaterial());
		mesh.name = groundMesh;
		owned.geometries.push(geo);
		return mesh;
	}

	function build(p: GrassParams) {
		const clone = gltfScene ? gltfScene.clone(true) : new Group();
		if (!gltfScene) clone.add(makeGroundPlane(opts.groundSize ?? 20));

		// INVARIANT: the clone must still be DETACHED here.
		//
		// scatterBlades bakes mesh.matrixWorld into each instance matrix. With the
		// clone unparented, its world matrix is identity, so those matrices come
		// out in clone-LOCAL space — which is what makes it safe to parent the
		// result under an entity's transform afterwards. Scatter it while already
		// mounted under a moved transform and every blade is transformed twice.
		clone.updateMatrixWorld(true);

		const rocks: Vector4[] = [];
		let ground: Mesh | null = null;

		clone.traverse((child) => {
			const mesh = child as Mesh;
			if (!mesh.isMesh) return;
			mesh.castShadow = true;
			mesh.receiveShadow = true;

			if (mesh.name === groundMesh) {
				ground = mesh;
				return;
			}

			const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

			// Rocks reach the blade shader as bounding spheres — all it needs to
			// press the grass down around them.
			if (src.some((m) => m.name === rockMaterial)) {
				if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
				const bs = mesh.geometry.boundingSphere!;
				const center = bs.center.clone().applyMatrix4(mesh.matrixWorld);
				// The world matrix may scale non-uniformly; take the largest axis so
				// the influence disc never comes out smaller than the rock.
				const s = new Vector3().setFromMatrixScale(mesh.matrixWorld);
				const radius = bs.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
				rocks.push(new Vector4(center.x, center.y, center.z, radius));
			}

			const swapped = src.map((m) => {
				if (m.name === leafMaterial) {
					const std = m as MeshStandardMaterial;
					// Static shadow (no wind): a swaying canopy's moving shadow edge
					// flickers on the grass, and its sway is invisible in a soft high
					// blob anyway.
					mesh.customDepthMaterial = makePineLeafDepthMaterial(std);
					owned.materials.push(mesh.customDepthMaterial);
					const leaf = makePineLeafMaterial(std, mesh, u.surface);
					owned.materials.push(leaf);
					return leaf;
				}
				// Without the three bark maps the material would sample null
				// textures, so leave the GLB's authored bark alone instead.
				if (m.name === trunkMaterial && bark) {
					const barkMat = makeBarkMaterial(u.bark);
					owned.materials.push(barkMat);
					return barkMat;
				}
				// Untouched GLB material — cloned so the PBR override below doesn't
				// mutate the material cached by the loader and shared with any other
				// user of this GLB.
				const c = (m as MeshStandardMaterial).clone();
				owned.materials.push(c);
				pbrMaterials.push(c);
				return c;
			});
			mesh.material = Array.isArray(mesh.material) ? swapped : swapped[0];
		});

		// Publish the rocks into the shader's fixed-size uniform array.
		const slots = u.surface.uRocks.value;
		const n = Math.min(rocks.length, MAX_ROCKS);
		for (let i = 0; i < n; i++) slots[i].copy(rocks[i]);
		u.surface.uRockCount.value = n;
		if (rocks.length > MAX_ROCKS) {
			onWarn(
				`[GrassField] ${rocks.length} rocks found but the shader's uniform array holds ${MAX_ROCKS} — the rest won't flatten grass.`
			);
		}

		if (!ground) {
			onWarn(`[GrassField] mesh "${groundMesh}" not found in the model — no grass spawned.`);
			object3D.add(clone);
			built = clone;
			return;
		}

		const groundMeshRef = ground as Mesh;
		const srcMat = (
			Array.isArray(groundMeshRef.material) ? groundMeshRef.material[0] : groundMeshRef.material
		) as MeshStandardMaterial;
		const groundMat = makeGroundMaterial(u.surface, srcMat.color as Color);
		owned.materials.push(groundMat);
		groundMeshRef.material = groundMat;

		const blades = scatterBlades(groundMeshRef, {
			uniforms: u.surface,
			density: p.grDensity,
			maxCount: p.grMaxCount,
			minWidth: p.grMinWidth,
			maxWidth: p.grMaxWidth,
			minLength: p.grMinLength,
			maxLength: p.grMaxLength,
			tiltMax: p.grTiltMax,
			segments: p.grSegments
		});
		owned.geometries.push(blades.geometry);
		owned.materials.push(blades.material as Material);
		clone.add(blades);

		if (p.flEnabled && hasFlowerTextures) {
			for (const im of scatterFlowers(groundMeshRef, {
				uniforms: u.flower,
				texA: u.flowerTexA,
				texB: u.flowerTexB,
				dirt: u.surface,
				density: p.flDensity,
				maxCount: p.flMaxCount,
				size: p.flSize,
				mixA: p.flMixA
			})) {
				owned.geometries.push(im.geometry);
				owned.materials.push(im.material as Material);
				clone.add(im);
			}
		}

		object3D.add(clone);
		built = clone;
	}

	function applyPbrOverride(p: GrassParams) {
		for (const m of pbrMaterials) {
			if (p.matOverride) {
				m.roughness = p.roughness;
				m.metalness = p.metalness;
				m.envMapIntensity = p.envIntensity;
			}
			m.flatShading = p.matOverride && p.flatShading;
			m.needsUpdate = true;
		}
	}

	function applyWireframe(on: boolean) {
		if (!built) return;
		built.traverse((child) => {
			const mesh = child as Mesh;
			if (!mesh.isMesh) return;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const m of mats) (m as MeshStandardMaterial).wireframe = on;
		});
	}

	build(params);
	applyGrassParams(u, params);
	applyPbrOverride(params);
	applyWireframe(wireframe);

	return {
		object3D,

		setParams(next: GrassParams) {
			params = next;
			applyGrassParams(u, next);
			applyPbrOverride(next);
			applyWireframe(wireframe);
		},

		wouldRebuild(next: GrassParams) {
			return needsRebuild(params, next);
		},

		rebuild(next: GrassParams) {
			disposeBuilt();
			params = next;
			build(next);
			applyGrassParams(u, next);
			applyPbrOverride(next);
			applyWireframe(wireframe);
		},

		update(delta: number, sun: DirectionalLight | null) {
			tickGrassTime(u, delta);
			if (!sun) return;
			// Resolved from the caller each frame rather than cached: this engine
			// can add, remove and swap Light entities at runtime, and a room switch
			// replaces them wholesale. Upstream cached the first directional light
			// it ever saw, which would go stale here.
			sun.getWorldPosition(sunPos);
			sun.target.getWorldPosition(sunTarget);
			u.surface.uSunDir.value.subVectors(sunPos, sunTarget).normalize();
			u.surface.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
		},

		setWireframe(on: boolean) {
			wireframe = on;
			applyWireframe(on);
		},

		dispose() {
			disposeBuilt();
		}
	};
}
