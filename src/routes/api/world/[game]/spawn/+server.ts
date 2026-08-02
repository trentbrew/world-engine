import { error, json } from '@sveltejs/kit';
import { assertWorldAuthorDev } from '$lib/engine/authoring/devOnly';
import { entityJson, spawnEntityInWorldFile } from '$lib/engine/authoring/worldFileStore';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { RequestHandler } from './$types';

type SpawnBody = {
	type: string;
	position: [number, number, number];
	id?: string;
	overrides?: Record<string, Record<string, unknown>>;
};

function parsePosition(raw: unknown): [number, number, number] {
	if (!Array.isArray(raw) || raw.length < 3) {
		throw error(400, 'position must be [x, y, z]');
	}
	return [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0];
}

export const POST: RequestHandler = async ({ params, request }) => {
	assertWorldAuthorDev();
	const game = normalizeGameParam(params.game);
	const body = (await request.json()) as SpawnBody;
	if (!body.type) throw error(400, 'Missing type');
	const position = parsePosition(body.position);

	try {
		const { entity } = await spawnEntityInWorldFile(game, {
			type: body.type,
			position,
			id: body.id,
			overrides: body.overrides
		});
		return json({ ok: true, entity: entityJson(entity) });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : 'Spawn failed';
		throw error(400, message);
	}
};
