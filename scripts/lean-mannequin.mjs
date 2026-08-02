#!/usr/bin/env node
/**
 * Produce a lean mannequin.glb — mesh + skeleton only, no embedded clips.
 *
 * Clips resolve from the shared animation catalog packs (Phase 1 rule #2),
 * shrinking the default character mesh from ~5.8 MB to ~600 KB. The full
 * mesh+skeleton+clips export is kept as mannequin.full.glb for reference.
 *
 *   node scripts/lean-mannequin.mjs
 */
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAR_DIR = join(ROOT, 'static/models/characters');
const SRC = join(CHAR_DIR, 'mannequin.glb');
const BACKUP = join(CHAR_DIR, 'mannequin.full.glb');
const LEAN = join(CHAR_DIR, 'mannequin.lean.glb');

function die(msg) {
	console.error(`lean-mannequin: ${msg}`);
	process.exit(1);
}

/** Strip the animations array from a GLB's JSON chunk (binary left intact). */
async function stripAnimationJson(glbPath, outPath) {
	const data = await readFile(glbPath);
	if (data.readUInt32LE(0) !== 0x46546c67) die('not a GLB');
	const jsonLen = data.readUInt32LE(12);
	const j = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
	const before = j.animations?.length ?? 0;
	j.animations = [];
	const newJsonBuf = Buffer.from(JSON.stringify(j));
	const pad = (4 - (newJsonBuf.length % 4)) % 4;
	const padded = Buffer.concat([newJsonBuf, Buffer.alloc(pad, 0x20)]);

	const binStart = 20 + jsonLen;
	const binLen = data.readUInt32LE(binStart);
	const binData = data.subarray(binStart + 8, binStart + 8 + binLen);

	const out = Buffer.alloc(12 + 8 + padded.length + 8 + binLen);
	out.writeUInt32LE(0x46546c67, 0);
	out.writeUInt32LE(2, 4);
	out.writeUInt32LE(out.length, 8);
	out.writeUInt32LE(padded.length, 12);
	out.writeUInt32LE(0x4e4f534a, 16);
	padded.copy(out, 20);
	const binOff = 20 + padded.length;
	out.writeUInt32LE(binLen, binOff);
	out.writeUInt32LE(0x004e4942, binOff + 4);
	binData.copy(out, binOff + 8);
	await writeFile(outPath, out);
	console.log(`stripped ${before} embedded clips from JSON chunk`);
}

async function main() {
	try {
		await access(SRC);
	} catch {
		die(`missing ${SRC}`);
	}

	try {
		await access(BACKUP);
	} catch {
		await copyFile(SRC, BACKUP);
		console.log(`backup → static/models/characters/mannequin.full.glb`);
	}

	const stripped = join(CHAR_DIR, 'mannequin.stripped.glb');
	await stripAnimationJson(SRC, stripped);

	try {
		await execFileP('pnpm', ['dlx', '@gltf-transform/cli', 'prune', stripped, LEAN], { cwd: ROOT });
	} catch (err) {
		die(`gltf-transform prune failed: ${err.message}`);
	}

	await copyFile(LEAN, SRC);
	const mb = ((await readFile(SRC)).length / 1e6).toFixed(2);
	console.log(`✓ mannequin.glb is lean (${mb} MB, mesh+skeleton, clips from catalog packs)`);
}

main().catch((e) => die(e.message));
