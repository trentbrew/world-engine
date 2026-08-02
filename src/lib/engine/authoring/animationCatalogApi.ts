/**
 * Server-side reads of the clip catalogs under `static/catalogs/` — the discovery
 * surface behind the world-author MCP animation tools (list catalogs, list a
 * catalog's clips). Read-only; mirrors worldSchemaApi. See
 * docs/artifacts/skinned_mesh_animation_spec.md.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CATALOGS_DIR = join(process.cwd(), 'static', 'catalogs');

export interface CatalogClipMeta {
	id: string;
	category?: string;
	file?: string;
	dur?: number;
	loop?: boolean;
	rootMotion?: boolean;
}

export interface CatalogSummary {
	id: string;
	name?: string;
	rig?: string;
	source?: string;
	rootBone?: string;
	clipCount: number;
}

export interface CatalogDetail extends CatalogSummary {
	packs?: Record<string, string>;
	clips: CatalogClipMeta[];
}

/** `catalog:foo` / `foo` / `foo.json` → safe `foo.json` basename, or null if unsafe. */
function catalogBasename(idOrRef: string): string | null {
	const id = idOrRef.startsWith('catalog:') ? idOrRef.slice('catalog:'.length) : idOrRef;
	const base = id.endsWith('.json') ? id : `${id}.json`;
	if (base.includes('/') || base.includes('\\') || base.includes('..')) return null;
	return base;
}

async function readCatalogFile(basename: string): Promise<Record<string, unknown> | null> {
	try {
		return JSON.parse(await readFile(join(CATALOGS_DIR, basename), 'utf8'));
	} catch {
		return null;
	}
}

function summary(raw: Record<string, unknown>, fallbackId: string): CatalogSummary {
	const clips = Array.isArray(raw.clips) ? raw.clips : [];
	return {
		id: typeof raw['@id'] === 'string' ? (raw['@id'] as string) : fallbackId,
		name: raw.name as string | undefined,
		rig: raw.rig as string | undefined,
		source: raw.source as string | undefined,
		rootBone: raw.rootBone as string | undefined,
		clipCount: clips.length
	};
}

/** All catalogs under static/catalogs, id + rig + clip count. */
export async function listCatalogs(): Promise<CatalogSummary[]> {
	let files: string[];
	try {
		files = (await readdir(CATALOGS_DIR)).filter((f) => f.endsWith('.json'));
	} catch {
		return [];
	}
	const out: CatalogSummary[] = [];
	for (const f of files.sort()) {
		const raw = await readCatalogFile(f);
		if (raw) out.push(summary(raw, `catalog:${f.replace(/\.json$/, '')}`));
	}
	return out;
}

/** One catalog with its full clip list (valid `Mesh3DAnimator.clip` values). */
export async function catalogDetail(idOrRef: string): Promise<CatalogDetail | null> {
	const base = catalogBasename(idOrRef);
	if (!base) return null;
	const raw = await readCatalogFile(base);
	if (!raw) return null;
	const clips = (Array.isArray(raw.clips) ? raw.clips : []) as CatalogClipMeta[];
	return {
		...summary(raw, idOrRef),
		packs: raw.packs as Record<string, string> | undefined,
		clips
	};
}
