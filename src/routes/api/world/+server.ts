import { json } from '@sveltejs/kit';
import { GAMES } from '$lib/engine/games';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		games: GAMES.map((game) => ({
			param: game.param ?? 'default',
			title: game.title,
			description: game.description,
			dimensions: game.dimensions
		}))
	});
};
