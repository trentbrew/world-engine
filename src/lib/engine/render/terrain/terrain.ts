// Stylized terrain — a displaced, vertex-colored ground surface with a seeded
// procedural heightmap.
//
// Homegrown (not vendored): unlike the grass/sky/water cores, this has no
// upstream source. It exists because the engine had no terrain-height system —
// `Ground` is a flat PlaneGeometry, and "infinite water at sea level" is
// meaningless without hills. This is that gap, closed.
//
// ─────────────────────────────────────────────────────────────────────────────
// Why trimesh, not Rapier heightfield:
//
//   Rapier's `heightfield` collider takes a column-major heights matrix with
//   its own local-axis convention. If the mesh and the collider disagree about
//   row/column order or orientation, the player sinks or floats silently — the
//   worst kind of bug: it renders fine and is invisible in a screenshot.
//
//   We already build the mesh, so we can sample the EXACT same vertices and hand
//   them to `ColliderDesc.trimesh`. Visual and physical terrain are then
//   guaranteed identical. (The AGENTS.md caveat — trimesh is "rejected on
//   dynamic bodies" — does not apply: terrain is a fixed body.)
// ─────────────────────────────────────────────────────────────────────────────

import {
	BufferAttribute,
	BufferGeometry,
	Color,
	DoubleSide,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	type IUniform
} from 'three';
import { GROUND_MASK_GLSL, GROUND_MASK_UNIFORMS } from '$lib/engine/render/grass/shaders/groundMask';

/** Seeded LCG — same seed always yields the same layout (see grass scatter). */
function seededLcg(seed: number) {
	let s = (seed * 1664525 + 1013904223) >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

/**
 * 2D value noise with smooth (smoothstep) interpolation. Deterministic:
 * a pure function of x and y plus an offset derived from the seed, so two
 * clients built from the same seed agree exactly.
 */
function makeValueNoise(seed: number) {
	const perm = new Uint8Array(512);
	const rng = seededLcg(Math.abs(Math.round(seed)) || 1);
	const p = new Uint8Array(256);
	for (let i = 0; i < 256; i++) p[i] = i;
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const t = p[i];
		p[i] = p[j];
		p[j] = t;
	}
	for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

	const hash = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255;

	const smooth = (t: number) => t * t * (3 - 2 * t);

	return {
		/** value in [0,1]. */
		noise(x: number, y: number): number {
			const xi = Math.floor(x);
			const yi = Math.floor(y);
			const xf = x - xi;
			const yf = y - yi;
			const a = hash(xi, yi);
			const b = hash(xi + 1, yi);
			const c = hash(xi, yi + 1);
			const d = hash(xi + 1, yi + 1);
			const u = smooth(xf);
			const v = smooth(yf);
			return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
		}
	};
}

export type TerrainParams = {
	/** Side length, world units. */
	size: number;
	/** Grid resolution per axis (segments → size+1 vertices). */
	segments: number;
	/** Vertical amplitude of the largest hill. */
	heightScale: number;
	/** Baseline the surface averages around. */
	baseHeight: number;
	/** Horizontal frequency of the hills — smaller = smoother, larger = rugged. */
	noiseScale: number;
	/** fBm octaves. 1 = single band of hills; 4-5 = rolling + detail. */
	octaves: number;
	/** RNG seed — the whole world's layout is deterministic from this. */
	seed: number;
	/** Base surface color (splatted by height). */
	color: string;
	/** Color at the low end of the height range. */
	colorLow: string;
	/** Color at the high end of the height range. */
	colorHigh: string;
	/** Vertical range over which colorLow→colorHigh ramps (world units). */
	colorRange: number;
	/**
	 * Sink the rim toward `seabedY` so the plane reads as an island in an open
	 * ocean rather than a square slab. Off by default — a terrain with no water
	 * around it wants its full extent.
	 */
	island: boolean;
	/** Radius (fraction of half-size) inside which the heightmap is untouched. */
	islandInner: number;
	/** Radius (fraction of half-size) by which the surface has reached `seabedY`. */
	islandOuter: number;
	/** Terrain-local Y the rim falls away to. Put it under the water plane. */
	seabedY: number;
	/**
	 * Tint vertices below `waterY` toward `underwaterColor`, so a rim that sinks
	 * under the water plane reads as submerged rather than as a bright green
	 * shelf seen through blue.
	 *
	 * NOTE: this was previously spelled `infinite`, which also translated the
	 * mesh to the camera every frame. That never worked — see the comment on
	 * `createTerrain` — so the name now describes the half that does. Legacy
	 * `infinite: true` is still accepted as an alias below.
	 */
	underwaterTint: boolean;
	/** World Y of the water surface. */
	waterY: number;
	/** Tint applied to terrain vertices below waterY. */
	underwaterColor: string;
};

export const TERRAIN_DEFAULTS: TerrainParams = {
	size: 60,
	segments: 128,
	heightScale: 4,
	baseHeight: 0,
	noiseScale: 0.05,
	octaves: 4,
	seed: 1337,
	color: '#5a7a3a',
	colorLow: '#3f6a34',
	colorHigh: '#8a9a54',
	colorRange: 6,
	island: false,
	islandInner: 0.55,
	islandOuter: 0.92,
	seabedY: -4,
	underwaterTint: false,
	waterY: 0,
	underwaterColor: '#1a5276'
};

export type TerrainOptions = {
	params?: Partial<TerrainParams>;
};

export type TerrainHandle = {
	object3D: Mesh;
	setParams(next: Partial<TerrainParams>): void;
	dispose(): void;
};

/**
 * Radial island falloff, as a 0..1 multiplier on height above the seabed.
 *
 * `d` is the distance from the terrain's center normalised by its half-size, so
 * the midpoint of each side sits at 1.0 and the corners reach ~1.41. Corners
 * therefore sink first, which is what rounds a square plane into an island.
 *
 * Past `islandOuter` the result is flat seabed, so the mesh's own square edge is
 * always submerged and hidden under the water surface — the alternative is a
 * visible geometric cliff at the world boundary.
 */
function islandMask(
	nx: number,
	nz: number,
	half: number,
	inner: number,
	outer: number
): number {
	if (half <= 0 || outer <= inner) return 1;
	const d = Math.hypot(nx, nz) / half;
	if (d <= inner) return 1;
	if (d >= outer) return 0;
	const t = (d - inner) / (outer - inner);
	return 1 - t * t * (3 - 2 * t); // smoothstep, so the shoreline has no crease
}

/**
 * Build a displaced terrain mesh from a seeded heightmap, and the identical
 * triangles for the physics collider.
 *
 * The mesh is a `PlaneGeometry` rotated into the XZ play plane (as grass's
 * ground plane), with each vertex's Y displaced by the fBm height and a
 * per-vertex color ramping across `colorLow→colorHigh`.
 */
export function createTerrain(opts: TerrainOptions = {}): TerrainHandle {
	const authored = opts.params ?? {};
	const p: TerrainParams = { ...TERRAIN_DEFAULTS, ...authored };

	// Legacy alias. `infinite` used to mean "follow the camera in XZ AND tint
	// below the waterline". The follow half was never sound: heights are baked
	// in LOCAL space (see the sampling loop below), so translating the mesh
	// drags the whole landscape along with the viewer — hills slide underfoot,
	// world-fixed grass detaches from the ground it was scattered on, and the
	// trimesh collider (snapshotted at build time by AutoColliders) stays
	// behind, so play mode walks on terrain that is no longer where it looks.
	// Genuine endless terrain needs cell-snapped chunks re-sampled at a world
	// offset, not one sliding plane. Until that exists, only the tint survives.
	if (authored.underwaterTint === undefined && (authored as { infinite?: boolean }).infinite) {
		p.underwaterTint = true;
	}

	const vertices = p.segments + 1;
	const total = vertices * vertices;
	const heights = new Float32Array(total);

	const noise = makeValueNoise(p.seed);

	// Sample heights: world XZ → [0,1]+ ampltude, centered on baseHeight.
	const half = p.size / 2;
	for (let iy = 0; iy < vertices; iy++) {
		for (let ix = 0; ix < vertices; ix++) {
			const nx = (ix / p.segments - 0.5) * p.size;
			const nz = (iy / p.segments - 0.5) * p.size;
			let amp = 0;
			let freq = p.noiseScale;
			let totalAmp = 0;
			let maxAmp = 0;
			for (let o = 0; o < p.octaves; o++) {
				const w = noise.noise(nx * freq + o * 13.7, nz * freq + o * 7.3);
				const contribution = w * Math.pow(0.55, o);
				amp += contribution;
				totalAmp += Math.pow(0.55, o);
				maxAmp = Math.max(maxAmp, contribution);
				freq *= 2.2;
			}
			const normalized = totalAmp > 0 ? amp / totalAmp : 0;
			// Center the noise around 0.5 so the surface straddles baseHeight.
			const centered = normalized - 0.5;
			const h = p.baseHeight + centered * 2 * p.heightScale * maxAmp;
			// The falloff multiplies height ABOVE the seabed, so the hills keep their
			// shape near the middle and only the rim is pulled under.
			const mask = p.island ? islandMask(nx, nz, half, p.islandInner, p.islandOuter) : 1;
			heights[iy * vertices + ix] = p.island ? p.seabedY + (h - p.seabedY) * mask : h;
		}
	}

	// Build the displaced mesh from a canonical PlaneGeometry, re-using its
	// index/grid so vertex positions stay in the same order.
	const geo = new PlaneGeometry(p.size, p.size, p.segments, p.segments);
	geo.rotateX(-Math.PI / 2);
	const pos = geo.attributes.position as BufferAttribute;

	const colLow = new Color(p.colorLow);
	const colHigh = new Color(p.colorHigh);
	const colBase = new Color(p.color);
	const colors = new Float32Array(total * 3);

	for (let i = 0; i < total; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		// Vertices from PlaneGeometry are ordered row-major over (x, z), which
		// matches the height sampling order computed above (ix = x, iy = z).
		const ix = Math.round((x / p.size + 0.5) * p.segments);
		const iy = Math.round((z / p.size + 0.5) * p.segments);
		const h = heights[iy * vertices + ix];
		pos.setY(i, h);

		// Height ramp: below the midpoint → colorLow, above → colorHigh, with a
		// neutral valley color blend so flat lowlands read as the base color.
		const t = Math.max(0, Math.min(1, (h - (p.baseHeight - p.colorRange / 2)) / p.colorRange));
		const c = colBase.clone().lerp(colLow, Math.max(0, 1 - t * 2)).lerp(colHigh, Math.max(0, t * 2 - 1));
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
	}

	geo.setAttribute('color', new BufferAttribute(colors, 3));
	geo.computeVertexNormals();

	const material = new MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.95,
		metalness: 0,
		side: DoubleSide
	});

	const object3D = new Mesh(geo, material);
	object3D.name = 'Terrain';
	object3D.receiveShadow = true;
	object3D.castShadow = true;

	// Underwater tinting: vertices below waterY are tinted underwaterColor.
	// Gated by uUnderwater so untinted terrain is unaffected.
	const underwaterUniforms = p.underwaterTint ? {
		uWaterY: { value: p.waterY },
		uUnderwaterColor: { value: new Color(p.underwaterColor) },
		uUnderwater: { value: 1 }
	} : null;

	if (p.underwaterTint) {
		material.onBeforeCompile = (shader) => {
			if (underwaterUniforms) {
				Object.assign(shader.uniforms, underwaterUniforms);
			}
			shader.vertexShader =
				'varying vec3 vWorldPos;\n' + shader.vertexShader;
			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>
				vWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`
			);

			shader.fragmentShader =
				'varying vec3 vWorldPos;\nuniform float uWaterY;\nuniform vec3 uUnderwaterColor;\nuniform int uUnderwater;\n' + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
				if ( uUnderwater > 0 && vWorldPos.y < uWaterY ) {
					diffuseColor.rgb = mix( diffuseColor.rgb, uUnderwaterColor, 0.7 );
				}`
			);
		};
		material.needsUpdate = true;
	}

	// The collider is derived from this mesh's geometry by the view's
	// AutoColliders@{shape:'trimesh'}, so it uses these exact displaced vertices
	// and indices — visual and physical terrain can never drift apart.

	function apply(next: Partial<TerrainParams>) {
		Object.assign(p, next);
		// Heights are baked into geometry, so structural param changes need a
		// rebuild — the view's $effect tears this down and re-creates it via
		// createTerrain on any change. `setParams` is kept on the handle for
		// symmetry with the other cores.
	}

	return {
		object3D,
		setParams: apply,
		dispose() {
			geo.dispose();
			material.dispose();
		}
	};
}

/**
 * Blend the grass-field ground treatment onto the terrain material WITHOUT
 * replacing the terrain's vertex-color elevation ramp.
 *
 * The terrain surface stays its authored `colorLow→colorHigh` gradient; this
 * patch overlays meadow's procedural dirt (`groundDirt`, world-XZ so it drapes
 * over the heightmap) plus a light lush↔dry patch tint, gated by a
 * `uGrassEnabled` uniform so toggling `Terrain.grass` never swaps materials.
 *
 * `surfaceUniforms` is the grass `createGrassFieldUniforms().surface` object —
 * the SAME uniforms driving the terrain's blades — so dirt agrees with blade
 * thinning. Idempotent (patches once). Returns a setter for the enable uniform.
 */
export function applyTerrainGroundDirt(
	material: MeshStandardMaterial,
	surfaceUniforms: Record<string, IUniform>,
	enabled: number
): { setEnabled: (v: number) => void } {
	// The shader's enable uniform is stored ONCE on the material; every setter
	// (including the idempotent re-apply path) mutates the SAME object, so live
	// toggle-off→on keeps driving the real shader uniform.
	const setEnabled = (v: number) => {
		(material.userData.grassDirt as { value: number }).value = v;
		material.userData.grassDirtSet = v;
	};

	if (material.userData.grassDirtApplied) {
		return { setEnabled };
	}

	const grassEnabled = { value: enabled };
	material.userData.grassDirt = grassEnabled;
	material.userData.grassDirtApplied = true;
	material.userData.grassDirtSet = enabled;

	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, surfaceUniforms);
		shader.uniforms.uGrassEnabled = grassEnabled;

		// Vertex: carry world XZ so the mask is world-anchored (drapes over hills).
		shader.vertexShader =
			'varying vec2 vGndXZ;\n' + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace(
			'#include <begin_vertex>',
			`#include <begin_vertex>
			vGndXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;`
		);

		// Fragment: dirt mask + a gentle lush/dry tint over the vertex-color ramp.
		shader.fragmentShader =
			`varying vec2 vGndXZ;
			uniform float uGrassEnabled;
			uniform float uPatchScale;
			uniform float uPatchBias;
			uniform vec3  uPatchLush;
			uniform vec3  uPatchDry;
			uniform float uPatchStrength;
			uniform float uBrightness;\n` +
			GROUND_MASK_UNIFORMS +
			GROUND_MASK_GLSL +
			shader.fragmentShader;
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <color_fragment>',
			`#include <color_fragment>
			if ( uGrassEnabled > 0.5 ) {
				float _pt = pow( clamp( _gmFbm( vGndXZ * uPatchScale ), 0.0, 1.0 ), uPatchBias );
				vec3 _tint = mix( diffuseColor.rgb, mix( uPatchLush, uPatchDry, _pt ), uPatchStrength );
				float _dirt = groundDirt( vGndXZ );
				diffuseColor.rgb = mix( _tint, uDirtColor * uBrightness, _dirt );
			}`
		);
	};
	material.needsUpdate = true;

	return { setEnabled };
}
