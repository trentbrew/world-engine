import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	ASSET_ROOTS,
	sortAssets,
	type AssetEntry,
	type AssetKind
} from '$lib/assets/catalog';
import type { RequestHandler } from './$types';

function sanitizeFilename(name: string): string {
	const base = name.split(/[/\\]/).pop()?.replace(/[^\w.-]/g, '_') ?? 'asset';
	return base || 'asset';
}

function extensionFor(name: string): string {
	const lower = name.toLowerCase();
	const dot = lower.lastIndexOf('.');
	return dot >= 0 ? lower.slice(dot) : '';
}

async function uniquePath(dirPath: string, name: string): Promise<string> {
	const ext = extensionFor(name);
	const stem = ext ? name.slice(0, -ext.length) : name;
	let candidate = name;
	let n = 1;

	while (true) {
		try {
			await stat(join(dirPath, candidate));
			candidate = `${stem}-${n}${ext}`;
			n += 1;
		} catch {
			return candidate;
		}
	}
}

/** Recurse a root dir so nested assets (e.g. models/characters/*.glb) surface too. */
async function collectAssets(
	dirPath: string,
	rel: string,
	root: (typeof ASSET_ROOTS)[number],
	out: AssetEntry[]
): Promise<void> {
	let entries;
	try {
		entries = await readdir(dirPath, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const abs = join(dirPath, entry.name);
		const relPath = rel ? `${rel}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			await collectAssets(abs, relPath, root, out);
			continue;
		}

		const lower = entry.name.toLowerCase();
		if (!root.extensions.some((ext) => lower.endsWith(ext))) continue;

		let size: number | undefined;
		try {
			size = (await stat(abs)).size;
		} catch {
			/* optional */
		}

		out.push({ kind: root.kind, name: entry.name, url: `/${root.dir}/${relPath}`, size });
	}
}

async function listAssets(): Promise<AssetEntry[]> {
	const staticDir = join(process.cwd(), 'static');
	const assets: AssetEntry[] = [];

	for (const root of ASSET_ROOTS) {
		await collectAssets(join(staticDir, root.dir), '', root, assets);
	}

	return sortAssets(assets);
}

export const GET: RequestHandler = async () => json({ assets: await listAssets() });

export const POST: RequestHandler = async ({ request }) => {
	if (!dev) throw error(404, 'Not found');

	const form = await request.formData();
	const kind = form.get('kind');
	const file = form.get('file');

	if (typeof kind !== 'string' || !ASSET_ROOTS.some((root) => root.kind === kind)) {
		throw error(400, 'Invalid asset kind');
	}

	if (!(file instanceof File)) {
		throw error(400, 'Missing file');
	}

	const root = ASSET_ROOTS.find((entry) => entry.kind === (kind as AssetKind));
	if (!root) throw error(400, 'Invalid asset kind');

	const sanitized = sanitizeFilename(file.name);
	const ext = extensionFor(sanitized);
	if (!root.extensions.includes(ext)) {
		throw error(400, `Unsupported file type for ${root.kind}`);
	}

	const dirPath = join(process.cwd(), 'static', root.dir);
	await mkdir(dirPath, { recursive: true });

	const name = await uniquePath(dirPath, sanitized);
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(join(dirPath, name), buffer);

	const asset: AssetEntry = {
		kind: root.kind,
		name,
		url: `/${root.dir}/${name}`,
		size: buffer.length
	};

	return json({ asset });
};
