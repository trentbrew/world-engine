#!/usr/bin/env node
/**
 * Sketchfab → static import — Phase 4 acquisition leg.
 *
 * Downloads a *downloadable* Sketchfab model as a single .glb into static/models/,
 * routing rigged meshes (skeleton or embedded clips) to static/models/characters/
 * so placement makes them animated Characters. Writes a provenance sidecar with the
 * license. Blender is NOT required — pure HTTP + unzip + gltf-transform packing.
 *
 * Auth: SKETCHFAB_API_KEY in the root .env (get a free token at
 * sketchfab.com → Settings → API). Run with Node's env-file loader so the key is
 * never on the command line:
 *
 *   node --env-file=.env scripts/sketchfab-import.mjs --search "low poly character"
 *   node --env-file=.env scripts/sketchfab-import.mjs --uid <UID> [--name my-slug]
 *
 * Hyper3D generation is a separate leg (deferred — no free tier).
 */
import { mkdtemp, readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const API = 'https://api.sketchfab.com/v3';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.SKETCHFAB_API_KEY;

function die(msg) {
	console.error(`sketchfab-import: ${msg}`);
	process.exit(1);
}
if (!KEY) {
	die('SKETCHFAB_API_KEY not set. Run: node --env-file=.env scripts/sketchfab-import.mjs …');
}

const AUTH = { headers: { Authorization: `Token ${KEY}` } };
const args = process.argv.slice(2);
const arg = (name) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const slugify = (s) =>
	(s || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48) || 'model';

async function apiJson(path) {
	const res = await fetch(`${API}${path}`, AUTH);
	if (!res.ok) die(`GET ${path} → ${res.status} ${res.statusText}`);
	return res.json();
}

async function search(query, limit) {
	const data = await apiJson(
		`/search?type=models&downloadable=true&count=${limit}&q=${encodeURIComponent(query)}`
	);
	const rows = (data.results ?? []).map((m) => ({
		uid: m.uid,
		name: m.name,
		license: m.license?.slug ?? m.license?.label ?? '?',
		faces: m.faceCount,
		animated: (m.animationCount ?? 0) > 0
	}));
	console.log(JSON.stringify(rows, null, 2));
	console.log(
		`\n${rows.length} downloadable results. Import one:\n  node --env-file=.env scripts/sketchfab-import.mjs --uid <UID>`
	);
}

/** Recursively find a model file under dir; prefer .glb, else first .gltf. */
async function findModelFile(dir) {
	let gltf = null;
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			const sub = await findModelFile(p);
			if (sub?.toLowerCase().endsWith('.glb')) return sub;
			gltf = gltf ?? sub;
		} else if (e.name.toLowerCase().endsWith('.glb')) {
			return p;
		} else if (e.name.toLowerCase().endsWith('.gltf')) {
			gltf = gltf ?? p;
		}
	}
	return gltf;
}

async function packGltfToGlb(input, output) {
	try {
		await execFileP('pnpm', ['dlx', '@gltf-transform/cli', 'copy', input, output], { cwd: ROOT });
	} catch (err) {
		die(`gltf→glb packing failed (needs pnpm dlx @gltf-transform/cli): ${err.message}`);
	}
}

/** Rigged if the GLB JSON chunk declares a skin or an animation (matches isRiggedModel). */
async function glbIsRigged(glbPath) {
	const buf = await readFile(glbPath);
	if (buf.readUInt32LE(0) !== 0x46546c67) return false; // 'glTF'
	const jsonLen = buf.readUInt32LE(12);
	const j = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
	return (j.skins?.length ?? 0) > 0 || (j.animations?.length ?? 0) > 0;
}

async function importModel(uid, nameOverride) {
	const model = await apiJson(`/models/${uid}`);
	const slug = slugify(nameOverride ?? model.name ?? uid);
	const license = model.license?.slug ?? model.license?.label ?? 'unknown';
	console.log(`Model: ${model.name}  |  license: ${license}  |  faces: ${model.faceCount ?? '?'}`);

	const dl = await apiJson(`/models/${uid}/download`);
	const archive = dl.gltf ?? dl.glb;
	if (!archive?.url) die('No glTF download for this model (not downloadable, or license-gated).');

	const tmp = await mkdtemp(join(tmpdir(), 'sketchfab-'));
	try {
		const zipPath = join(tmp, 'model.zip');
		const res = await fetch(archive.url);
		if (!res.ok) die(`archive download failed: ${res.status}`);
		await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

		const unzipped = join(tmp, 'unzipped');
		await execFileP('unzip', ['-o', '-q', zipPath, '-d', unzipped]);
		const found = await findModelFile(unzipped);
		if (!found) die('no .gltf/.glb found in the archive');

		const packed = join(tmp, `${slug}.glb`);
		if (extname(found).toLowerCase() === '.glb') await copyFile(found, packed);
		else await packGltfToGlb(found, packed);

		const rigged = await glbIsRigged(packed);
		const destDir = rigged ? 'models/characters' : 'models';
		await mkdir(join(ROOT, 'static', destDir), { recursive: true });
		const destPath = join(ROOT, 'static', destDir, `${slug}.glb`);
		await copyFile(packed, destPath);

		await writeFile(
			`${destPath}.provenance.json`,
			JSON.stringify(
				{
					source: 'sketchfab',
					uid,
					name: model.name,
					license,
					page: `https://sketchfab.com/models/${uid}`,
					rigged,
					importedAt: new Date().toISOString()
				},
				null,
				2
			)
		);

		const mb = ((await stat(destPath)).size / 1e6).toFixed(1);
		console.log(`\n✓ /${destDir}/${slug}.glb  (${mb} MB, ${rigged ? 'RIGGED → Character' : 'static → Prop'})`);
		console.log(
			rigged
				? '  Place it → animated Character (M2M clips after retarget — run: pnpm assets:audit-characters).'
				: '  Place it → static Prop. To animate: rig + export a retargeted GLB, then re-import.'
		);
		console.log(`  Provenance: static/${destDir}/${slug}.glb.provenance.json  (license: ${license})`);
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
}

const searchQuery = arg('search');
const uid = arg('uid');
if (searchQuery) await search(searchQuery, Number(arg('limit') ?? 8));
else if (uid) await importModel(uid, arg('name'));
else die('usage: --search "<query>" [--limit N]  |  --uid <UID> [--name <slug>]');
