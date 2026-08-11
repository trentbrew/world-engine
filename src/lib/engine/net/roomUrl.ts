/** Resolve and persist the multiplayer `?room=` query param. */

import { DEFAULT_GAME_PARAM } from '$lib/engine/gamesMeta';

export function defaultRoomForGame(game: string | null): string {
	return game ?? DEFAULT_GAME_PARAM;
}

export function resolveRoomId(search?: URLSearchParams | string): string {
	const params =
		typeof search === 'string'
			? new URLSearchParams(search)
			: (search ?? new URLSearchParams(typeof location !== 'undefined' ? location.search : ''));
	const game = params.get('game');
	return params.get('room') ?? defaultRoomForGame(game);
}

/** Add `?room=` when missing so share links always include the room id. */
export function ensureRoomInUrl(): string {
	if (typeof location === 'undefined') return DEFAULT_GAME_PARAM;

	const url = new URL(location.href);
	const room = resolveRoomId(url.searchParams);
	if (url.searchParams.get('room') === room) return room;

	url.searchParams.set('room', room);
	history.replaceState(history.state, '', url);
	return room;
}
