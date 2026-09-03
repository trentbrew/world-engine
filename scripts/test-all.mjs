#!/usr/bin/env node
/**
 * Run the whole smoke suite and report one pass/fail table.
 *
 * Exists for the merge gate: with several sessions landing work into one tree,
 * "do the tests pass" has to be one command with one exit code, not 24 commands
 * run by hand and half-remembered. The list is DISCOVERED from package.json
 * rather than hardcoded, so a lane that adds `test:foo` is covered the moment it
 * lands — a hardcoded list would silently stop testing whatever was added last.
 *
 * Typecheck runs first and, when it fails, everything else is skipped: nearly
 * every smoke script imports the engine, so a broken tree reports 20 identical
 * import failures that bury the one real error.
 *
 * Usage:
 *   node scripts/test-all.mjs            # typecheck + smoke scripts
 *   node scripts/test-all.mjs --e2e      # also run the Playwright suite
 *   node scripts/test-all.mjs --only grass,water
 *   node scripts/test-all.mjs --no-check # skip typecheck (not for a merge gate)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const flagValue = (f) => {
	const i = argv.indexOf(f);
	return i >= 0 ? argv[i + 1] : null;
};

/** Playwright owns its own server + budget; opt in, it is not part of the quick gate. */
const E2E = new Set(['test:e2e', 'test:e2e:cold']);
/** Reaches the network / needs SKETCHFAB_TOKEN — not a hermetic gate. */
const NETWORK = new Set(['test:sketchfab']);

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const only = flagValue('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

// `test:all` matches its own discovery prefix — without this it recurses forever.
let names = Object.keys(pkg.scripts ?? {}).filter((n) => n.startsWith('test:') && n !== 'test:all');
if (!hasFlag('--e2e')) names = names.filter((n) => !E2E.has(n));
else names = names.filter((n) => n !== 'test:e2e:cold'); // cold is a fallback, not an extra run
if (!hasFlag('--network')) names = names.filter((n) => !NETWORK.has(n));
if (only) names = names.filter((n) => only.some((frag) => n.includes(frag)));

const results = [];

function run(label, command, args) {
	process.stdout.write(`\n▶ ${label}\n`);
	const started = Date.now();
	const out = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
	const seconds = ((Date.now() - started) / 1000).toFixed(1);
	// A signal (or a missing binary) leaves status null — that is a failure, not a pass.
	const ok = out.status === 0;
	results.push({ label, ok, seconds });
	return ok;
}

if (!hasFlag('--no-check')) {
	const ok = run('typecheck (svelte-check)', 'pnpm', ['run', 'check']);
	if (!ok) {
		// Deliberately not a partial run: see the header.
		report('typecheck failed — smoke scripts skipped, they would all fail on the same import');
		process.exit(1);
	}
}

for (const name of names) run(name, 'pnpm', ['run', name]);

function report(note) {
	const pass = results.filter((r) => r.ok);
	const fail = results.filter((r) => !r.ok);
	const width = Math.max(...results.map((r) => r.label.length), 10);
	process.stdout.write(`\n${'─'.repeat(width + 18)}\n`);
	for (const r of results) {
		process.stdout.write(`${r.ok ? '  ok  ' : ' FAIL '} ${r.label.padEnd(width)}  ${r.seconds}s\n`);
	}
	process.stdout.write(`${'─'.repeat(width + 18)}\n`);
	process.stdout.write(`${pass.length} passed, ${fail.length} failed, ${results.length} total\n`);
	if (fail.length) process.stdout.write(`failed: ${fail.map((r) => r.label).join(', ')}\n`);
	if (note) process.stdout.write(`${note}\n`);
}

report();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
