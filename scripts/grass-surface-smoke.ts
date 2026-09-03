/**
 * Locks cross-entity grass scatter (TRL-253).
 *
 * The risk this guards: a GrassField naming another entity's mesh must land
 * blades ON that foreign surface — under ANY pair of entity transforms — and
 * must never crash, repaint, or remount what it doesn't own. Covers:
 *  1. registry round-trip (publish → resolve → revision bump on republish →
 *     unpublish removes; stale cleanup never drops a replacement; missing id
 *     resolves null),
 *  2. blade placement: scatter onto a displaced foreign plane mounted under a
 *     non-identity transform, with the consumer under a DIFFERENT non-identity
 *     transform; raycast straight down in world space and assert each blade
 *     base matches the foreign surface.
 *
 * No browser needed. Run: pnpm exec tsx --tsconfig .svelte-kit/tsconfig.json scripts/grass-surface-smoke.ts
 */
import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Raycaster, Vector3 } from 'three';
import { createTerrainGrass } from '$lib/engine/render/grass/terrainGrass';
import {
	publishScatterSurface,
	resolveScatterSurface,
	scatterSurfaceRevision,
	unpublishScatterSurface
} from '$lib/engine/render/grass/surfaceRegistry';
import { coerceGrassParams, resolveGrassParams } from '$lib/engine/render/grass/params';

function fail(message: string): never {
	console.error(`FAIL: ${message}`);
	process.exit(1);
}

function ok(cond: boolean, message: string): void {
	if (!cond) fail(message);
	console.log(`ok: ${message}`);
}

// --- 1. registry contract -----------------------------------------------
const foreignGeo = new PlaneGeometry(20, 20, 16, 16);
foreignGeo.rotateX(-Math.PI / 2);
{
	const posAttr = foreignGeo.attributes.position as import('three').BufferAttribute;
	for (let i = 0; i < posAttr.count; i++) {
		const x = posAttr.getX(i);
		const z = posAttr.getZ(i);
		posAttr.setY(i, 2 * Math.sin(x * 0.4) * Math.cos(z * 0.4));
	}
	foreignGeo.computeVertexNormals();
}
const foreignMesh = new Mesh(foreignGeo, new MeshStandardMaterial());

ok(resolveScatterSurface('nope') === null, 'missing id resolves null');
ok(scatterSurfaceRevision('nope') === 0, 'missing id revision is 0');

let unpublish = publishScatterSurface('test-surface', foreignMesh);
ok(resolveScatterSurface('test-surface') === foreignMesh, 'publish → resolve returns mesh');
ok(scatterSurfaceRevision('test-surface') === 1, 'first publish revision is 1');

const replacement = new Mesh(foreignGeo, new MeshStandardMaterial());
publishScatterSurface('test-surface', replacement);
ok(scatterSurfaceRevision('test-surface') === 2, 'republish bumps revision');
// Republishing the SAME mesh is a silent no-op (no revision bump): callers
// publish from inside `$effect`, and an unconditional write would
// resubscribe-and-refire forever (`effect_update_depth_exceeded`).
publishScatterSurface('test-surface', replacement);
ok(scatterSurfaceRevision('test-surface') === 2, 'same-mesh republish keeps revision stable');
// Stale cleanup from the replaced mesh must not drop the replacement.
unpublish();
ok(resolveScatterSurface('test-surface') === replacement, 'stale unpublish keeps replacement');
unpublishScatterSurface('test-surface', replacement);
ok(resolveScatterSurface('test-surface') === null, 'unpublish removes entry');

// --- 2. cross-transform blade placement ----------------------------------
// Foreign surface lives under a rotated + translated group; the consumer
// lives under a different translated group. Blades must still sit on the
// foreign surface in world space.
const surfaceGroup = new Group();
surfaceGroup.position.set(5, 1, -3);
surfaceGroup.rotation.y = 0.5;
surfaceGroup.add(foreignMesh);

const consumerPos = new Vector3(-2, 0.5, 4);
const consumerWorld = new Matrix4().compose(consumerPos, new Quaternion(), new Vector3(1, 1, 1));

const scene = new Group();
scene.add(surfaceGroup);
scene.updateMatrixWorld(true);

const surfaceWorld = foreignMesh.matrixWorld.clone();
const mountMatrix = consumerWorld.clone().invert().multiply(surfaceWorld);

const grassParams = resolveGrassParams('default', {
	...coerceGrassParams({
		density: 60,
		maxCount: 3000,
		bladeMinLength: 0.5,
		bladeMaxLength: 1.2,
		grTiltMax: 0.15
	})
});
const grass = createTerrainGrass(foreignMesh, { params: grassParams, mountMatrix });

const raycaster = new Raycaster();
const down = new Vector3(0, -1, 0);
const m = new Matrix4();
const local = new Vector3();
const worldPos = new Vector3();

const blades = grass.object3D.children.find(
	(c): c is InstancedMesh => (c as InstancedMesh).isInstancedMesh === true
);
if (!blades) fail('no InstancedMesh in scattered grass group');
if (blades.count < 100) fail(`expected a field of blades, got count=${blades.count}`);

const total = blades.count;
const sample = Math.min(250, total);
const EPS = 0.05;

let checked = 0;
let within = 0;
let maxDelta = 0;

for (let i = 0; i < sample; i++) {
	blades.getMatrixAt(i, m);
	local.setFromMatrixPosition(m);
	// Blades are baked consumer-local; lift to world through the consumer.
	worldPos.copy(local).applyMatrix4(consumerWorld);
	raycaster.set(new Vector3(worldPos.x, 100, worldPos.z), down);
	const hit = raycaster.intersectObject(foreignMesh, false)[0];
	if (!hit) continue;
	checked++;
	const delta = Math.abs(worldPos.y - hit.point.y);
	maxDelta = Math.max(maxDelta, delta);
	if (delta < EPS) within++;
}

console.log(`grass-surface: ${checked}/${sample} blades hit foreign surface (max Δ=${maxDelta.toFixed(4)})`);
if (checked < sample * 0.9) fail('too few blade instances landed on the foreign surface');
if (within / checked < 0.95) fail(`blades not aligned to foreign heightmap (${within}/${checked} within ${EPS})`);

grass.dispose();
foreignGeo.dispose();
console.log('grass-surface OK');
process.exit(0);
