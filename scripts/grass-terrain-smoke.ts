/**
 * Locks Terrain-owned grass to the terrain heightmap.
 *
 * The risk this guards: blades must sit ON the terrain surface, not a flat
 * plane. createTerrainGrass scatters blades onto a detached sampler sharing the
 * terrain geometry, so every blade base lands at the interpolated surface Y.
 * Sample a subset of blade instances, raycast straight down at each XZ against
 * the terrain mesh, and assert the blade base height matches the surface.
 *
 * No browser needed. Run: pnpm exec tsx --tsconfig .svelte-kit/tsconfig.json scripts/grass-terrain-smoke.ts
 */
import { Matrix4, Raycaster, Vector3 } from 'three';
import { createTerrain, type TerrainParams } from '$lib/engine/render/terrain/terrain';
import { createTerrainGrass } from '$lib/engine/render/grass/terrainGrass';
import { coerceGrassParams, resolveGrassParams } from '$lib/engine/render/grass/params';

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}

const terrainParams: TerrainParams = {
	size: 20,
	segments: 32,
	heightScale: 4,
	baseHeight: 0,
	noiseScale: 0.06,
	octaves: 3,
	seed: 42
};
const terrain = createTerrain({ params: terrainParams });
// Deterministic layout requires the mesh's world matrix resolved.
terrain.object3D.updateMatrixWorld(true);

const grassParams = resolveGrassParams('default', {
	...coerceGrassParams({
		density: 60,
		maxCount: 3000,
		bladeMinLength: 0.5,
		bladeMaxLength: 1.2,
		grTiltMax: 0.15
	})
});
const grass = createTerrainGrass(terrain.object3D, { params: grassParams });

// Blades are flat strips pivoting at the base (y = 0). The instance matrix
// translation is the sample point p on the surface, so pos.y IS the surface Y.
const raycaster = new Raycaster();
const down = new Vector3(0, -1, 0);
const m = new Matrix4();
const p = new Vector3();

const total = grass.object3D.count;
const sample = Math.min(250, total);
const EPS = 0.05;

let checked = 0;
let within = 0;
let maxDelta = 0;

for (let i = 0; i < sample; i++) {
	grass.object3D.getMatrixAt(i, m);
	p.setFromMatrixPosition(m);
	raycaster.set(new Vector3(p.x, 100, p.z), down);
	const hit = raycaster.intersectObject(terrain.object3D, false)[0];
	if (!hit) continue;
	checked++;
	const delta = Math.abs(p.y - hit.point.y);
	maxDelta = Math.max(maxDelta, delta);
	if (delta < EPS) within++;
}

console.log(`grass-terrain: ${checked}/${sample} blades hit terrain (max Δ=${maxDelta.toFixed(4)})`);
if (checked < sample * 0.9) fail('too few blade instances landed on the terrain surface');
if (within / checked < 0.95) fail(`blades not aligned to heightmap (${within}/${checked} within ${EPS})`);

grass.dispose();
terrain.dispose();
console.log('grass-terrain OK');
process.exit(0);
