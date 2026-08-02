/**
 * Durable tier smoke: graphToEav roundtrip + MemoryDurableStore persistence.
 * Run: pnpm test:durable
 */
import { eavToGraph, graphToEav, type EavTriple } from '$lib/engine/ontology/sources/eav';
import { MemoryDurableStore } from '$lib/engine/ontology/durableStore';

const triples: EavTriple[] = [
	{ entity: 'entity:ground/smoke', attribute: '@type', value: 'Thing' },
	{ entity: 'entity:ground/smoke', attribute: 'conformsTo', value: 'GroundPlane' },
	{ entity: 'entity:ground/smoke', attribute: 'Ground.color', value: '#0e0e12' },
	{ entity: 'entity:ground/smoke', attribute: 'Ground.size', value: 20 }
];

const doc = eavToGraph(triples);
const round = graphToEav(doc);
const colorTriple = round.find((t) => t.attribute === 'Ground.color');
if (!colorTriple || colorTriple.value !== '#0e0e12') {
	throw new Error(`graphToEav roundtrip failed: ${JSON.stringify(round)}`);
}

const store = new MemoryDurableStore();
store.seedFromDoc('smoke', doc);
const loaded = await store.load('smoke');
const ground = loaded['@graph']?.find((n) => n['@id'] === 'entity:ground/smoke');
const color = (ground?.components?.Ground as { color?: string } | undefined)?.color;
if (color !== '#0e0e12') throw new Error(`load: expected #0e0e12, got ${color}`);

await store.updateField('smoke', {
	entityId: 'entity:ground/smoke',
	component: 'Ground',
	field: 'color',
	value: '#00ff00'
});

const reloaded = await store.load('smoke');
const ground2 = reloaded['@graph']?.find((n) => n['@id'] === 'entity:ground/smoke');
const color2 = (ground2?.components?.Ground as { color?: string } | undefined)?.color;
if (color2 !== '#00ff00') throw new Error(`persist: expected #00ff00, got ${color2}`);

const propDoc = {
	'@graph': [
		{
			'@id': 'entity:prop/smoke',
			'@type': 'Thing',
			conformsTo: 'Prop',
			components: {
				Transform: { position: [0, 0.5, 0] },
				Render: { mesh: 'primitive:box', color: '#ff6b6b' }
			}
		}
	]
};
store.seedFromDoc('smoke-components', propDoc);
await store.updateField('smoke-components', {
	kind: 'setComponent',
	entityId: 'entity:prop/smoke',
	component: 'Gravity',
	bag: { g: 4, rest: 0.5 }
});
const withGravity = await store.load('smoke-components');
const prop = withGravity['@graph']?.find((n) => n['@id'] === 'entity:prop/smoke');
const gravity = prop?.components?.Gravity as { g?: number } | undefined;
if (gravity?.g !== 4) throw new Error(`setComponent: expected g=4, got ${gravity?.g}`);

await store.updateField('smoke-components', {
	kind: 'removeComponent',
	entityId: 'entity:prop/smoke',
	component: 'Gravity'
});
const withoutGravity = await store.load('smoke-components');
const prop2 = withoutGravity['@graph']?.find((n) => n['@id'] === 'entity:prop/smoke');
if (prop2?.components?.Gravity) throw new Error('removeComponent: Gravity still present');

await store.updateField('smoke-components', {
	kind: 'setEntity',
	entityId: 'entity:prop/smoke',
	components: {
		Transform: { position: [1, 0.5, 0] },
		Render: { mesh: 'primitive:box', color: '#00ff00' }
	}
});
const setEntity = await store.load('smoke-components');
const prop3 = setEntity['@graph']?.find((n) => n['@id'] === 'entity:prop/smoke');
const render = prop3?.components?.Render as { color?: string } | undefined;
const pos = prop3?.components?.Transform as { position?: number[] } | undefined;
if (render?.color !== '#00ff00') throw new Error(`setEntity: color mismatch ${render?.color}`);
if (pos?.position?.[0] !== 1) throw new Error(`setEntity: position mismatch ${pos?.position}`);

store.seedFromDoc('smoke-types', propDoc);
await store.updateField('smoke-types', {
	kind: 'defineType',
	name: 'FallingCrate',
	components: ['Transform', 'Render', 'Gravity'],
	defaults: {
		Render: { mesh: 'primitive:box', color: '#ff6b6b' },
		Gravity: { g: 9.8, rest: 0.5 }
	},
	applyToEntityId: 'entity:prop/smoke'
});
const typed = await store.load('smoke-types');
const typeNode = typed['@graph']?.find((n) => n['@id'] === 'type:FallingCrate');
const propTyped = typed['@graph']?.find((n) => n['@id'] === 'entity:prop/smoke');
if (typeNode?.['@type'] !== 'EntityType') throw new Error('defineType: missing EntityType node');
const gravDefault = (typeNode?.defaults as { Gravity?: { g?: number } })?.Gravity?.g;
if (gravDefault !== 9.8) throw new Error(`defineType: expected g=9.8, got ${gravDefault}`);
if (propTyped?.conformsTo !== 'FallingCrate') {
	throw new Error(`defineType: expected conformsTo FallingCrate, got ${propTyped?.conformsTo}`);
}

console.log(
	'durable-smoke: PASS — graphToEav + setField/setComponent/removeComponent/setEntity/defineType'
);
