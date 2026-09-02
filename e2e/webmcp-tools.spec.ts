/**
 * WebMCP tool surface — registration and execution against a live world.
 *
 * Chrome only exposes `document.modelContext` behind the origin trial or the
 * `#enable-webmcp-testing` flag, neither of which Playwright's Chromium has. The
 * test installs a spec-shaped stand-in before page scripts run, so the app's real
 * registration path and the real tool handlers are exercised end to end.
 */
import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, waitForWorldReady } from './helpers';
import { WEBMCP_TOOLS } from '../src/lib/engine/agent/webmcp/manifest';

/** Chrome's recommended per-output ceiling (docs/webmcp.md). */
const MAX_OUTPUT_CHARS = 1500;

declare global {
	interface Window {
		__webmcp: {
			names(): string[];
			schema(name: string): unknown;
			annotations(name: string): { readOnlyHint?: boolean; untrustedContentHint?: boolean };
			call(name: string, input?: Record<string, unknown>): Promise<string>;
		};
	}
}

async function installModelContext(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		const tools = new Map<string, any>();

		const ctx = {
			async registerTool(tool: any, options?: { signal?: AbortSignal }) {
				if (!tool?.name) throw new TypeError('tool.name is required');
				if (!tool?.description) throw new TypeError('tool.description is required');
				if (tools.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
				tools.set(tool.name, tool);
				options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
			},
			async getTools() {
				return [...tools.values()]
					.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
			async executeTool(tool: any, input: unknown) {
				const found = tools.get(tool.name);
				if (!found) throw new Error(`unknown tool: ${tool.name}`);
				const args = typeof input === 'string' ? JSON.parse(input) : (input ?? {});
				return String(await found.execute(args, { signal: new AbortController().signal }));
			}
		};

		Object.defineProperty(document, 'modelContext', { value: ctx, configurable: true });

		window.__webmcp = {
			names: () => [...tools.keys()],
			schema: (name: string) => tools.get(name)?.inputSchema,
			annotations: (name: string) => tools.get(name)?.annotations ?? {},
			call: async (name: string, input: Record<string, unknown> = {}) => {
				const tool = tools.get(name);
				if (!tool) throw new Error(`unknown tool: ${name}`);
				const controller = new AbortController();
				return String(await tool.execute(input, { signal: controller.signal }));
			}
		};
	});
}

const call = (page: import('@playwright/test').Page, name: string, input: Record<string, unknown> = {}) =>
	page.evaluate(([n, i]) => window.__webmcp.call(n as string, i as Record<string, unknown>), [
		name,
		input
	] as const);

test.beforeEach(async ({ page }) => {
	await installModelContext(page);
	await primeCollabStorage(page);
	await page.goto(e2eWorldUrl('/?game=orbit'));
	await waitForWorldReady(page);
	await expect
		.poll(() => page.evaluate(() => window.__webmcp.names().length), { timeout: 15_000 })
		.toBeGreaterThan(0);
});

test('tools re-register after a full page reload', async ({ page }) => {
	expect(await page.evaluate(() => window.__webmcp.names().includes('spawn_prop'))).toBe(true);
	await page.reload();
	await waitForWorldReady(page);
	await expect
		.poll(() => page.evaluate(() => window.__webmcp.names().includes('spawn_prop')), {
			timeout: 15_000
		})
		.toBe(true);
});

test('registers the full manifest', async ({ page }) => {
	const names = await page.evaluate(() => window.__webmcp.names().sort());
	expect(names).toEqual(WEBMCP_TOOLS.map((tool) => tool.name).sort());
});

test('read tools are annotated read-only', async ({ page }) => {
	for (const name of ['list_entities', 'describe_entity', 'list_types', 'list_assets']) {
		const annotations = await page.evaluate((n) => window.__webmcp.annotations(n), name);
		expect(annotations.readOnlyHint, `${name} readOnlyHint`).toBe(true);
		expect(annotations.untrustedContentHint, `${name} untrustedContentHint`).toBe(true);
	}
	const write = await page.evaluate(() => window.__webmcp.annotations('spawn_prop'));
	expect(write.readOnlyHint).toBe(false);
});

test('list_entities describes the loaded world', async ({ page }) => {
	const out = await call(page, 'list_entities');
	expect(out).toMatch(/\d+ entities:/);
	expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);

	const filtered = await call(page, 'list_entities', { component: 'Render' });
	expect(filtered).toMatch(/entities:|No entities match/);
});

test('describe_component reports the Transform schema', async ({ page }) => {
	const out = await call(page, 'describe_component', { component: 'Transform' });
	expect(out).toContain('position');
	expect(out).toContain('vec3');
	expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
});

test('unknown names return a self-correcting error', async ({ page }) => {
	const entity = await call(page, 'describe_entity', { entityId: 'entity:nope' });
	expect(entity).toContain('Error:');
	expect(entity).toContain('list_entities');

	const component = await call(page, 'describe_component', { component: 'Trasnform' });
	expect(component).toContain('Error:');
	expect(component).toContain('Transform'); // suggests the real name
});

test('spawn, edit, and remove a prop round-trips through the world', async ({ page }) => {
	const assets = await call(page, 'list_assets', { kind: 'models', limit: 5 });
	expect(assets).not.toContain('Error:');
	const mesh = assets.split('\n')[1]?.split(/\s{2,}/)[1];
	expect(mesh, 'an asset url from list_assets').toBeTruthy();

	const spawned = await call(page, 'spawn_prop', {
		mesh,
		position: [2, 0, -3],
		label: 'webmcp-test'
	});
	expect(spawned).toContain('Placed');

	const id = spawned.replace('Placed ', '').split(' at ')[0];
	expect(await page.evaluate((i) => !!window.__webmcp && i.length > 0, id)).toBe(true);

	const described = await call(page, 'describe_entity', { entityId: id });
	expect(described).toContain('Transform');
	expect(described).toContain('Render');

	const set = await call(page, 'set_entity_field', {
		entityId: id,
		component: 'Transform',
		field: 'position',
		value: [5, 1, 5]
	});
	expect(set).toContain('[5, 1, 5]');

	const badField = await call(page, 'set_entity_field', {
		entityId: id,
		component: 'Transform',
		field: 'positon',
		value: 1
	});
	expect(badField).toContain('Error:');
	expect(badField).toContain('position');

	const removed = await call(page, 'remove_entity', { entityId: id });
	expect(removed).toContain('Removed');

	const gone = await call(page, 'describe_entity', { entityId: id });
	expect(gone).toContain('Error:');
});

test('define_type composes a new type', async ({ page }) => {
	// Unique per test. Workers run in parallel and can land on the same
	// millisecond, and type definitions broadcast between pages in the same room.
	const typeName = `Probe${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	const defined = await call(page, 'define_type', { name: typeName });
	expect(defined).toContain(`Defined type ${typeName}`);

	const listed = await call(page, 'list_types');
	expect(listed).toContain(typeName);

	const added = await call(page, 'add_type_component', { type: typeName, component: 'Gravity' });
	expect(added).toContain(`${typeName} now carries Gravity`);

	const duplicate = await call(page, 'define_type', { name: typeName });
	expect(duplicate).toContain('Error:');
	expect(duplicate).toContain('already exists');

	const unknown = await call(page, 'add_type_component', {
		type: typeName,
		component: 'Nonexistent'
	});
	expect(unknown).toContain('Error:');
});

test('every tool output stays inside the character budget', async ({ page }) => {
	const outputs = await Promise.all([
		call(page, 'list_entities', { limit: 100 }),
		call(page, 'list_types'),
		call(page, 'list_assets', { kind: 'models', limit: 100 }),
		call(page, 'describe_component', { component: 'Render' })
	]);
	for (const out of outputs) {
		expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
	}
});

test('list_assets offers the primitives alongside uploaded models', async ({ page }) => {
	const out = await call(page, 'list_assets', { search: 'box' });
	expect(out).toContain('primitive:box');

	const shapes = await call(page, 'list_assets', { kind: 'shapes' });
	expect(shapes).toContain('primitive:sphere');
	expect(shapes).toContain('primitive:capsule');
});

test('an agent can spawn a red box from nothing but list_assets', async ({ page }) => {
	// The loop that failed before primitives were in the catalog: look for a box,
	// place it, colour it.
	const assets = await call(page, 'list_assets', { search: 'box' });
	const mesh = assets.split('\n').find((line) => line.includes('primitive:box'))?.split(/\s{2,}/)[1];
	expect(mesh).toBe('primitive:box');

	const spawned = await call(page, 'spawn_prop', {
		mesh,
		position: [0, 1, -4],
		color: '#ff0000',
		label: 'red-box'
	});
	expect(spawned).toContain('Placed');
	expect(spawned).toContain('#ff0000');

	const id = spawned.replace('Placed ', '').split(' at ')[0];
	const described = await call(page, 'describe_entity', { entityId: id });
	expect(described).toContain('#ff0000');

	await call(page, 'remove_entity', { entityId: id });
});

test('world_status and get_scene read the live editor', async ({ page }) => {
	const status = await call(page, 'world_status');
	expect(status).toContain('mode: edit');
	expect(status).toMatch(/entities: \d+/);
	// No avatar exists until play starts — the scheduler is stopped in edit mode.
	expect(status).toContain('player: none');

	const scene = await call(page, 'get_scene');
	expect(scene).toContain('background:');
	expect(scene).toContain('artStyle:');
});

test('get_player returns the local avatar position in play mode', async ({ page }) => {
	await call(page, 'set_mode', { mode: 'play' });

	// The avatar spawns asynchronously — session connect, then spawn-point
	// reconciliation — so poll rather than reading on the next tick.
	await expect
		.poll(() => call(page, 'get_player'), { timeout: 15_000 })
		.toMatch(/^id: entity:player\//);

	const player = await call(page, 'get_player');
	expect(player).toMatch(/position: \[/);

	const status = await call(page, 'world_status');
	expect(status).toMatch(/player: entity:player\/.* at \[/);

	await call(page, 'set_mode', { mode: 'edit' });
});

test('set_scene_setting changes the scene and get_scene reads it back', async ({ page }) => {
	const set = await call(page, 'set_scene_setting', { key: 'artStyle', value: 'toon' });
	expect(set).toContain('toon');
	expect(await call(page, 'get_scene')).toContain('artStyle: toon');

	const bad = await call(page, 'set_scene_setting', { key: 'artStyle', value: 'neon' });
	expect(bad).toContain('Error:');
});

test('the agent can author the scene mood through post-processing', async ({ page }) => {
	// The look-dev beat: fog + bloom are what separate a lit box field from an
	// atmosphere, and both must be reachable without touching the editor.
	expect(await call(page, 'get_scene')).toContain('fog:');

	const fog = await call(page, 'set_scene_setting', {
		key: 'fog',
		value: { color: '#2a1a4a', near: 8, far: 90 }
	});
	expect(fog).toContain('enabled=true'); // implied when knobs are set
	expect(fog).toContain('#2a1a4a');

	const bloom = await call(page, 'set_scene_setting', {
		key: 'bloom',
		value: { intensity: 1.4, threshold: 0.6 }
	});
	expect(bloom).toContain('enabled=true');

	// Bare toggle is the other accepted shape.
	expect(await call(page, 'set_scene_setting', { key: 'vignette', value: true }))
		.toContain('enabled=true');

	expect(await call(page, 'set_scene_setting', { key: 'exposure', value: 1.8 }))
		.toContain('1.8');

	const scene = await call(page, 'get_scene');
	expect(scene).toContain('#2a1a4a');
	expect(scene).toContain('artStyle: custom'); // knob edits flip the preset

	// Unknown knobs self-correct rather than silently no-op.
	const typo = await call(page, 'set_scene_setting', { key: 'fog', value: { colour: '#fff' } });
	expect(typo).toContain('Error:');
	expect(typo).toContain('color');
});

test('set_mode drives play, pause, and back to edit', async ({ page }) => {
	expect(await call(page, 'set_mode', { mode: 'play' })).toContain('Playing');
	expect(await call(page, 'world_status')).toContain('mode: play');

	expect(await call(page, 'set_mode', { mode: 'pause' })).toContain('paused');
	expect(await call(page, 'world_status')).toContain('(paused)');

	await call(page, 'set_mode', { mode: 'resume' });
	expect(await call(page, 'set_mode', { mode: 'edit' })).toContain('edit mode');
	expect(await call(page, 'world_status')).toContain('mode: edit');
});

test('select_entity and focus_entity drive the editor viewport', async ({ page }) => {
	const listed = await call(page, 'list_entities', { component: 'Render', limit: 1 });
	const id = listed.split('\n')[1]?.split(/\s{2,}/)[0];
	expect(id, 'an entity id from list_entities').toBeTruthy();

	expect(await call(page, 'select_entity', { entityId: id })).toContain('Selected');
	expect(await call(page, 'world_status')).toContain(`selection: ${id}`);

	expect(await call(page, 'focus_entity', { entityId: id })).toContain('framed');
	expect(await call(page, 'focus_entity', {})).toContain('reset');

	expect(await call(page, 'select_entity', {})).toContain('Cleared');
});

test('undo reverses a spawn the agent just made', async ({ page }) => {
	const spawned = await call(page, 'spawn_prop', {
		mesh: 'primitive:sphere',
		position: [0, 1, 6],
		label: 'undo-probe'
	});
	const id = spawned.replace('Placed ', '').split(' at ')[0];
	expect(await call(page, 'describe_entity', { entityId: id })).toContain('Transform');

	expect(await call(page, 'undo')).toContain('Undone');
	expect(await call(page, 'describe_entity', { entityId: id })).toContain('Error:');

	expect(await call(page, 'redo')).toContain('Redone');
	expect(await call(page, 'describe_entity', { entityId: id })).toContain('Transform');

	await call(page, 'remove_entity', { entityId: id });
});

test('component schema authoring is blocked on built-ins and works on authored', async ({ page }) => {
	const name = `Probe${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	expect(await call(page, 'define_component', { name, fields: { hp: { t: 'number', default: 10 } } }))
		.toContain(`Defined component ${name}`);
	expect(await call(page, 'describe_component', { component: name })).toContain('world-authored');

	expect(await call(page, 'add_component_field', { component: name, field: 'mp', spec: { t: 'number' } }))
		.toContain(`${name}.mp added`);
	expect(await call(page, 'rename_component_field', { component: name, field: 'mp', newField: 'mana' }))
		.toContain('mana');
	expect(await call(page, 'remove_component_field', { component: name, field: 'mana' }))
		.toContain(`Removed ${name}.mana`);

	const builtin = await call(page, 'add_component_field', {
		component: 'Transform',
		field: 'x',
		spec: { t: 'number' }
	});
	expect(builtin).toContain('Error:');
	expect(builtin).toContain('built into the engine');
});

test('collections hold records the agent can create and delete', async ({ page }) => {
	const name = `Item${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	expect(await call(page, 'define_collection', { name, plural: `${name}s` }))
		.toContain(`Defined collection ${name}`);
	expect(await call(page, 'add_collection_field', {
		collection: name,
		field: 'price',
		spec: { t: 'number', default: 0 }
	})).toContain('price');

	const created = await call(page, 'create_record', {
		collection: name,
		values: { [`${name}Data`]: { price: 42 } }
	});
	expect(created).toContain('Created');
	const recordId = created.replace('Created ', '').replace(/\.$/, '');

	expect(await call(page, 'list_records', { collection: name })).toContain('42');
	expect(await call(page, 'delete_record', { recordId })).toContain('Deleted');
});
