/**
 * Smoke: exercise the whole WebMCP tool surface headlessly.
 *
 * Every manifest tool is called at least once against a real loaded world, so a
 * handler that throws, returns undefined, or blows the output budget fails here
 * rather than in front of an agent. Browser-only tools (mode, camera, scene
 * settings) must degrade to a legible message, not a module-load crash.
 *
 * Run: pnpm test:webmcp-surface
 */
import { executeWebMcpTool, listWebMcpToolNames } from '$lib/engine/agent/webmcp/execute';
import { MAX_OUTPUT_CHARS } from '$lib/engine/agent/webmcp/handlers';
import { WEBMCP_TOOLS } from '$lib/engine/agent/webmcp/manifest';
import { world } from '$lib/engine/runtime/world.svelte';

const { loadOntology } = await import('$lib/engine/ontology/loadOntology');
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');

const doc = JSON.parse(readFileSync(resolve(process.cwd(), 'static/games/orbit.jsonld'), 'utf8'));
const entities = await loadOntology(() => Promise.resolve(doc));
const { worldProfile } = await import('$lib/engine/world/worldProfile.svelte');
worldProfile.hydrate(entities);
world.setReady(entities, { skipAutoSelect: true });

const failures: string[] = [];
const called = new Set<string>();

/** Run a tool and assert on its output. `want` may be a prefix or a predicate. */
async function step(
	name: string,
	input: Record<string, unknown>,
	want: string | ((out: string) => boolean)
): Promise<string> {
	called.add(name);
	let out: string;
	try {
		out = await executeWebMcpTool(name, input);
	} catch (err) {
		failures.push(`${name} threw: ${(err as Error).message}`);
		return '';
	}
	if (out.length > MAX_OUTPUT_CHARS) {
		failures.push(`${name} returned ${out.length} chars, over the ${MAX_OUTPUT_CHARS} budget`);
	}
	const ok = typeof want === 'string' ? out.startsWith(want) : want(out);
	if (!ok) failures.push(`${name}: ${out.slice(0, 160)}`);
	return out;
}

const notError = (out: string) => !out.startsWith('Error:');
const isError = (out: string) => out.startsWith('Error:');
/** Browser-only tools may either work or explain they need a live editor. */
const headlessOk = (out: string) => out.includes('headless') || notError(out);

// ---- read ------------------------------------------------------------------

await step('world_status', {}, (o) => o.includes('entities:'));
await step('list_entities', { limit: 5 }, (o) => o.includes('entities'));
await step('list_rooms', {}, notError);
await step('list_types', {}, (o) => o.includes('types'));
await step('list_types', { kind: 'collections' }, notError);
await step('list_components', { kind: 'authored' }, notError);
await step('describe_component', { component: 'Transform' }, 'Transform (built-in');
await step('describe_component', { component: 'Trasnform' }, isError);
await step('describe_type', { type: 'Prop' }, 'Prop');
await step('get_scene', {}, headlessOk);
// No session in a headless smoke, so "no local player yet" is the correct answer.
await step('get_player', {}, (o) => o.startsWith('id:') || o.includes('No local player'));

// Primitives must be reachable from list_assets — the gap that stopped an agent
// from spawning a box at all.
await step('list_assets', { search: 'box' }, (o) => o.includes('primitive:box'));
await step('list_assets', { kind: 'shapes' }, (o) => o.includes('primitive:capsule'));

// ---- spawn + entity edits --------------------------------------------------

const placed = await step('spawn_prop', {
	mesh: 'primitive:box',
	position: [3, 1, 0],
	color: '#ff0000',
	scale: [2, 2, 2],
	label: 'surface-smoke'
}, (o) => o.startsWith('Placed entity:prop/') && o.includes('#ff0000'));

const propId = placed.match(/Placed (\S+?) at/)?.[1] ?? '';
if (!propId) failures.push('could not read the spawned prop id back out of spawn_prop');

await step('describe_entity', { entityId: propId }, propId);
await step('get_entity_json', { entityId: propId }, (o) => o.trim().startsWith('{'));
await step('set_entity_field', { entityId: propId, component: 'Render', field: 'color', value: '#00ff00' },
	(o) => o.includes('#00ff00'));
await step('set_entity_field', { entityId: propId, component: 'Render', field: 'nope', value: 1 }, isError);
await step('add_entity_component', { entityId: propId, component: 'Gravity' }, notError);
await step('remove_entity_component', { entityId: propId, component: 'Gravity' }, 'Removed Gravity');
await step('set_entity_events', { entityId: propId, events: { step: [] } }, (o) => o.includes('step'));
await step('select_entity', { entityId: propId }, `Selected ${propId}`);
await step('focus_entity', { entityId: propId }, headlessOk);

const dup = await step('duplicate_entity', { entityId: propId }, 'Duplicated');
const dupId = dup.match(/as (\S+?) at/)?.[1] ?? '';

await step('set_entity_json', {
	entityId: dupId,
	data: { Transform: { position: [5, 1, 0] }, Render: { mesh: 'primitive:sphere', color: '#0000ff' } }
}, (o) => o.includes('Render'));

await step('save_entity_as_type', { entityId: dupId, name: 'SmokeOrb' }, 'Saved');
await step('spawn_from_type', { type: 'SmokeOrb', position: [7, 1, 0] }, 'Spawned');
await step('spawn_from_type', { type: 'NoSuchType' }, isError);

// spawn_character needs a rigged GLB; assert it either places one or explains
// itself, never that it throws.
const rigged = (await executeWebMcpTool('list_assets', { kind: 'models', search: 'xbot' }))
	.split('\n')
	.find((line) => line.includes('.glb'))
	?.split(/\s+/)
	.at(-1);
await step('spawn_character', { mesh: rigged ?? 'primitive:box', position: [9, 0, 0] },
	(o) => o.startsWith('Placed character') || isError(o));

// ---- types -----------------------------------------------------------------

await step('define_type', { name: 'SmokeType' }, 'Defined type SmokeType');
await step('define_type', { name: 'SmokeType' }, isError);
await step('add_type_component', { type: 'SmokeType', component: 'Gravity' }, notError);
await step('set_type_default', { type: 'SmokeType', component: 'Render', field: 'color', value: '#123456' },
	(o) => o.includes('#123456'));
await step('set_type_events', { type: 'SmokeType', events: { create: [] } }, (o) => o.includes('create'));
await step('add_type_field', { type: 'SmokeType', field: 'health', spec: { t: 'number', default: 100 } },
	(o) => o.includes('health'));
await step('add_type_field', { type: 'SmokeType', field: 'bad', spec: { t: 'nonsense' } }, isError);
await step('remove_type_component', { type: 'SmokeType', component: 'Gravity' }, 'SmokeType no longer carries');

// ---- component schemas -----------------------------------------------------

await step('define_component', { name: 'SmokeStats', fields: { hp: { t: 'number', default: 10 } } },
	'Defined component SmokeStats');
await step('add_component_field', { component: 'SmokeStats', field: 'mp', spec: { t: 'number', default: 5 } },
	'SmokeStats.mp added');
await step('add_component_field', { component: 'Transform', field: 'x', spec: { t: 'number' } }, isError);
await step('edit_component_field', { component: 'SmokeStats', field: 'mp', spec: { t: 'number', default: 20 } },
	(o) => o.includes('20'));
await step('rename_component_field', { component: 'SmokeStats', field: 'mp', newField: 'mana' },
	(o) => o.includes('mana'));
await step('remove_component_field', { component: 'SmokeStats', field: 'mana' }, 'Removed SmokeStats.mana');
await step('remove_component_field', { component: 'SmokeStats', field: 'hp' }, isError); // last field

// ---- collections -----------------------------------------------------------

await step('define_collection', { name: 'SmokeItem', plural: 'Smoke items' }, 'Defined collection SmokeItem');
await step('add_collection_field', { collection: 'SmokeItem', field: 'price', spec: { t: 'number', default: 0 } },
	(o) => o.includes('price'));
const record = await step('create_record', { collection: 'SmokeItem', values: { SmokeItemData: { price: 42 } } },
	'Created record:');
const recordId = record.match(/Created (\S+?)\./)?.[1] ?? '';
await step('list_records', { collection: 'SmokeItem' }, (o) => o.includes('42'));
await step('delete_record', { recordId }, `Deleted ${recordId}`);
await step('delete_record', { recordId: propId }, isError);

// ---- scene, rooms, editor --------------------------------------------------

await step('set_scene_setting', { key: 'background', value: '#101010' }, headlessOk);
await step('switch_room', { roomId: 'room:nope' }, isError);
await step('set_mode', { mode: 'play' }, headlessOk);

// ---- history ---------------------------------------------------------------

await step('undo', {}, notError);
await step('redo', {}, notError);
await step('remove_entity', { entityId: propId }, `Removed ${propId}`);
await step('remove_entity', { entityId: propId }, isError);

// ---- coverage --------------------------------------------------------------

const registered = new Set(listWebMcpToolNames());
const missingHandler = WEBMCP_TOOLS.map((t) => t.name).filter((n) => !registered.has(n));
if (missingHandler.length > 0) {
	failures.push(`manifest tools with no handler: ${missingHandler.join(', ')}`);
}
const uncalled = [...registered].filter((n) => !called.has(n));
if (uncalled.length > 0) failures.push(`tools never exercised: ${uncalled.join(', ')}`);

if (failures.length > 0) {
	console.error(`webmcp-surface-smoke: FAIL\n  ${failures.join('\n  ')}`);
	process.exit(1);
}
console.log(`webmcp-surface-smoke: PASS — ${registered.size} tools exercised.`);
