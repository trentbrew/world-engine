import { error, json } from '@sveltejs/kit';
import { assertWorldAuthorDev } from '$lib/engine/authoring/devOnly';
import {
	deleteEntityFromGraph,
	entityJson,
	findEntityNode,
	readWorldFile,
	writeWorldFile
} from '$lib/engine/authoring/worldFileStore';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const game = normalizeGameParam(params.game);
	const entityId = url.searchParams.get('id');
	if (!entityId) throw error(400, 'Missing id query parameter');

	try {
		const doc = await readWorldFile(game);
		const node = findEntityNode(doc['@graph'] ?? [], entityId);
		if (!node) throw error(404, `Entity not found: ${entityId}`);
		return json({ game: params.game, entity: entityJson(node) });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(404, `World not found: ${params.game}`);
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	assertWorldAuthorDev();
	const game = normalizeGameParam(params.game);
	const entityId = url.searchParams.get('id');
	if (!entityId) throw error(400, 'Missing id query parameter');

	const doc = await readWorldFile(game);
	const graph = [...(doc['@graph'] ?? [])];
	if (!deleteEntityFromGraph(graph, entityId)) {
		throw error(404, `Entity not found: ${entityId}`);
	}
	doc['@graph'] = graph;
	await writeWorldFile(game, doc);
	return json({ ok: true, deleted: entityId });
};
