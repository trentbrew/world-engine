#!/usr/bin/env node
/** YAML colors.* → mock :root parity for agent_focus_highlights artifacts. */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const dir = __dirname;
const design = readFileSync(resolve(dir, 'agent_focus_highlights_design.md'), 'utf8');
const mock = readFileSync(resolve(dir, 'agent_focus_highlights_mockup.html'), 'utf8');

const keys = [
	'viewport',
	'viewport-grid',
	'surface',
	'surface-raised',
	'text',
	'text-muted',
	'border',
	'peer-blue',
	'peer-purple',
	'peer-teal'
];

let failed = 0;
for (const key of keys) {
	const re = new RegExp(`^\\s{2}${key.replace(/-/g, '\\-')}:\\s+"([^"]+)"`, 'm');
	const m = design.match(re);
	if (!m) {
		console.error(`missing in design yaml: ${key}`);
		failed++;
		continue;
	}
	const val = m[1].toLowerCase();
	const needle = `--${key}: ${val}`;
	if (!mock.toLowerCase().includes(needle)) {
		console.error(`missing in mock :root: ${needle}`);
		failed++;
	}
}

if (failed > 0) process.exit(1);
console.log(`token parity ok (${keys.length} colors)`);
