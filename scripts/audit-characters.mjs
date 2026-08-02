#!/usr/bin/env node
/**
 * Audit character GLBs under static/models/ for mesh2motion-human compatibility.
 *
 *   node scripts/audit-characters.mjs           # table
 *   node scripts/audit-characters.mjs --json      # machine output
 *   node scripts/audit-characters.mjs --strict    # exit 1 if any rigged file needs retarget
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditModelsDir, summarizeAudit } from './character-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

const rows = await auditModelsDir(ROOT);
const summary = summarizeAudit(rows);

if (jsonOut) {
	console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
	console.log('Character rig audit (catalog:mesh2motion-human)\n');
	console.log(
		'file'.padEnd(44),
		'family'.padEnd(20),
		'clips',
		'action'
	);
	console.log('-'.repeat(80));
	for (const r of rows) {
		const file = r.rel.padEnd(44);
		const fam = r.family.padEnd(20);
		const clips = String(r.clipCount).padStart(5);
		console.log(file, fam, clips, r.action);
	}
	console.log('-'.repeat(80));
	console.log(
		`${summary.total} files · ${summary.m2mReady} M2M-ready · ${summary.needsRetarget} need retarget · ${summary.staticMeshes} static`
	);
	console.log('\nRetarget foreign rigs: https://mesh2motion.org/ → human export → static/models/characters/');
	console.log('Then lean (optional): pnpm assets:lean-mannequin pattern on the export.');
}

if (strict && summary.needsRetarget > 0) {
	process.exit(1);
}
