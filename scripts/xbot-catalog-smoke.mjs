/** Smoke — xbot-mixamo catalog locomotion bindings resolve to embedded clip ids. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

const EXPECTED = {
	idle: 'idle',
	walk: 'walk',
	jog: 'run',
	run: 'run',
	sprint: 'run',
	jumpStart: 'idle',
	jumpLoop: 'idle',
	jumpLand: 'idle'
};

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
	readFileSync(path.join(root, '../static/catalogs/xbot-mixamo.json'), 'utf8')
);

assert(catalog.locomotion, 'xbot-mixamo.json missing locomotion map');

for (const [key, expected] of Object.entries(EXPECTED)) {
	assert(
		catalog.locomotion[key] === expected,
		`locomotion.${key}: expected ${expected}, got ${catalog.locomotion[key]}`
	);
}

const clipIds = new Set((catalog.clips ?? []).map((c) => c.id));
for (const clip of ['idle', 'walk', 'run']) {
	assert(clipIds.has(clip), `catalog missing clip meta for ${clip}`);
}

console.log('xbot-catalog-smoke: PASS');
