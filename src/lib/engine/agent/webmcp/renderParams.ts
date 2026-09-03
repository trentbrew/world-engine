/**
 * Agent-facing view of the stylized-render param bags.
 *
 * GrassField, Water and Terrain each hide most of their knobs behind a single
 * `json` field (`params`, or `grass` / `grass.params` for Terrain). To an agent
 * calling describe_component those read as `params: json, optional` — 98 grass
 * knobs, 24 water knobs and the whole terrain grass overlay, all invisible, with
 * no way to learn a key name and no way to set one without rewriting the bag.
 *
 * This module is the missing half: it flattens those bags into descriptors an
 * agent can list, filter and validate against. `GRASS_PARAM_META` already carries
 * label/group/min/max/step, so grass is exposed at full fidelity; water has only
 * a defaults object upstream, so its descriptors carry type and default and
 * honestly omit ranges rather than inventing them.
 *
 * Keys are unique across bags (checked: no curated/param collision), so a bare
 * key name is enough to address a value — an agent never has to spell out a path.
 */
import {
	GRASS_DEFAULTS,
	GRASS_PARAM_META,
	GRASS_PARAM_KEYS,
	type GrassParamKey
} from '$lib/engine/render/grass/params';
import { WATER_DEFAULTS } from '$lib/engine/render/water/waterSurface';

export type RenderParamType = 'number' | 'boolean' | 'string' | 'color';

export type RenderParamDescriptor = {
	key: string;
	type: RenderParamType;
	default: unknown;
	min?: number;
	max?: number;
	step?: number;
	group?: string;
	label?: string;
	/** Changing this respawns instance geometry instead of moving a live uniform. */
	rebuilds?: boolean;
	/** Where the value lives inside the component bag, e.g. ['params', 'flSize']. */
	path: string[];
};

function inferType(value: unknown): RenderParamType {
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)) return 'color';
	return 'string';
}

/** The 98 grass knobs, at whatever path the owning component keeps them. */
function grassParams(prefix: string[]): RenderParamDescriptor[] {
	return GRASS_PARAM_KEYS.map((key) => {
		const meta = GRASS_PARAM_META[key as GrassParamKey] as {
			min?: number;
			max?: number;
			step?: number;
			label?: string;
			group?: string;
			rebuilds?: boolean;
		};
		const value = GRASS_DEFAULTS[key as GrassParamKey];
		return {
			key,
			type: inferType(value),
			default: value,
			min: meta.min,
			max: meta.max,
			step: meta.step,
			group: meta.group,
			label: meta.label,
			rebuilds: meta.rebuilds === true,
			path: [...prefix, key]
		};
	});
}

/**
 * Terrain's grass overlay mirrors GrassField's curated fields. Declared here
 * rather than derived, because TerrainView reads them as a plain inline type —
 * there is no schema object to reflect over.
 */
const TERRAIN_GRASS_CURATED: Array<[string, unknown, string?]> = [
	['enabled', false],
	['preset', 'default'],
	['density', 120],
	['maxCount', 24000],
	['bladeMinLength', 0.15],
	['bladeMaxLength', 0.25],
	['colorBottom', '#4f7c13'],
	['colorTop', '#79a01c'],
	['windStrength', 0.1],
	['windDirection', 243],
	['windSpeed', 1.3],
	['stillInEdit', true],
	['flowers', false]
];

export type RenderParamTarget = {
	component: string;
	summary: string;
	params: RenderParamDescriptor[];
};

export const RENDER_PARAM_TARGETS: Record<string, RenderParamTarget> = {
	GrassField: {
		component: 'GrassField',
		summary: 'Instanced grass: blades, flowers, wind, trampling, ground blend.',
		params: grassParams(['params'])
	},
	Water: {
		component: 'Water',
		summary: 'Cel-shaded Voronoi surface: cell pattern, flow, colour ramp, ripples.',
		params: Object.entries(WATER_DEFAULTS).map(([key, value]) => ({
			key,
			type: inferType(value),
			default: value,
			group: key.startsWith('ripple') ? 'Ripples' : 'Surface',
			path: ['params', key]
		}))
	},
	Terrain: {
		component: 'Terrain',
		summary:
			'Heightmap grass overlay. Core terrain shape (size, heightScale, seed, colours) are ordinary fields — use set_entity_field for those.',
		params: [
			...TERRAIN_GRASS_CURATED.map(([key, value]) => ({
				key: String(key),
				type: inferType(value),
				default: value,
				group: 'Overlay',
				path: ['grass', String(key)]
			})),
			...grassParams(['grass', 'params'])
		]
	}
};

/** Every component that has a param bag, for error messages. */
export const RENDER_PARAM_COMPONENTS = Object.keys(RENDER_PARAM_TARGETS);

/**
 * Find a param by bare key across the components an entity actually carries.
 * Returns every match so an ambiguous key reports all candidates rather than
 * silently writing to whichever bag happened to be checked first.
 */
export function findRenderParams(
	key: string,
	components: string[]
): Array<{ component: string; descriptor: RenderParamDescriptor }> {
	const out: Array<{ component: string; descriptor: RenderParamDescriptor }> = [];
	for (const name of components) {
		const target = RENDER_PARAM_TARGETS[name];
		if (!target) continue;
		const descriptor = target.params.find((p) => p.key === key);
		if (descriptor) out.push({ component: name, descriptor });
	}
	return out;
}

/**
 * Coerce and range-check a value for one param.
 * Out-of-range is rejected, not clamped: an agent that asked for flSize 50 has a
 * wrong model of the units, and silently storing 3 teaches it the request worked.
 */
export function validateRenderParam(
	descriptor: RenderParamDescriptor,
	raw: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
	if (descriptor.type === 'boolean') {
		if (typeof raw === 'boolean') return { ok: true, value: raw };
		if (raw === 'true' || raw === 'false') return { ok: true, value: raw === 'true' };
		return { ok: false, error: `${descriptor.key} is a boolean.` };
	}
	if (descriptor.type === 'number') {
		const n = Number(raw);
		if (!Number.isFinite(n)) return { ok: false, error: `${descriptor.key} is a number.` };
		if (descriptor.min !== undefined && n < descriptor.min) {
			return { ok: false, error: `${descriptor.key} min is ${descriptor.min}, got ${n}.` };
		}
		if (descriptor.max !== undefined && n > descriptor.max) {
			return { ok: false, error: `${descriptor.key} max is ${descriptor.max}, got ${n}.` };
		}
		return { ok: true, value: n };
	}
	if (descriptor.type === 'color') {
		const s = String(raw);
		if (!/^#[0-9a-f]{3,8}$/i.test(s)) {
			return { ok: false, error: `${descriptor.key} is a hex colour like "#79a01c".` };
		}
		return { ok: true, value: s };
	}
	return { ok: true, value: String(raw) };
}

/** Immutably merge `value` into a component bag at `path`, creating gaps as needed. */
export function setAtPath(
	bag: Record<string, unknown>,
	path: string[],
	value: unknown
): Record<string, unknown> {
	if (path.length === 0) return bag;
	const [head, ...rest] = path;
	if (rest.length === 0) return { ...bag, [head]: value };
	const child = bag[head];
	const nested = child && typeof child === 'object' && !Array.isArray(child) ? child : {};
	return { ...bag, [head]: setAtPath(nested as Record<string, unknown>, rest, value) };
}

/** Read the current value at `path`, or undefined when unset (i.e. still the default). */
export function readAtPath(bag: Record<string, unknown>, path: string[]): unknown {
	let cursor: unknown = bag;
	for (const step of path) {
		if (!cursor || typeof cursor !== 'object') return undefined;
		cursor = (cursor as Record<string, unknown>)[step];
	}
	return cursor;
}
