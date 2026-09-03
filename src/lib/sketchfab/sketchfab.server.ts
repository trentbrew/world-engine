/**
 * Sketchfab acquisition — search + import downloadable models into static/.
 * Used by the CLI (`pnpm import:sketchfab`) and the dev-only `/api/sketchfab` route.
 */
import { execFile } from 'node:child_process';
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';
import { slugifySketchfabName } from './sketchfab-slug';
import { sketchfabConfigured } from './sketchfab-env';

export { slugifySketchfabName } from './sketchfab-slug';
export { sketchfabConfigured } from './sketchfab-env';

const execFileP = promisify(execFile);
const API = 'https://api.sketchfab.com/v3';

export type SketchfabSearchRow = {
	uid: string;
	name: string;
	license: string;
	faces?: number;
	animated: boolean;
};

export type SketchfabImportResult = {
	slug: string;
	url: string;
	destPath: string;
	destDir: 'models' | 'models/characters';
	rigged: boolean;
	license: string;
	sizeMb: string;
	provenancePath: string;
	modelName: string;
	uid: string;
};

export class SketchfabError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SketchfabError';
	}
}

function authHeaders(): HeadersInit {
	const key = process.env.SKETCHFAB_API_KEY?.trim();
	if (!key) throw new SketchfabError('SKETCHFAB_API_KEY not set');
	return { Authorization: `Token ${key}` };
}

async function apiJson(path: string): Promise<Record<string, unknown>> {
	const res = await fetch(`${API}${path}`, { headers: authHeaders() });
	if (!res.ok) {
		throw new SketchfabError(`GET ${path} → ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<Record<string, unknown>>;
}

export async function searchSketchfab(query: string, limit = 8): Promise<SketchfabSearchRow[]> {
	const data = await apiJson(
		`/search?type=models&downloadable=true&count=${limit}&q=${encodeURIComponent(query)}`
	);
	const results = (data.results ?? []) as Array<Record<string, unknown>>;
	return results.map((m) => ({
		uid: String(m.uid ?? ''),
		name: String(m.name ?? ''),
		license:
			(m.license as { slug?: string; label?: string } | undefined)?.slug ??
			(m.license as { label?: string } | undefined)?.label ??
			'?',
		faces: typeof m.faceCount === 'number' ? m.faceCount : undefined,
		animated: (Number(m.animationCount) || 0) > 0
	}));
}

async function findModelFile(dir: string): Promise<string | null> {
	let gltf: string | null = null;
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

async function packGltfToGlb(input: string, output: string, cwd: string): Promise<void> {
	try {
		await execFileP('pnpm', ['dlx', '@gltf-transform/cli', 'copy', input, output], { cwd });
	} catch (err) {
		throw new SketchfabError(
			`gltf→glb packing failed (needs pnpm dlx @gltf-transform/cli): ${(err as Error).message}`
		);
	}
}

async function glbIsRigged(glbPath: string): Promise<boolean> {
	const buf = await readFile(glbPath);
	if (buf.readUInt32LE(0) !== 0x46546c67) return false;
	const jsonLen = buf.readUInt32LE(12);
	const j = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
		skins?: unknown[];
		animations?: unknown[];
	};
	return (j.skins?.length ?? 0) > 0 || (j.animations?.length ?? 0) > 0;
}

export async function importSketchfabModel(
	uid: string,
	opts: { nameOverride?: string; projectRoot?: string } = {}
): Promise<SketchfabImportResult> {
	const root = opts.projectRoot ?? process.cwd();
	const model = await apiJson(`/models/${uid}`);
	const slug = slugifySketchfabName(opts.nameOverride ?? String(model.name ?? uid));
	const license =
		(model.license as { slug?: string; label?: string } | undefined)?.slug ??
		(model.license as { label?: string } | undefined)?.label ??
		'unknown';
	const modelName = String(model.name ?? uid);

	const dl = await apiJson(`/models/${uid}/download`);
	const archive = (dl.gltf ?? dl.glb) as { url?: string } | undefined;
	if (!archive?.url) {
		throw new SketchfabError(
			'No glTF download for this model (not downloadable, or license-gated).'
		);
	}

	const tmp = await mkdtemp(join(tmpdir(), 'sketchfab-'));
	try {
		const zipPath = join(tmp, 'model.zip');
		const res = await fetch(archive.url);
		if (!res.ok) throw new SketchfabError(`archive download failed: ${res.status}`);
		await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

		const unzipped = join(tmp, 'unzipped');
		await execFileP('unzip', ['-o', '-q', zipPath, '-d', unzipped]);
		const found = await findModelFile(unzipped);
		if (!found) throw new SketchfabError('no .gltf/.glb found in the archive');

		const packed = join(tmp, `${slug}.glb`);
		if (extname(found).toLowerCase() === '.glb') await copyFile(found, packed);
		else await packGltfToGlb(found, packed, root);

		const rigged = await glbIsRigged(packed);
		const destDir = rigged ? 'models/characters' : 'models';
		await mkdir(join(root, 'static', destDir), { recursive: true });
		const destPath = join(root, 'static', destDir, `${slug}.glb`);
		await copyFile(packed, destPath);

		const provenancePath = `${destPath}.provenance.json`;
		await writeFile(
			provenancePath,
			JSON.stringify(
				{
					source: 'sketchfab',
					uid,
					name: modelName,
					license,
					page: `https://sketchfab.com/models/${uid}`,
					rigged,
					importedAt: new Date().toISOString()
				},
				null,
				2
			)
		);

		const sizeMb = ((await stat(destPath)).size / 1e6).toFixed(1);
		const url = `/${destDir}/${slug}.glb`;

		return {
			slug,
			url,
			destPath,
			destDir,
			rigged,
			license,
			sizeMb,
			provenancePath,
			modelName,
			uid
		};
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
}
