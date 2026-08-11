import { join } from 'node:path';

/** Map API `game` segment to static JSON-LD path (`undefined` = `/world.jsonld` scratch). */
export function normalizeGameParam(game: string): string | undefined {
	if (game === 'default' || game === '_' || game === 'sandbox') return undefined;
	return game;
}

export function gameFilePath(game?: string): string {
	const relative = game ? `games/${game}.jsonld` : 'world.jsonld';
	return join(process.cwd(), 'static', relative);
}

export function gamePublicPath(game?: string): string {
	return game ? `/games/${game}.jsonld` : '/world.jsonld';
}
