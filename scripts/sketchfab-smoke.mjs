#!/usr/bin/env node
/**
 * Smoke: Sketchfab slug helper (no network).
 * Run: pnpm test:sketchfab  (uses node --import tsx)
 *
 * sketchfabConfigured() is covered by webmcp-surface-smoke (503 paths) and e2e mock.
 */
import { slugifySketchfabName } from '../src/lib/sketchfab/sketchfab-slug.ts';

const failures = [];

function assert(label, ok) {
	if (!ok) failures.push(label);
}

assert('slugifySketchfabName("Low Poly Tree!!!")', slugifySketchfabName('Low Poly Tree!!!') === 'low-poly-tree');
assert('slugifySketchfabName("")', slugifySketchfabName('') === 'model');
assert('slugifySketchfabName max 48', slugifySketchfabName('a'.repeat(100)).length <= 48);

if (failures.length > 0) {
	console.error(`sketchfab-smoke: FAIL\n  ${failures.join('\n  ')}`);
	process.exit(1);
}
console.log('sketchfab-smoke: PASS');
