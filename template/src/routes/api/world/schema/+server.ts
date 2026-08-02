import { json } from '@sveltejs/kit';
import { worldSchemaPayload } from '$lib/engine/authoring/worldSchemaApi';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const raw = url.searchParams.get('game');
	const game = raw ? normalizeGameParam(raw) : undefined;
	return json(await worldSchemaPayload(game));
};
