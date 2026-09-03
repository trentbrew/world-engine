import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import {
	importSketchfabModel,
	searchSketchfab,
	sketchfabConfigured,
	SketchfabError
} from '$lib/sketchfab/sketchfab.server';
import type { RequestHandler } from './$types';

function sketchfabUnavailable(): never {
	throw error(
		503,
		'Sketchfab import is dev-only. Run locally with SKETCHFAB_API_KEY in .env, or use pnpm import:sketchfab.'
	);
}

/** Search downloadable Sketchfab models (dev + key required). */
export const GET: RequestHandler = async ({ url }) => {
	if (!dev) throw error(404, 'Not found');
	if (!sketchfabConfigured()) sketchfabUnavailable();

	const q = url.searchParams.get('q')?.trim();
	if (!q) throw error(400, 'Missing q query parameter');

	const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 8) || 8));

	try {
		const results = await searchSketchfab(q, limit);
		return json({ results });
	} catch (err) {
		if (err instanceof SketchfabError) throw error(502, err.message);
		throw err;
	}
};

/** Import a Sketchfab model by UID into static/models/ (dev + key required). */
export const POST: RequestHandler = async ({ request }) => {
	if (!dev) throw error(404, 'Not found');
	if (!sketchfabConfigured()) sketchfabUnavailable();

	const body = (await request.json().catch(() => null)) as {
		uid?: string;
		name?: string;
	} | null;

	const uid = body?.uid?.trim();
	if (!uid) throw error(400, 'Missing uid');

	try {
		const result = await importSketchfabModel(uid, { nameOverride: body?.name?.trim() });
		return json({ ok: true, ...result });
	} catch (err) {
		if (err instanceof SketchfabError) throw error(502, err.message);
		throw err;
	}
};
