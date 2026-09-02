import { replaceBrowserUrl } from '$lib/engine/replaceBrowserUrl';

/** Resolve and persist the multiplayer `?room=` query param. */

export function defaultRoomForGame(game: string | null): string {
	return game ?? 'lobby';
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
	if (typeof location === 'undefined') return 'lobby';

	const url = new URL(location.href);
	const room = resolveRoomId(url.searchParams);
	if (url.searchParams.get('room') === room) return room;

	url.searchParams.set('room', room);
	replaceBrowserUrl(url);
	return room;
}
