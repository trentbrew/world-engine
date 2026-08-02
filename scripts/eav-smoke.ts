/**
 * Belt-and-suspenders: MemoryTrellis → trellisSource → loadOntology end-to-end.
 * Run: pnpm exec tsx scripts/eav-smoke.ts
 */
import { loadOntology } from '$lib/engine/ontology/loadOntology';
import { eavToGraph, graphToEav, type EavTriple } from '$lib/engine/ontology/sources/eav';
import { MemoryTrellisClient } from '$lib/engine/ontology/sources/memoryTrellis';
import { trellisSource } from '$lib/engine/ontology/sources/trellis';

const triples: EavTriple[] = [
	{ entity: 'entity:prop/smoke', attribute: '@type', value: 'Thing' },
	{ entity: 'entity:prop/smoke', attribute: 'conformsTo', value: 'Prop' },
	{ entity: 'entity:prop/smoke', attribute: 'Transform.position', value: { x: 1, y: 2, z: 3 } },
	{ entity: 'entity:prop/smoke', attribute: 'Render.color', value: '#888888' }
];

// Unit: eavToGraph shape
const doc = eavToGraph(triples);
const node = doc['@graph'].find((n) => n['@id'] === 'entity:prop/smoke');
if (!node) throw new Error('eavToGraph: missing entity node');
if (node.conformsTo !== 'Prop') throw new Error('eavToGraph: conformsTo mismatch');
if (node.components?.Transform?.position?.x !== 1) throw new Error('eavToGraph: Transform.position mismatch');

// Integration: full loader path
const client = new MemoryTrellisClient();
client.put('smoke', triples);
const entities = await loadOntology(trellisSource(client, 'smoke'));
const loaded = entities.find((e) => e.id === 'entity:prop/smoke');
if (!loaded) throw new Error('loadOntology: entity not loaded');
if (loaded.type !== 'Prop') throw new Error('loadOntology: type mismatch');
const pos = loaded.components.Transform?.position as number[] | undefined;
if (!Array.isArray(pos) || pos[0] !== 1 || pos[1] !== 2 || pos[2] !== 3) {
	throw new Error(`loadOntology: position expected [1,2,3], got ${JSON.stringify(pos)}`);
}

const round = graphToEav(doc);
if (round.length < triples.length) {
	throw new Error(`graphToEav: expected at least ${triples.length} triples, got ${round.length}`);
}

console.log('eav-smoke: PASS — eavToGraph + MemoryTrellis + loadOntology + graphToEav');
