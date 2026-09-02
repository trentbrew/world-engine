/** Resolve and persist the multiplayer `?room=` query param. */

import { DEFAULT_GAME_PARAM } from '$lib/engine/gamesMeta';
import { replaceBrowserUrl } from '$lib/engine/replaceBrowserUrl';

export function defaultRoomForGame(game: string | null): string {
	return game ?? DEFAULT_GAME_PARAM;
}

export function resolveRoomId(search?: URLSearchParams | string): string {
	const params =
		typeof search === 'string'
			? new URLSearchParams(search)
			: (search ?? new URLSearchParams(typeof location !== 'undefined' ? location.search : ''));
	const room = params.get('room');
	if (room) return room;

	const world = params.get('world');
	if (world) {
		try {
			const slug = new URL(world).pathname.split('/').pop()?.replace(/\.jsonld$/i, '');
			if (slug) return slug;
		} catch {
			// fall through to game default
		}
	}

	const game = params.get('game');
	return defaultRoomForGame(game);
}

/** Add `?room=` when missing so share links always include the room id. */
export function ensureRoomInUrl(): string {
	if (typeof location === 'undefined') return DEFAULT_GAME_PARAM;

	const url = new URL(location.href);
	const room = resolveRoomId(url.searchParams);
	if (url.searchParams.get('room') === room) return room;

	url.searchParams.set('room', room);
	replaceBrowserUrl(url);
	return room;
}
