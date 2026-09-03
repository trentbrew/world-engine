import { error, json } from '@sveltejs/kit';
import { generatePlatformerWorld } from '$lib/engine/agent/generators/platformer';
import { assertWorldAuthorDev } from '$lib/engine/authoring/devOnly';
import { writeWorldFile } from '$lib/engine/authoring/worldFileStore';
import { normalizeGameParam } from '$lib/engine/authoring/worldPaths';
import type { RequestHandler } from './$types';

/**
 * Generate a platforming-gauntlet world and persist it to static/games/<game>.jsonld.
 * Dev-only (world authoring mutations). Body: { steps?, difficulty?, seed?,
 * platformColor?, coreColor? }. Returns the load URL plus a small summary.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	assertWorldAuthorDev();
	const game = normalizeGameParam(params.game);
	if (!game) throw error(400, 'game is required — a slug like "ascent" or "spire".');

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

	const doc = generatePlatformerWorld({
		name: game,
		steps: asNumber(body.steps, 10),
		difficulty: asNumber(body.difficulty, 3),
		seed: asNumber(body.seed, 0),
		platformColor: asString(body.platformColor),
		coreColor: asString(body.coreColor)
	});

	await writeWorldFile(game, doc);

	const finish = doc['@graph']?.find((n) => n['@id'] === `entity:${game}/core`);
	const core = finish?.components as Record<string, Record<string, unknown>> | undefined;
	const coreValue = Number(core?.Collectible?.['value'] ?? 50);

	return json({
		ok: true,
		game,
		steps: Number(body.steps ?? 10),
		difficulty: Number(body.difficulty ?? 3),
		coreValue,
		url: `/?game=${game}`
	});
};

function asNumber(value: unknown, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}
