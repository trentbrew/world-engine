/**
 * Scene catalog for the nav picker and `?game=` loader.
 *
 * Worlds are auto-discovered from static/games (see gamesCatalogPlugin.ts →
 * discoveredGames.ts). Optional polish lives in gamesMeta.ts.
 * Add a world: drop the jsonld — it shows up.
 */
import { discoveredGames } from '$lib/engine/discoveredGames';
import { defaultRoomForGame } from '$lib/engine/net/roomUrl';
import { GAME_ORDER, GAME_OVERRIDES, SANDBOX_GAME } from '$lib/engine/gamesMeta';

export interface GameEntry {
	param?: string;
	title: string;
	description: string;
	dimensions: '2d' | '3d';
	/** Feature demos — grouped separately in the scene picker. */
	category?: 'demo';
}

const RECENT_GAMES_KEY = 'scene-selector:recent-games';
const MAX_RECENT_GAMES = 4;

function buildGamesCatalog(): GameEntry[] {
	const byParam = new Map<string, GameEntry>();

	for (const discovered of discoveredGames) {
		const override = GAME_OVERRIDES[discovered.param] ?? {};
		const entry: GameEntry = {
			param: discovered.param,
			title: override.title ?? discovered.title,
			description: override.description ?? discovered.description,
			dimensions: override.dimensions ?? discovered.dimensions
		};
		const category = Object.hasOwn(override, 'category')
			? override.category
			: discovered.category;
		if (category) entry.category = category;
		byParam.set(discovered.param, entry);
	}

	const ordered: GameEntry[] = [{ ...SANDBOX_GAME }];
	const seen = new Set<string>();

	for (const param of GAME_ORDER) {
		const entry = byParam.get(param);
		if (!entry) continue;
		ordered.push(entry);
		seen.add(param);
	}

	const rest = [...byParam.values()]
		.filter((entry) => entry.param && !seen.has(entry.param))
		.sort((a, b) => a.title.localeCompare(b.title));

	ordered.push(...rest);
	return ordered;
}

export const GAMES: GameEntry[] = buildGamesCatalog();

/** Title-case a raw `?game=` param for scenes not in the catalog. */
export function prettifyGameParam(param: string): string {
	return (
		param
			.split(/[-_/]+/)
			.filter(Boolean)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ') || param
	);
}

/**
 * Resolve a `?game=` param to a catalog entry, synthesizing a labelled entry
 * for unregistered params instead of silently falling back to the Sandbox.
 * `undefined`/empty means the default world (GAMES[0]).
 */
export function resolveGame(param?: string): GameEntry {
	if (!param) return GAMES[0];
	return (
		GAMES.find((game) => game.param === param) ?? {
			param,
			title: prettifyGameParam(param),
			description: '',
			dimensions: '3d'
		}
	);
}

export function gameUrl(param?: string): string {
	return param ? `/games/${param}.jsonld` : '/world.jsonld';
}

export function currentGameParam(): string | undefined {
	if (typeof location === 'undefined') return undefined;
	return new URLSearchParams(location.search).get('game') ?? undefined;
}

export function currentGame(): GameEntry {
	return resolveGame(currentGameParam());
}

function gameKey(param?: string): string {
	return param ?? '';
}

export function recentGameParams(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(RECENT_GAMES_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const known = new Set(GAMES.map((game) => gameKey(game.param)));
		return parsed.filter((value): value is string => typeof value === 'string' && known.has(value));
	} catch {
		return [];
	}
}

export function recentGames(): GameEntry[] {
	const byKey = new Map(GAMES.map((game) => [gameKey(game.param), game]));
	return recentGameParams()
		.map((param) => byKey.get(param))
		.filter((game): game is GameEntry => Boolean(game));
}

function rememberGame(param?: string): void {
	if (typeof localStorage === 'undefined') return;
	const key = gameKey(param);
	const next = [key, ...recentGameParams().filter((value) => value !== key)].slice(
		0,
		MAX_RECENT_GAMES
	);
	localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(next));
}

/** Navigate to a game (full reload — each game is its own multiplayer room). */
export function loadGame(param?: string) {
	if (typeof location === 'undefined') return;
	rememberGame(param);
	const url = new URL(location.href);
	if (param) url.searchParams.set('game', param);
	else url.searchParams.delete('game');
	url.searchParams.set('room', defaultRoomForGame(param ?? null));
	// Always land in edit mode when switching worlds — play is an explicit choice.
	url.searchParams.delete('play');
	url.searchParams.set('mode', 'edit');
	location.href = url.toString();
}
