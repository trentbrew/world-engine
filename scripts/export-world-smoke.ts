/**
 * Smoke: exportWorldGraph roundtrip on orbit world file.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadOntology } from '$lib/engine/ontology/loadOntology';
import { exportWorldGraph, exportWorldGraphJson } from '$lib/engine/authoring/exportWorldGraph';

const orbitPath = resolve(process.cwd(), 'static/games/orbit.jsonld');
const raw = readFileSync(orbitPath, 'utf8');
const seed = JSON.parse(raw);

const entities = await loadOntology(() => Promise.resolve(seed));
const exported = exportWorldGraph({ entities });
const json = exportWorldGraphJson({ entities });

if (!exported['@graph']?.length) {
	throw new Error('exportWorldGraph: empty graph');
}

const entityNodes = exported['@graph'].filter((node) => node['@type'] === 'Thing');
if (entityNodes.length < 3) {
	throw new Error(`exportWorldGraph: expected entity nodes, got ${entityNodes.length}`);
}

if (!json.includes('"@context"') || !json.includes('entity:ground/main')) {
	throw new Error('exportWorldGraphJson: missing expected content');
}

const reloaded = await loadOntology(() => Promise.resolve(exported));
if (reloaded.length < entities.length) {
	throw new Error(
		`export roundtrip lost entities: ${entities.length} → ${reloaded.length}`
	);
}

console.log(
	`export-world-smoke: PASS — ${entityNodes.length} entities, ${exported['@graph']!.length} graph nodes`
);
