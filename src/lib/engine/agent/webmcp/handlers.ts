/**
 * WebMCP tool handlers — shared by the browser registration layer and headless
 * room agents (MCP stdio). Every write goes through `world.*` so edits replicate
 * to relay peers when a session is connected.
 *
 * This module must stay importable from Node: the headless MCP server loads it
 * without a DOM. Tools that drive editor chrome (mode, camera, scene settings)
 * therefore reach `ui` and the viewport through `browserOnly()`, a lazy dynamic
 * import that degrades to a clear message instead of a module-load crash.
 */
import { fetchAssets, type AssetKind } from '$lib/assets/catalog';
import { SHAPE_CATALOG } from '$lib/assets/shapes';
import { editHistory } from '$lib/engine/authoring/editHistory.svelte';
import {
	getComponent,
	getType,
	isBuiltinComponent,
	isCollection,
	listCollections,
	listComponents,
	listObjectTypes,
	listTypes
} from '$lib/engine/ontology/registry';
import { getRoomCatalog, normalizeRoomId } from '$lib/engine/ontology/roomCatalog';
import type {
	ComponentData,
	EntityEvents,
	Entity,
	FieldSchema
} from '$lib/engine/ontology/schema';
import { world } from '$lib/engine/runtime/world.svelte';
import type { SceneStyle } from '$lib/scene/artStyles';

/** Chrome's recommended per-output ceiling (docs/webmcp.md). */
export const MAX_OUTPUT_CHARS = 1500;
const DEFAULT_LIMIT = 20;
const MAX_FIELD_CHARS = 120;

export type ToolExecute = (
	input: Record<string, unknown>,
	options: { signal: AbortSignal }
) => Promise<unknown>;

/** Clamp a tool result to the output budget, telling the agent what was cut. */
export function clamp(text: string, more?: { shown: number; total: number }): string {
	let out = text;
	if (more && more.total > more.shown) {
		out += `\n… ${more.total - more.shown} more, use offset=${more.shown}`;
	}
	if (out.length <= MAX_OUTPUT_CHARS) return out;
	return `${out.slice(0, MAX_OUTPUT_CHARS - 24).trimEnd()}\n… truncated, narrow the query`;
}

function fail(message: string): string {
	return `Error: ${message}`;
}

function nameList(names: string[], cap = 12): string {
	const head = names.slice(0, cap).join(', ');
	return names.length > cap ? `${head}, … (${names.length} total)` : head;
}

function editDistance(a: string, b: string): number {
	const x = a.toLowerCase();
	const y = b.toLowerCase();
	let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
	for (let i = 1; i <= x.length; i++) {
		const row = [i];
		for (let j = 1; j <= y.length; j++) {
			const cost = x[i - 1] === y[j - 1] ? 0 : 1;
			row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
		}
		prev = row;
	}
	return prev[y.length];
}

function suggestList(attempted: string, candidates: string[], cap = 12): string {
	const ranked = [...candidates].sort(
		(a, b) => editDistance(attempted, a) - editDistance(attempted, b)
	);
	return nameList(ranked, cap);
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return String(value);
	if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
	if (typeof value === 'boolean') return String(value);
	if (typeof value === 'string') {
		return value.length > MAX_FIELD_CHARS ? `"${value.slice(0, MAX_FIELD_CHARS)}…"` : `"${value}"`;
	}
	if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
		return `[${value.map((v) => (Number.isInteger(v) ? v : Number(v).toFixed(2))).join(', ')}]`;
	}
	const json = JSON.stringify(value);
	if (!json) return '<unserializable>';
	return json.length > MAX_FIELD_CHARS ? `<${typeof value}, ${json.length} chars>` : json;
}

function positionOf(entity: Entity): string {
	const pos = entity.components.Transform?.position;
	return Array.isArray(pos) ? formatValue(pos) : '—';
}

function page<T>(items: T[], input: Record<string, unknown>): { slice: T[]; offset: number } {
	const offset = Math.max(0, Number(input.offset ?? 0) || 0);
	const rawLimit = Number(input.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
	const limit = Math.min(100, Math.max(1, rawLimit));
	return { slice: items.slice(offset, offset + limit), offset };
}

function describeFieldLine(name: string, schema: FieldSchema): string {
	const bits: string[] = [schema.t];
	if (schema.sync && schema.sync !== 'durable') bits.push(schema.sync);
	if (schema.options?.length) bits.push(`one of ${schema.options.join('|')}`);
	if (schema.optional) bits.push('optional');
	if (schema.default !== undefined) bits.push(`default ${formatValue(schema.default)}`);
	return `  ${name}: ${bits.join(', ')}`;
}

/** Resolve an entity or explain why it could not be found. */
function requireEntity(id: string): Entity | string {
	const entity = world.getEntity(id);
	if (!entity) return fail(`No entity "${id}". Use list_entities to find valid ids.`);
	return entity;
}

const isError = (v: unknown): v is string => typeof v === 'string';

/**
 * Coerce agent input into a `FieldSchema`, rejecting unknown types up front so
 * the agent gets a legible message rather than a silently malformed schema.
 */
const FIELD_TYPES = new Set([
	'number',
	'string',
	'longtext',
	'boolean',
	'select',
	'vec2',
	'vec3',
	'quat',
	'color',
	'ref',
	'json'
]);

function parseFieldSpec(raw: unknown): FieldSchema | string {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return fail('spec must be an object, e.g. {"t":"number","default":0}.');
	}
	const spec = raw as Record<string, unknown>;
	const t = String(spec.t ?? '');
	if (!FIELD_TYPES.has(t)) {
		return fail(`spec.t must be one of: ${[...FIELD_TYPES].join(', ')}.`);
	}
	const out: FieldSchema = { t: t as FieldSchema['t'] };
	if (spec.default !== undefined) out.default = spec.default;
	if (spec.optional === true) out.optional = true;
	if (Array.isArray(spec.options)) out.options = spec.options.map(String);
	if (t === 'select' && !out.options?.length) {
		return fail('A select field needs a non-empty options array.');
	}
	return out;
}

function parseEventsInput(raw: unknown): EntityEvents | string {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return fail('events must be an object keyed by trigger, e.g. {"step": [{"set": …}]}.');
	}
	return raw as EntityEvents;
}

/**
 * Load a browser-only module, or return a message explaining the tool needs a
 * live editor. Keeps the headless MCP path from importing scene/DOM code.
 */
async function browserOnly<T>(load: () => Promise<T>, what: string): Promise<T | string> {
	if (typeof document === 'undefined') {
		return fail(`${what} needs a live editor page; this session is headless.`);
	}
	return load();
}

const uiModule = () => import('$lib/ui/ui.svelte');
const focusModule = () => import('$lib/scene/focusEntity');

/** Post-processing groups on `SceneStyle`, each a bag of knobs behind `enabled`. */
const EFFECT_GROUPS = ['fog', 'bloom', 'vignette', 'grain', 'outline', 'sketch'] as const;
const TONE_MAPPINGS = ['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral'];

function describeEffectGroup(group: Record<string, unknown>): string {
	return Object.entries(group)
		.map(([knob, v]) => `${knob}=${formatValue(v)}`)
		.join(' ');
}

/**
 * Merge agent input into one effect group. `true`/`false` toggles it; an object
 * sets named knobs (and implies `enabled` unless the agent says otherwise), so
 * "turn on fog" and "make the fog purple and close" are both one call.
 */
function applyEffectKnobs(
	group: Record<string, unknown>,
	value: unknown,
	name: string
): string {
	if (typeof value === 'boolean' || value === 'true' || value === 'false') {
		group.enabled = value === true || value === 'true';
		return describeEffectGroup(group);
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return fail(`${name} takes true/false or an object of knobs: ${Object.keys(group).join(', ')}.`);
	}

	const patch = value as Record<string, unknown>;
	const unknown = Object.keys(patch).filter((knob) => !(knob in group));
	if (unknown.length > 0) {
		return fail(
			`${name} has no knob "${unknown[0]}". Knobs: ${suggestList(unknown[0], Object.keys(group))}`
		);
	}
	for (const [knob, v] of Object.entries(patch)) {
		group[knob] = typeof group[knob] === 'number' ? Number(v) : v;
	}
	if (!('enabled' in patch)) group.enabled = true;
	return describeEffectGroup(group);
}

export const WEBMCP_HANDLERS: Record<string, ToolExecute> = {
	// ---- read: world -------------------------------------------------------

	async list_entities(input) {
		const component = typeof input.component === 'string' ? input.component : null;
		const type = typeof input.type === 'string' ? input.type : null;

		let matches = world.entities;
		if (component) matches = matches.filter((e) => component in e.components);
		if (type) matches = matches.filter((e) => e.type === type);

		if (matches.length === 0) {
			const filters = [component && `component ${component}`, type && `type ${type}`]
				.filter(Boolean)
				.join(' and ');
			return filters
				? `No entities match ${filters}. ${world.entities.length} entities in the world.`
				: 'The world is empty.';
		}

		const { slice, offset } = page(matches, input);
		const rows = slice.map((e) => `${e.id}  ${e.type ?? '—'}  ${positionOf(e)}`);
		return clamp(`${matches.length} entities:\n${rows.join('\n')}`, {
			shown: offset + slice.length,
			total: matches.length
		});
	},

	async describe_entity(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;

		const lines = [`${entity.id}  type: ${entity.type ?? '—'}`];
		for (const [component, bag] of Object.entries(entity.components)) {
			lines.push(`${component}:`);
			for (const [field, value] of Object.entries(bag)) {
				lines.push(`  ${field} = ${formatValue(value)}`);
			}
		}
		if (entity.events) {
			lines.push(`events: ${Object.keys(entity.events).join(', ')}`);
		}
		return clamp(lines.join('\n'));
	},

	async world_status() {
		const lines: string[] = [];

		const ui = await browserOnly(uiModule, 'world_status').catch(() => null);
		if (ui && typeof ui !== 'string') {
			const paused = ui.ui.shellMode === 'play' && ui.ui.playPaused;
			lines.push(`mode: ${ui.ui.shellMode}${paused ? ' (paused)' : ''}`);
		} else {
			lines.push('mode: headless');
		}

		const catalog = getRoomCatalog();
		if (catalog) {
			lines.push(`room: ${world.activeRoomId ?? catalog.startRoomId} of ${catalog.rooms.size}`);
		}

		const player = world.localPlayerEntity;
		lines.push(
			player
				? `player: ${player.id} at ${positionOf(player)}`
				: 'player: none (call get_player after play starts)'
		);

		lines.push(`selection: ${world.selection ?? 'none'}`);
		lines.push(`entities: ${world.entities.length}`);
		lines.push(
			`types: ${listObjectTypes().length} objects, ${listCollections().length} collections`
		);
		lines.push(`components: ${listComponents().length}`);
		lines.push(`undo: ${editHistory.canUndo ? 'available' : 'empty'}`);
		lines.push(`redo: ${editHistory.canRedo ? 'available' : 'empty'}`);
		if (world.status !== 'ready') lines.push(`status: ${world.status}`);
		return clamp(lines.join('\n'));
	},

	async get_player() {
		const player = world.localPlayerEntity;
		if (!player) {
			return fail(
				'No local player yet. Enter play mode or wait for the session to connect, then call get_player again.'
			);
		}

		const lines = [`id: ${player.id}`];
		const pos = player.components.Transform?.position;
		if (Array.isArray(pos)) lines.push(`position: ${formatValue(pos)}`);
		const rot = player.components.Transform?.rotation;
		if (Array.isArray(rot)) lines.push(`rotation: ${formatValue(rot)}`);
		if (world.activeRoomId) lines.push(`room: ${world.activeRoomId}`);
		return clamp(lines.join('\n'));
	},

	async list_rooms() {
		const catalog = getRoomCatalog();
		if (!catalog) return 'This world has no room catalog — it is a single scene.';

		const active = world.activeRoomId ?? catalog.startRoomId;
		const rows = [...catalog.rooms.values()].map((room) => {
			const count = catalog.byRoom.get(room.id)?.length ?? 0;
			const marks = [
				room.id === catalog.startRoomId ? 'start' : null,
				room.id === active ? 'active' : null
			].filter(Boolean);
			const suffix = marks.length ? `  (${marks.join(', ')})` : '';
			return `${room.id}  ${room.title ?? '—'}  ${count} entities${suffix}`;
		});
		return clamp(
			`${catalog.rooms.size} rooms, ${catalog.globals.length} global entities:\n${rows.join('\n')}`
		);
	},

	async get_scene() {
		const mod = await browserOnly(uiModule, 'get_scene');
		if (isError(mod)) return mod;
		const scene = mod.ui.scene;
		const style = scene.style;
		const lines = [
			`name: ${scene.displayName}`,
			`background: ${scene.background}`,
			`shadows: ${scene.shadows}`,
			`grid: ${scene.groundGrid.enabled}`,
			`sky: ${scene.sky.enabled ? scene.sky.preset : 'off'}`,
			`artStyle: ${style.artStyle}`,
			`toneMapping: ${style.toneMapping}`,
			`exposure: ${formatValue(style.exposure)}`
		];
		for (const group of EFFECT_GROUPS) {
			lines.push(`${group}: ${describeEffectGroup(style[group] as Record<string, unknown>)}`);
		}
		return clamp(lines.join('\n'));
	},

	// ---- read: ontology ----------------------------------------------------

	async list_types(input) {
		const kind = typeof input.kind === 'string' ? input.kind : 'all';
		const names =
			kind === 'objects' ? listObjectTypes() : kind === 'collections' ? listCollections() : listTypes();
		if (names.length === 0) return `No ${kind === 'all' ? '' : `${kind} `}types are registered.`;

		const { slice, offset } = page(names, { ...input, limit: input.limit ?? 100 });
		const rows = slice.map((name) => {
			const type = getType(name);
			const tag = isCollection(name) ? ' [collection]' : '';
			return `${name}${tag}: ${type ? nameList(type.components, 8) : '—'}`;
		});
		return clamp(`${names.length} types:\n${rows.join('\n')}`, {
			shown: offset + slice.length,
			total: names.length
		});
	},

	async describe_type(input) {
		const name = String(input.type ?? '');
		const type = getType(name);
		if (!type) return fail(`No type "${name}". Closest: ${suggestList(name, listTypes())}`);

		const instances = world.entities.filter((e) => e.type === name).length;
		const lines = [
			`${name}${type.collection ? ' [collection]' : ''}  ${instances} instances`,
			`components: ${nameList(type.components, 16)}`
		];
		for (const component of type.components) {
			const schema = getComponent(component);
			if (!schema) continue;
			const bag = type.defaults?.[component];
			const fields = Object.keys(schema.fields).map((field) => {
				const value = bag && field in bag ? bag[field] : schema.fields[field]?.default;
				return `  ${field} = ${formatValue(value)}`;
			});
			if (fields.length === 0) continue;
			lines.push(`${component}:`, ...fields);
		}
		if (type.events) lines.push(`events: ${Object.keys(type.events).join(', ')}`);
		return clamp(lines.join('\n'));
	},

	async list_components(input) {
		const kind = typeof input.kind === 'string' ? input.kind : 'all';
		let names = listComponents();
		if (kind === 'builtin') names = names.filter(isBuiltinComponent);
		if (kind === 'authored') names = names.filter((n) => !isBuiltinComponent(n));
		if (names.length === 0) return `No ${kind === 'all' ? '' : `${kind} `}components are registered.`;

		const { slice, offset } = page(names, { ...input, limit: input.limit ?? 100 });
		const rows = slice.map((name) => {
			const schema = getComponent(name);
			const tag = isBuiltinComponent(name) ? 'builtin ' : 'authored';
			const fields = schema ? Object.keys(schema.fields) : [];
			return `${name}  ${tag}  ${nameList(fields, 8) || '—'}`;
		});
		return clamp(`${names.length} components:\n${rows.join('\n')}`, {
			shown: offset + slice.length,
			total: names.length
		});
	},

	async describe_component(input) {
		const name = String(input.component ?? '');
		const schema = getComponent(name);
		if (!schema) {
			return fail(`No component "${name}". Closest: ${suggestList(name, listComponents())}`);
		}
		const editable = isBuiltinComponent(name) ? 'built-in, schema is fixed' : 'world-authored, editable';
		const fields = Object.entries(schema.fields).map(([f, s]) => describeFieldLine(f, s));
		if (fields.length === 0) return `${name} (${editable}) has no fields.`;
		return clamp(`${name} (${editable}) fields:\n${fields.join('\n')}`);
	},

	async list_assets(input) {
		const kind = (typeof input.kind === 'string' ? input.kind : 'models') as AssetKind | 'shapes';
		const search = typeof input.search === 'string' ? input.search.toLowerCase() : null;

		// Primitives are placeable but live outside the uploaded-asset catalog;
		// fold them into `models` so one lookup covers everything spawnable.
		const shapes = SHAPE_CATALOG.map((shape) => ({
			kind: 'shapes' as const,
			name: shape.label,
			url: shape.mesh
		}));

		let matches: { kind: string; name: string; url: string }[] = [];
		if (kind === 'shapes' || kind === 'models') matches = [...shapes];
		if (kind !== 'shapes') {
			try {
				const assets = await fetchAssets();
				matches = [...matches, ...assets.filter((a) => a.kind === kind)];
			} catch (err) {
				if (matches.length === 0) {
					return fail(`Could not load the asset catalog: ${(err as Error).message}`);
				}
			}
		}

		if (search) matches = matches.filter((a) => a.name.toLowerCase().includes(search));
		if (matches.length === 0) {
			return search ? `No ${kind} assets match "${search}".` : `No ${kind} assets are available.`;
		}

		const { slice, offset } = page(matches, input);
		const rows = slice.map((a) => `${a.name}  ${a.url}`);
		return clamp(`${matches.length} ${kind}:\n${rows.join('\n')}`, {
			shown: offset + slice.length,
			total: matches.length
		});
	},

	async list_records(input) {
		const collection = String(input.collection ?? '');
		if (!isCollection(collection)) {
			return fail(`No collection "${collection}". Collections: ${nameList(listCollections()) || 'none'}`);
		}
		const records = world.recordsFor(collection);
		if (records.length === 0) return `${collection} has no records.`;

		const { slice, offset } = page(records, input);
		const rows = slice.map((record) => {
			const values = Object.values(record.components)
				.flatMap((bag) => Object.entries(bag))
				.map(([field, value]) => `${field}=${formatValue(value)}`);
			return `${record.id}  ${nameList(values, 8)}`;
		});
		return clamp(`${records.length} ${collection} records:\n${rows.join('\n')}`, {
			shown: offset + slice.length,
			total: records.length
		});
	},

	async get_entity_json(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;
		return clamp(world.entityJsonString(entity.id));
	},

	// ---- write: spawn ------------------------------------------------------

	async spawn_prop(input) {
		const mesh = String(input.mesh ?? '');
		const position = input.position as [number, number, number];
		if (!Array.isArray(position) || position.length !== 3) {
			return fail('position must be [x, y, z].');
		}
		const entity = world.createProp({
			mesh,
			position,
			anchor: input.anchor as 'origin' | 'bottom' | 'center' | undefined,
			label: typeof input.label === 'string' ? input.label : undefined
		});
		if (!entity) return fail(`Could not place "${mesh}". Check the mesh ref with list_assets.`);

		// createProp takes no styling; apply the extras through the normal write
		// path so they replicate and land in undo history like any other edit.
		const extras: string[] = [];
		if (typeof input.color === 'string') {
			world.setField(entity.id, 'Render', 'color', input.color);
			extras.push(`color ${input.color}`);
		}
		if (Array.isArray(input.scale) && input.scale.length === 3) {
			world.setField(entity.id, 'Transform', 'scale', input.scale);
			extras.push(`scale ${formatValue(input.scale)}`);
		}
		const suffix = extras.length ? `, ${extras.join(', ')}` : '';
		return `Placed ${entity.id} at ${formatValue(position)}${suffix}.`;
	},

	async spawn_character(input) {
		const mesh = String(input.mesh ?? '');
		const position = input.position as [number, number, number];
		if (!Array.isArray(position) || position.length !== 3) {
			return fail('position must be [x, y, z].');
		}
		const entity = world.createCharacter({
			mesh,
			position,
			anchor: input.anchor as 'origin' | 'bottom' | 'center' | undefined,
			label: typeof input.label === 'string' ? input.label : undefined
		});
		if (!entity) return fail(`Could not place "${mesh}". Check the url with list_assets.`);
		return `Placed character ${entity.id} at ${formatValue(position)}.`;
	},

	async spawn_from_type(input) {
		const typeName = String(input.type ?? '');
		if (!getType(typeName)) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		if (isCollection(typeName)) {
			return fail(`${typeName} is a collection — use create_record instead.`);
		}
		const position = Array.isArray(input.position) && input.position.length === 3
			? (input.position as [number, number, number])
			: undefined;
		const suffix = typeof input.suffix === 'string' ? input.suffix : undefined;

		const entity = world.spawnFromType(typeName, { position, suffix });
		if (!entity) {
			return fail(
				suffix
					? `Could not spawn ${typeName}: an entity with suffix "${suffix}" already exists.`
					: `Could not spawn ${typeName}.`
			);
		}
		return `Spawned ${entity.id} at ${positionOf(entity)}.`;
	},

	async duplicate_entity(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;

		const before = new Set(world.entities.map((e) => e.id));
		world.select(entity.id);
		if (!world.copySelection()) return fail(`Could not copy ${entity.id}.`);
		if (!world.pasteClipboard()) return fail(`Could not paste a copy of ${entity.id}.`);

		const created = world.entities.find((e) => !before.has(e.id));
		if (!created) return fail(`Duplicated ${entity.id}, but could not identify the copy.`);
		return `Duplicated ${entity.id} as ${created.id} at ${positionOf(created)}.`;
	},

	async remove_entity(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;
		if (!world.canDeleteEntity(entity.id)) {
			return fail(`${entity.id} cannot be deleted — it is ground, a player, or the local avatar.`);
		}

		const previous = world.selection;
		world.select(entity.id);
		const removed = world.deleteSelection();
		if (!removed) {
			world.select(previous);
			return fail(`Could not delete ${entity.id}.`);
		}
		return `Removed ${entity.id}.`;
	},

	// ---- write: entity -----------------------------------------------------

	async set_entity_field(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;
		const id = entity.id;
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');

		const bag = entity.components[component];
		if (!bag) {
			return fail(
				`${id} has no component "${component}". It carries: ${suggestList(component, Object.keys(entity.components))}`
			);
		}
		if (!(field in bag)) {
			return fail(
				`${component} on ${id} has no field "${field}". Fields: ${suggestList(field, Object.keys(bag))}`
			);
		}

		world.setField(id, component, field, input.value);
		const applied = world.getEntity(id)?.components[component]?.[field];
		return `${id}.${component}.${field} = ${formatValue(applied)}`;
	},

	async add_entity_component(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;
		const component = String(input.component ?? '');

		if (!getComponent(component)) {
			return fail(`No component "${component}". Closest: ${suggestList(component, listComponents())}`);
		}
		if (entity.components[component]) {
			return fail(`${entity.id} already carries ${component}.`);
		}
		if (!world.addComponent(entity.id, component)) {
			const addable = world.addableComponents(entity.id);
			return fail(
				`${entity.id} cannot take "${component}". It can take: ${nameList(addable) || 'nothing further'}`
			);
		}
		const bag = world.getEntity(entity.id)?.components[component] ?? {};
		return `${entity.id} now carries ${component}: ${nameList(Object.keys(bag), 10) || 'no fields'}.`;
	},

	async remove_entity_component(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;
		const component = String(input.component ?? '');

		if (!entity.components[component]) {
			return fail(
				`${entity.id} does not carry "${component}". It carries: ${suggestList(component, Object.keys(entity.components))}`
			);
		}
		if (!world.removeComponent(entity.id, component)) {
			return fail(`${component} cannot be removed from ${entity.id} — the entity requires it.`);
		}
		return `Removed ${component} from ${entity.id}.`;
	},

	async set_entity_json(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;

		const data = input.data;
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			return fail('data must be an object keyed by component name. Read it with get_entity_json.');
		}

		// Accept both shapes: the document get_entity_json returns (with its
		// `components` wrapper and `conformsTo`), and a bare component map, which
		// is what an agent writing one from scratch will reach for.
		const doc = data as Record<string, unknown>;
		const wrapped =
			doc.components && typeof doc.components === 'object' && !Array.isArray(doc.components)
				? { ...doc, '@id': entity.id }
				: { '@id': entity.id, components: doc };

		const result = world.applyEntityJson(entity.id, JSON.stringify(wrapped));
		if (!result.ok) return fail(result.error);

		const components = Object.keys(world.getEntity(entity.id)?.components ?? {});
		return `${entity.id} now carries ${nameList(components, 12)}.`;
	},

	async set_entity_events(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;

		const events = parseEventsInput(input.events);
		if (isError(events)) return events;

		world.setEvents(entity.id, events);
		const triggers = Object.keys(events);
		return triggers.length === 0
			? `Cleared all handlers on ${entity.id}.`
			: `${entity.id} now handles: ${triggers.join(', ')}.`;
	},

	async save_entity_as_type(input) {
		const entity = requireEntity(String(input.entityId ?? ''));
		if (isError(entity)) return entity;

		const name = String(input.name ?? '');
		const applyToEntity = input.applyToEntity !== false;
		const result = world.saveAsType(entity.id, { name, applyToEntity });
		if (!result.ok) return fail(result.error);

		const type = getType(name);
		const applied = applyToEntity ? ` ${entity.id} is now a ${name}.` : '';
		return `Saved ${entity.id} as type ${name} with ${type ? nameList(type.components, 8) : 'no components'}.${applied}`;
	},

	// ---- write: types ------------------------------------------------------

	async define_type(input) {
		const name = String(input.name ?? '');
		const cloneFrom = typeof input.cloneFrom === 'string' ? input.cloneFrom : undefined;
		if (cloneFrom && !getType(cloneFrom)) {
			return fail(`No type "${cloneFrom}" to clone. Closest: ${suggestList(cloneFrom, listTypes())}`);
		}
		const result = world.createObjectType(name, cloneFrom ? { cloneFrom } : {});
		if (!result.ok) return fail(result.error);
		const type = getType(name);
		return `Defined type ${name} with ${type ? nameList(type.components, 8) : 'no components'}.`;
	},

	async add_type_component(input) {
		const typeName = String(input.type ?? '');
		const component = String(input.component ?? '');
		if (!getType(typeName)) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		if (!getComponent(component)) {
			return fail(`No component "${component}". Closest: ${suggestList(component, listComponents())}`);
		}
		if (!world.addTypeComponent(typeName, component)) {
			const addable = world.addableTypeComponents(typeName);
			return fail(
				`${typeName} cannot take "${component}". It can take: ${nameList(addable) || 'nothing further'}`
			);
		}
		return `${typeName} now carries ${component}.`;
	},

	async remove_type_component(input) {
		const typeName = String(input.type ?? '');
		const component = String(input.component ?? '');
		const type = getType(typeName);
		if (!type) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		if (!type.components.includes(component)) {
			return fail(
				`${typeName} does not carry "${component}". It carries: ${suggestList(component, type.components)}`
			);
		}
		if (!world.removeTypeComponent(typeName, component)) {
			return fail(`${component} cannot be removed from ${typeName} — the type requires it.`);
		}
		return `${typeName} no longer carries ${component}.`;
	},

	async set_type_default(input) {
		const typeName = String(input.type ?? '');
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');

		const type = getType(typeName);
		if (!type) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		if (!type.components.includes(component)) {
			return fail(
				`${typeName} does not carry "${component}". It carries: ${suggestList(component, type.components)}`
			);
		}
		const schema = getComponent(component);
		if (!schema?.fields[field]) {
			return fail(
				`${component} has no field "${field}". Fields: ${suggestList(field, Object.keys(schema?.fields ?? {}))}`
			);
		}
		if (!world.setTypeDefault(typeName, component, field, input.value)) {
			return fail(`${typeName}.${component}.${field} cannot be changed — it is engine-managed.`);
		}
		const applied = world.typeDefaultValue(typeName, component, field);
		return `${typeName}.${component}.${field} defaults to ${formatValue(applied)}.`;
	},

	async set_type_events(input) {
		const typeName = String(input.type ?? '');
		if (!getType(typeName)) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		const events = parseEventsInput(input.events);
		if (isError(events)) return events;

		if (!world.setTypeEvents(typeName, events)) {
			return fail(`${typeName} is a built-in type — its behaviour cannot be changed.`);
		}
		const triggers = Object.keys(events);
		return triggers.length === 0
			? `Cleared all handlers on ${typeName}.`
			: `${typeName} instances now handle: ${triggers.join(', ')}.`;
	},

	async add_type_field(input) {
		const typeName = String(input.type ?? '');
		if (!getType(typeName)) {
			return fail(`No type "${typeName}". Closest: ${suggestList(typeName, listTypes())}`);
		}
		const spec = parseFieldSpec(input.spec);
		if (isError(spec)) return spec;

		const result = world.addTypeField(typeName, {
			field: String(input.field ?? ''),
			spec,
			component: typeof input.component === 'string' ? input.component : undefined,
			newComponent: typeof input.newComponent === 'string' ? input.newComponent : undefined
		});
		if (!result.ok) {
			const editable = world.editableComponentsForType(typeName);
			const hint = editable.length > 1 ? ` Choose one of: ${nameList(editable)}` : '';
			return fail(`${result.error}.${hint}`);
		}
		return `${typeName}.${result.component}.${input.field} added as ${spec.t}.`;
	},

	// ---- write: component schemas ------------------------------------------

	async define_component(input) {
		const name = String(input.name ?? '');
		const rawFields = input.fields;
		const fields: Record<string, FieldSchema> = {};

		if (rawFields && typeof rawFields === 'object' && !Array.isArray(rawFields)) {
			for (const [field, raw] of Object.entries(rawFields as Record<string, unknown>)) {
				const spec = parseFieldSpec(raw);
				if (isError(spec)) return `${spec} (field "${field}")`;
				fields[field] = spec;
			}
		}

		const result = world.createComponent(name, fields);
		if (!result.ok) return fail(result.error);
		const names = Object.keys(fields);
		return `Defined component ${name} with ${names.length ? nameList(names, 10) : 'no fields'}.`;
	},

	async add_component_field(input) {
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');
		const guard = requireAuthoredComponent(component);
		if (guard) return guard;

		const spec = parseFieldSpec(input.spec);
		if (isError(spec)) return spec;

		const result = world.addComponentField(component, field, spec);
		if (!result.ok) return fail(result.error);
		return `${component}.${field} added as ${spec.t}.`;
	},

	async edit_component_field(input) {
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');
		const guard = requireAuthoredComponent(component, field);
		if (guard) return guard;

		const spec = parseFieldSpec(input.spec);
		if (isError(spec)) return spec;

		const result = world.editComponentField(component, field, spec);
		if (!result.ok) return fail(result.error);
		return `${component}.${field} is now ${spec.t}${spec.default !== undefined ? `, default ${formatValue(spec.default)}` : ''}.`;
	},

	async rename_component_field(input) {
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');
		const newField = String(input.newField ?? '');
		const guard = requireAuthoredComponent(component, field);
		if (guard) return guard;

		const result = world.renameComponentField(component, field, newField);
		if (!result.ok) return fail(result.error);
		return `${component}.${field} renamed to ${newField}, with stored values migrated.`;
	},

	async remove_component_field(input) {
		const component = String(input.component ?? '');
		const field = String(input.field ?? '');
		const guard = requireAuthoredComponent(component, field);
		if (guard) return guard;

		const result = world.removeComponentField(component, field);
		if (!result.ok) return fail(result.error);
		return `Removed ${component}.${field}.`;
	},

	// ---- write: collections ------------------------------------------------

	async define_collection(input) {
		const name = String(input.name ?? '');
		const raw = Array.isArray(input.components) ? input.components.map(String) : [];
		const unknown = raw.filter((component) => !getComponent(component));
		if (unknown.length > 0) {
			return fail(
				`No component "${unknown[0]}". Closest: ${suggestList(unknown[0], listComponents())}`
			);
		}

		const meta: { icon?: string; plural?: string } = {};
		if (typeof input.icon === 'string') meta.icon = input.icon;
		if (typeof input.plural === 'string') meta.plural = input.plural;

		const result = world.defineCollection(name, raw, Object.keys(meta).length ? { meta } : {});
		if (!result.ok) return fail(result.error);
		return `Defined collection ${name} with ${raw.length ? nameList(raw, 10) : 'no components'}. Add columns with add_collection_field.`;
	},

	async add_collection_field(input) {
		const collection = String(input.collection ?? '');
		if (!isCollection(collection)) {
			return fail(`No collection "${collection}". Collections: ${nameList(listCollections()) || 'none'}`);
		}
		const spec = parseFieldSpec(input.spec);
		if (isError(spec)) return spec;

		const result = world.addCollectionField(collection, {
			field: String(input.field ?? ''),
			spec,
			component: typeof input.component === 'string' ? input.component : undefined,
			newComponent: typeof input.newComponent === 'string' ? input.newComponent : undefined
		});
		if (!result.ok) {
			const editable = world.editableComponentsForType(collection);
			const hint = editable.length > 1 ? ` Choose one of: ${nameList(editable)}` : '';
			return fail(`${result.error}.${hint}`);
		}
		return `${collection}.${result.component}.${input.field} added as ${spec.t}.`;
	},

	async create_record(input) {
		const collection = String(input.collection ?? '');
		if (!isCollection(collection)) {
			return fail(`No collection "${collection}". Collections: ${nameList(listCollections()) || 'none'}`);
		}

		const raw = input.values;
		const overrides: Record<string, ComponentData> = {};
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			for (const [component, bag] of Object.entries(raw as Record<string, unknown>)) {
				if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
					return fail(`values.${component} must be an object of field values.`);
				}
				overrides[component] = bag as ComponentData;
			}
		}

		const record = world.createRecord(collection, overrides);
		if (!record) return fail(`Could not create a ${collection} record.`);
		return `Created ${record.id}.`;
	},

	async delete_record(input) {
		const id = String(input.recordId ?? '');
		const record = world.getEntity(id);
		if (!record) return fail(`No record "${id}". Use list_records to find valid ids.`);
		if (!record.type || !isCollection(record.type)) {
			return fail(`${id} is not a collection record — use remove_entity instead.`);
		}
		if (!world.deleteRecord(id)) return fail(`Could not delete ${id}.`);
		return `Deleted ${id}.`;
	},

	// ---- write: scene, rooms, editor ---------------------------------------

	async set_scene_setting(input) {
		const mod = await browserOnly(uiModule, 'set_scene_setting');
		if (isError(mod)) return mod;

		const key = String(input.key ?? '');
		const value = input.value;
		const scene = mod.ui.scene;

		switch (key) {
			case 'name':
				mod.ui.setSceneDisplayName(String(value ?? ''));
				return `Scene name is now "${scene.displayName}".`;
			case 'background':
				scene.background = String(value ?? '');
				return `Background is now ${scene.background}.`;
			case 'shadows':
				scene.shadows = value === true || value === 'true';
				return `Shadows ${scene.shadows ? 'on' : 'off'}.`;
			case 'grid':
				scene.groundGrid.enabled = value === true || value === 'true';
				return `Ground grid ${scene.groundGrid.enabled ? 'on' : 'off'}.`;
			case 'sky': {
				const preset = String(value ?? '');
				if (preset === 'off' || preset === 'false') {
					scene.sky.enabled = false;
					return 'Sky off.';
				}
				const allowed = ['noon', 'afternoon', 'sunset', 'night'];
				if (!allowed.includes(preset)) {
					return fail(`sky must be one of: ${allowed.join(', ')}, or "off".`);
				}
				scene.sky.enabled = true;
				scene.sky.preset = preset as typeof scene.sky.preset;
				return `Sky is now ${preset}.`;
			}
			case 'artStyle': {
				const style = String(value ?? '');
				const allowed = ['realistic', 'toon', 'ink', 'clay', 'noir'];
				if (!allowed.includes(style)) {
					return fail(`artStyle must be one of: ${allowed.join(', ')}.`);
				}
				mod.ui.setArtStyle(style as Parameters<typeof mod.ui.setArtStyle>[0]);
				return `Art style is now ${style}.`;
			}
			case 'toneMapping': {
				const tone = String(value ?? '');
				if (!TONE_MAPPINGS.includes(tone)) {
					return fail(`toneMapping must be one of: ${TONE_MAPPINGS.join(', ')}.`);
				}
				scene.style.toneMapping = tone as SceneStyle['toneMapping'];
				mod.ui.touchStyleCustom();
				return `Tone mapping is now ${tone}.`;
			}
			case 'exposure': {
				const exposure = Number(value);
				if (!Number.isFinite(exposure) || exposure < 0 || exposure > 8) {
					return fail('exposure must be a number between 0 and 8.');
				}
				scene.style.exposure = exposure;
				mod.ui.touchStyleCustom();
				return `Exposure is now ${formatValue(exposure)}.`;
			}
			case 'fog':
			case 'bloom':
			case 'vignette':
			case 'grain':
			case 'outline':
			case 'sketch': {
				const group = scene.style[key] as Record<string, unknown>;
				const applied = applyEffectKnobs(group, value, key);
				if (isError(applied)) return applied;
				mod.ui.touchStyleCustom();
				return `${key}: ${applied}`;
			}
			default:
				return fail(`Unknown setting "${key}". Use get_scene to see what can be changed.`);
		}
	},

	async switch_room(input) {
		const catalog = getRoomCatalog();
		if (!catalog) return fail('This world has no room catalog — there is nowhere to switch to.');

		const roomId = normalizeRoomId(String(input.roomId ?? ''));
		if (!catalog.rooms.has(roomId)) {
			return fail(`No room "${roomId}". Closest: ${suggestList(roomId, [...catalog.rooms.keys()])}`);
		}
		if (!world.switchRoom(roomId)) {
			return fail(
				`Could not switch to ${roomId} — rooms only swap while the world is running. Call set_mode with "play" first.`
			);
		}
		return `Now in ${roomId} with ${world.entities.length} entities.`;
	},

	async select_entity(input) {
		const raw = input.entityId;
		if (raw === undefined || raw === null || raw === '') {
			world.select(null);
			return 'Cleared the selection.';
		}
		const entity = requireEntity(String(raw));
		if (isError(entity)) return entity;
		if (!world.trySelect(entity.id)) {
			return fail(`${entity.id} cannot be selected — another peer is editing it.`);
		}
		return `Selected ${entity.id}.`;
	},

	async focus_entity(input) {
		const mod = await browserOnly(focusModule, 'focus_entity');
		if (isError(mod)) return mod;
		if (!mod.viewportFocus.active) {
			return fail('The editor viewport is not mounted, so the camera cannot move.');
		}

		const raw = input.entityId;
		if (raw === undefined || raw === null || raw === '') {
			mod.viewportFocus.reset();
			return 'Camera reset to its default pose.';
		}
		const entity = requireEntity(String(raw));
		if (isError(entity)) return entity;
		mod.viewportFocus.focus(entity);
		return `Camera framed on ${entity.id}.`;
	},

	async set_mode(input) {
		const mod = await browserOnly(uiModule, 'set_mode');
		if (isError(mod)) return mod;

		const mode = String(input.mode ?? '');
		const ui = mod.ui;
		switch (mode) {
			case 'edit':
				ui.exitToEdit();
				return 'Back in edit mode.';
			case 'play':
				if (ui.shellMode === 'play') return 'Already playing.';
				ui.enterPlay();
				return 'Playing.';
			case 'pause':
				if (ui.shellMode !== 'play') return fail('Nothing is playing — call set_mode with "play" first.');
				ui.pausePlay();
				return 'Play paused.';
			case 'resume':
				if (ui.shellMode !== 'play') return fail('Nothing is playing — call set_mode with "play" first.');
				ui.resumePlay();
				return 'Play resumed.';
			case 'reset':
				if (ui.shellMode !== 'play') return fail('Nothing is playing — call set_mode with "play" first.');
				ui.resetPlay();
				return 'Play reset to the snapshot taken when play began.';
			case 'publish':
				ui.enterPublish();
				return 'Publish panel open.';
			default:
				return fail('mode must be one of: edit, play, pause, resume, reset, publish.');
		}
	},

	async undo() {
		if (!editHistory.canUndo) return 'Nothing to undo.';
		if (!editHistory.undo()) return fail('Could not undo the last edit.');
		return `Undone. ${editHistory.canUndo ? 'More history remains.' : 'History is now empty.'}`;
	},

	async redo() {
		if (!editHistory.canRedo) return 'Nothing to redo.';
		if (!editHistory.redo()) return fail('Could not redo.');
		return `Redone. ${editHistory.canRedo ? 'More remains to redo.' : 'Nothing further to redo.'}`;
	}
};

/**
 * Guard the component-schema tools: built-in components are engine-owned, and a
 * missing component or field is worth naming before the world call fails.
 */
function requireAuthoredComponent(component: string, field?: string): string | null {
	const schema = getComponent(component);
	if (!schema) {
		return fail(`No component "${component}". Closest: ${suggestList(component, listComponents())}`);
	}
	if (isBuiltinComponent(component)) {
		const authored = listComponents().filter((name) => !isBuiltinComponent(name));
		return fail(
			`${component} is built into the engine and cannot be edited. Editable: ${nameList(authored) || 'none yet — use define_component'}`
		);
	}
	if (field !== undefined && !schema.fields[field]) {
		return fail(
			`${component} has no field "${field}". Fields: ${suggestList(field, Object.keys(schema.fields))}`
		);
	}
	return null;
}
