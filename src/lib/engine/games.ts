/**
 * Scene catalog for the nav picker and `?game=` loader.
 *
 * Worlds are auto-discovered from static/games (see gamesCatalogPlugin.ts →
 * discoveredGames.ts). Optional polish lives in gamesMeta.ts.
 * Add a world: drop the jsonld — it shows up.
 */
import { discoveredGames } from '$lib/engine/discoveredGames';
import { defaultRoomForGame } from '$lib/engine/net/roomUrl';
import {
	DEFAULT_GAME_PARAM,
	GAME_ORDER,
	GAME_OVERRIDES,
	SANDBOX_GAME
} from '$lib/engine/gamesMeta';

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

function isSandboxParam(param: string | undefined | null): boolean {
	return param === 'sandbox' || param === 'default' || param === '_';
}

function buildGamesCatalog(): GameEntry[] {
	const byParam = new Map<string, GameEntry>();

	byParam.set(SANDBOX_GAME.param, { ...SANDBOX_GAME });

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

	const ordered: GameEntry[] = [];
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
 * for unregistered params instead of silently falling back to Sandbox.
 * `undefined`/empty means the default world (`DEFAULT_GAME_PARAM`).
 */
export function resolveGame(param?: string): GameEntry {
	const key = param || DEFAULT_GAME_PARAM;
	return (
		GAMES.find((game) => game.param === key) ?? {
			param: key,
			title: prettifyGameParam(key),
			description: '',
			dimensions: '3d'
		}
	);
}

export function gameUrl(param?: string): string {
	if (!param || isSandboxParam(param)) return '/world.jsonld';
	return `/games/${param}.jsonld`;
}

export function currentGameParam(): string | undefined {
	if (typeof location === 'undefined') return DEFAULT_GAME_PARAM;
	return new URLSearchParams(location.search).get('game') ?? DEFAULT_GAME_PARAM;
}

/** Add `?game=` when missing so the default world is explicit in the URL. */
export function ensureGameInUrl(): string {
	if (typeof location === 'undefined') return DEFAULT_GAME_PARAM;

	const url = new URL(location.href);
	const existing = url.searchParams.get('game');
	if (existing) return existing;

	url.searchParams.set('game', DEFAULT_GAME_PARAM);
	history.replaceState(history.state, '', url);
	return DEFAULT_GAME_PARAM;
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
	const next = param || DEFAULT_GAME_PARAM;
	rememberGame(next);
	const url = new URL(location.href);
	url.searchParams.set('game', next);
	url.searchParams.set('room', defaultRoomForGame(next));
	// Always land in edit mode when switching worlds — play is an explicit choice.
	url.searchParams.delete('play');
	url.searchParams.set('mode', 'edit');
	location.href = url.toString();
}
