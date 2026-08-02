import { error, json } from '@sveltejs/kit';
import { assertWorldAuthorDev } from '$lib/engine/authoring/devOnly';
import { applyPatchToWorldFile } from '$lib/engine/authoring/worldFileStore';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { DurablePatch } from '$lib/engine/ontology/durablePatch';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	assertWorldAuthorDev();
	const game = normalizeGameParam(params.game);
	const body = (await request.json()) as { patch?: DurablePatch };
	const patch = body.patch ?? (body as DurablePatch);
	if (!patch || typeof patch !== 'object') throw error(400, 'Missing patch body');

	try {
		const doc = await applyPatchToWorldFile(game, patch);
		return json({ ok: true, patch, entityCount: (doc['@graph'] ?? []).length });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Patch failed';
		throw error(400, message);
	}
};
