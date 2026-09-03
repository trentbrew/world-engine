/**
 * Smoke: editor / agent spawns are durable, not owner-scoped runtime spawns.
 *
 * Regression guard for imported models (e.g. Sketchfab props) vanishing for
 * peers. A spawn must broadcast a durable `setEntity` carrying its position —
 * NOT `runtimeNet.onSpawn`, which is owner-scoped and despawns on every peer
 * when the author disconnects. Deleting one must broadcast `removeEntity`.
 *
 * Run: pnpm test:durable-spawn
 */
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import { patchKind } from '$lib/engine/ontology/durablePatch';
import { world } from '$lib/engine/runtime/world.svelte';

const { loadOntology } = await import('$lib/engine/ontology/loadOntology');
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');

const doc = JSON.parse(readFileSync(resolve(process.cwd(), 'static/games/orbit.jsonld'), 'utf8'));
const entities = await loadOntology(() => Promise.resolve(doc));
const { worldProfile } = await import('$lib/engine/world/worldProfile.svelte');
worldProfile.hydrate(entities);
world.setReady(entities, { skipAutoSelect: true });

const broadcasts: DurablePatch[] = [];
const runtimeSpawns: string[] = [];
const runtimeDespawns: string[] = [];

world.bindDurableNet({
	canWrite: () => true,
	broadcast: (patch) => void broadcasts.push(patch),
	broadcastAuthoring: () => {}
});
world.bindRuntimeNet({
	onSpawn: (entity) => void runtimeSpawns.push(entity.id),
	onDespawn: (id) => {
		runtimeDespawns.push(id);
		world.despawn(id);
	}
});

let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
	if (cond) {
		console.log(`  ✓ ${name}`);
	} else {
		failed++;
		console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
	}
}

const MESH = '/models/low-poly-tree-scene-free.glb';
const POSITION: [number, number, number] = [2.5, 0, -1.5];

// ---- spawn --------------------------------------------------------------
const prop = world.createProp({ mesh: MESH, position: POSITION });
check('createProp returns an entity', !!prop);
if (!prop) process.exit(1);

const spawnPatch = broadcasts.find(
	(p) => patchKind(p) === 'setEntity' && 'entityId' in p && p.entityId === prop.id
);
check('spawn broadcasts a durable setEntity', !!spawnPatch);
check(
	'spawn does NOT use the owner-scoped runtime path',
	runtimeSpawns.length === 0,
	`onSpawn fired for ${runtimeSpawns.join(', ')}`
);

// Transform.position is sync:'realtime', so a durable-only filter would drop
// it and every peer would render the prop at the origin.
const spawned = spawnPatch && 'components' in spawnPatch ? spawnPatch.components : undefined;
const pos = spawned?.Transform?.position as number[] | undefined;
check(
	'setEntity carries Transform.position',
	JSON.stringify(pos) === JSON.stringify(POSITION),
	`got ${JSON.stringify(pos)}`
);
check(
	'setEntity carries Render.mesh',
	(spawned?.Render as Record<string, unknown> | undefined)?.mesh === MESH,
	`got ${JSON.stringify(spawned?.Render)}`
);

// ---- delete -------------------------------------------------------------
broadcasts.length = 0;
world.select(prop.id);
const deleted = world.deleteSelection();
check('deleteSelection succeeds', deleted);
check(
	'delete broadcasts a durable removeEntity',
	broadcasts.some((p) => patchKind(p) === 'removeEntity' && 'entityId' in p && p.entityId === prop.id)
);
check(
	'delete does NOT use the owner-scoped runtime path',
	runtimeDespawns.length === 0,
	`onDespawn fired for ${runtimeDespawns.join(', ')}`
);
check('entity is gone from the world', !world.getEntity(prop.id));

// ---- gameplay spawns stay runtime-scoped --------------------------------
broadcasts.length = 0;
runtimeSpawns.length = 0;
world.spawnRuntime({
	id: 'entity:prop/runtime-pickup',
	type: 'Prop',
	components: { Transform: { position: [0, 1, 0] }, Render: { mesh: 'primitive:box' } },
	raw: {}
});
check(
	'spawnRuntime still uses the runtime path',
	runtimeSpawns.includes('entity:prop/runtime-pickup')
);
check('spawnRuntime does not write the durable graph', broadcasts.length === 0);

console.log(
	failed === 0
		? '\ndurable-spawn-smoke: PASS — spawn/delete replicate durably; gameplay spawns stay runtime'
		: `\ndurable-spawn-smoke: FAIL — ${failed} check(s)`
);
process.exit(failed === 0 ? 0 : 1);
