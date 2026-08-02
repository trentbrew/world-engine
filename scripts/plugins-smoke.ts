/**
 * Plugin merge seam smoke — no server needed. Exercises mergePlugins with a
 * stub fetch: additive merge, missing-manifest no-op, missing-pack skip.
 * Run: pnpm test:plugins
 */
import { mergePlugins } from '../src/lib/engine/ontology/source';
import { loadOntology } from '../src/lib/engine/ontology/loadOntology';

let failed = 0;
function check(name, cond) {
	if (cond) {
		console.log(`  ✓ ${name}`);
	} else {
		failed++;
		console.error(`  ✗ ${name}`);
	}
}

function stubFetch(files) {
	return async (url) => {
		const body = files[url];
		if (body === undefined) return new Response('', { status: 404 });
		return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
	};
}

const world = {
	'@context': {},
	'@graph': [{ '@id': 'entity:ground/main', '@type': 'Thing', conformsTo: 'GroundPlane' }]
};

const healthPack = {
	'@context': {},
	'@graph': [
		{
			'@id': 'component:Health',
			'@type': 'ComponentSchema',
			fields: { max: { t: 'number', default: 100 }, current: { t: 'number', default: '=max' } }
		}
	]
};

console.log('mergePlugins');

{
	const files = {
		'/plugins/manifest.json': { plugins: ['health'] },
		'/plugins/health.jsonld': healthPack
	};
	const merged = await mergePlugins(world, { fetchImpl: stubFetch(files) });
	const graph = merged['@graph'] ?? [];
	check('adds plugin graph nodes to world graph', graph.length === 2);
	check('world nodes preserved first', graph[0]['@id'] === 'entity:ground/main');
	check('plugin schema appended', graph[1]['@id'] === 'component:Health');
}

{
	const merged = await mergePlugins(world, { fetchImpl: stubFetch({}) });
	check('missing manifest is a no-op', merged === world && merged['@graph'].length === 1);
}

{
	const files = {
		'/plugins/manifest.json': { plugins: ['health', 'missing'] },
		'/plugins/health.jsonld': healthPack
	};
	const merged = await mergePlugins(world, { fetchImpl: stubFetch(files) });
	check('missing pack is skipped, others merge', (merged['@graph'] ?? []).length === 2);
}

console.log('loadOntology end-to-end');

{
	const files = {
		'/plugins/manifest.json': { plugins: ['health'] },
		'/plugins/health.jsonld': healthPack
	};
	const entities = await loadOntology(() => Promise.resolve(world), {
		plugins: { fetchImpl: stubFetch(files) }
	});
	check('world still loads with plugins installed', entities.length === 1);
}

if (failed > 0) {
	console.error(`\n${failed} check(s) failed`);
	process.exit(1);
}
console.log('\nall checks passed');
