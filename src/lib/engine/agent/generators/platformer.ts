import type { JsonLdDoc, JsonLdNode } from '$lib/engine/ontology/source';

/**
 * Deterministic platformer-world generator.
 *
 * Produces a rising gauntlet of shrinking platforms over an abyss, with a
 * collectible core at the summit — the same recipe as `static/games/ascent.jsonld`.
 * Pure and seedable so every client (and every rerun) agrees on the layout.
 *
 * Tuned against the engine's defaults: jump height 2, g 9.8, player speed 4,
 * airJumps 1 (a double jump is available). Step-ups under ~1.9 are cleared with a
 * single jump; taller steps force the double jump; pegs are tiny landings.
 */

export type GeneratePlatformerOptions = {
	/** Slug used for entity ids. Defaults to "ascent". */
	name?: string;
	/** Number of gauntlet platforms (3–24, ex. start/finish). Default 10. */
	steps?: number;
	/** 0–5. 0 = short single-jump hops, 5 = tall pegged double-jump gauntlet. Default 3. */
	difficulty?: number;
	/** Deterministic seed. Default 0. */
	seed?: number;
	/** Base platform color (fallback palette otherwise). */
	platformColor?: string;
	/** Core collectible color. Default "#ffd166". */
	coreColor?: string;
};

const PALETTE = ['#3a4a5a', '#3f5566', '#44515f', '#557a68', '#6c8c5a', '#7ca05a', '#9ecf8e'];

type WorldNode = JsonLdNode & Record<string, unknown>;

function clamp(value: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, value));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(a: number): () => number {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function r2(v: number): number {
	return Math.round(v * 100) / 100;
}

function platform(
	id: string,
	position: [number, number, number],
	scale: [number, number, number],
	color: string
): WorldNode {
	return {
		'@id': id,
		'@type': 'Thing',
		conformsTo: 'Platform',
		components: {
			Transform: { position },
			Render: { color }
		}
	};
}

export function generatePlatformerWorld(opts: GeneratePlatformerOptions = {}): JsonLdDoc {
	const slug = (opts.name || 'ascent').replace(/[^a-zA-Z0-9_-]/g, '-') || 'ascent';
	const steps = clamp(Math.round(opts.steps ?? 10), 3, 24);
	const difficulty = clamp(Math.round(opts.difficulty ?? 3), 0, 5);
	const seed = Math.max(0, Math.floor(opts.seed ?? 0));
	const coreColor = opts.coreColor || '#ffd166';
	const platformColor = opts.platformColor || '';

	const rand = mulberry32((seed * 2654435761) ^ (steps * 40503) ^ (difficulty * 97));

	const widthBase = lerp(1.7, 1.05, difficulty / 5);
	const gapX = lerp(2.4, 3.5, difficulty / 5);
	const amp = lerp(1.4, 3.0, difficulty / 5);
	const earlyHalf = Math.ceil(steps / 2);

	const graph: WorldNode[] = [
		{
			'@id': 'type:Platform',
			'@type': 'EntityType',
			components: ['Transform', 'Render', 'Physics'],
			defaults: {
				Render: { mesh: 'primitive:box', color: '#44525f' },
				Physics: { body: 'fixed', collider: 'box' }
			}
		},
		{
			'@id': 'type:Core',
			'@type': 'EntityType',
			components: ['Transform', 'Render', 'Collectible'],
			defaults: {
				Render: { mesh: 'primitive:sphere', color: '#ffd166' },
				Transform: { scale: [0.8, 0.8, 0.8] },
				Collectible: { radius: 1.4, value: 50 }
			},
			events: {
				collision: [
					{
						with: 'Player',
						do: [{ score: '=Collectible.value' }, { sfx: '=Collectible.sfx' }, { destroy: 'self' }]
					}
				]
			}
		},
		{
			'@id': 'entity:light/ambient',
			'@type': 'Thing',
			conformsTo: 'AmbientLight',
			components: { Light: { intensity: 0.55 } }
		},
		{
			'@id': 'entity:light/sun',
			'@type': 'Thing',
			conformsTo: 'DirectionalLight',
			components: {
				Light: { intensity: 1.1 },
				Transform: { position: { x: 12, y: 26, z: 8 } }
			}
		},
		{
			'@id': 'entity:base/start',
			'@type': 'Thing',
			conformsTo: 'Platform',
			components: {
				Transform: { position: [0, 0.5, 0], scale: [5, 1, 5] },
				Render: { color: '#2a2a33' }
			}
		},
		{
			'@id': 'entity:spawn/start',
			'@type': 'Thing',
			conformsTo: 'SpawnPoint',
			components: { Transform: { position: [0, 1.05, 0] } }
		}
	];

	let prevX = 4.0;
	let prevY = 1.2;
	let prevZ = 0;

	for (let i = 0; i < steps; i++) {
		const late = i >= earlyHalf && difficulty >= 2;
		const inc = late ? 2.1 + rand() * 0.5 : 1.0 + rand() * 0.6;
		prevY += inc;
		prevX += gapX;
		prevZ = r2(Math.sin((i + 1) * 1.7) * amp);

		let w = r2(widthBase * (1 - (i / steps) * 0.15) + (rand() - 0.5) * 0.12);
		if (difficulty >= 3 && i % 3 === 1) w = r2(w * 0.62);
		w = clamp(w, 0.85, 1.7);

		const color = platformColor || PALETTE[(i + (seed % 7)) % PALETTE.length];
		graph.push(platform(`entity:${slug}/platform/${i + 1}`, [r2(prevX), r2(prevY), prevZ], [w, 0.5, w], color));
	}

	const finishX = r2(prevX + gapX + 1.0);
	const finishY = r2(prevY + 2.0);
	const finishZ = prevZ;
	const finishColor = '#3ecf8e';

	graph.push(platform(`entity:${slug}/finish`, [finishX, finishY, finishZ], [3.2, 0.6, 3.2], finishColor));

	const finishTop = finishY + 0.3;
	const coreY = r2(finishTop + 0.9);
	const coreValue = Math.max(50, steps * 5);

	graph.push({
		'@id': `entity:${slug}/core`,
		'@type': 'Thing',
		conformsTo: 'Core',
		components: {
			Transform: { position: [finishX, coreY, finishZ] },
			Render: { color: coreColor },
			Collectible: { value: coreValue }
		}
	});

	graph.push({
		'@id': 'entity:abyss/floor',
		'@type': 'Thing',
		conformsTo: 'Platform',
		components: {
			Transform: {
				position: [r2((finishX - 10) / 2), -26, 0],
				scale: [r2(finishX + 20), 0.4, r2(amp * 2 + 14)]
			},
			Render: { color: '#08080d' }
		}
	});

	const doc: JsonLdDoc = {
		'@context': {
			'@vocab': 'https://game.example/vocab/',
			conformsTo: { '@type': '@id' },
			components: { '@type': '@json' },
			events: { '@type': '@json' }
		},
		'@graph': graph as JsonLdNode[]
	};

	return doc;
}
