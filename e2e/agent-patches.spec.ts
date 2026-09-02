/**
 * Durable patch application — the `AgentAction` of kind `patch` write path.
 *
 * `applyAgentPatches` routes each patch through the editor's authoring API so the
 * edit persists, replicates, and (where a dedicated method exists) joins the undo
 * stack. The spec drives it via Vite's dev module graph (dev-server only).
 *
 * IMPORTANT: `import('/src/…')` resolves to a DIFFERENT module instance than the
 * one the running app holds — measured, not assumed: the app's world reports 9
 * entities where a fresh import reports 0. So this spec exercises the real code
 * against an isolated engine instance; every assertion is self-consistent within
 * it, but it proves nothing about the app's live world. Integration against the
 * live world is covered by webmcp-tools.spec.ts and webmcp-extension.spec.ts,
 * which reach the app through its registered tool closures.
 */
import { expect, test, type Page } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, waitForWorldReady } from './helpers';

type ApplyResult = { applied: number; errors: string[] };

declare global {
	interface Window {
		__applyAgentPatches(patches: unknown[]): ApplyResult;
		__world: {
			getEntity(id: string): unknown;
			addableComponents(id: string): string[];
			addableTypeComponents(typeName: string): string[];
			createProp(opts: {
				mesh: string;
				position: [number, number, number];
				label?: string;
			}): { id: string } | null;
		};
	}
}

const apply = (page: Page, patches: unknown[]): Promise<ApplyResult> =>
	page.evaluate((input) => window.__applyAgentPatches(input), patches);

const readEntity = (page: Page, id: string) =>
	page.evaluate((entityId) => {
		const entity = window.__world.getEntity(entityId) as
			| {
					id: string;
					type?: string;
					components: Record<string, Record<string, unknown>>;
					events?: Record<string, unknown>;
			  }
			| undefined;
		if (!entity) return null;
		return {
			id: entity.id,
			type: entity.type ?? null,
			components: JSON.parse(JSON.stringify(entity.components)) as Record<
				string,
				Record<string, unknown>
			>,
			events: entity.events ? Object.keys(entity.events) : null
		};
	}, id);

const addableComponents = (page: Page, id: string) =>
	page.evaluate((entityId) => window.__world.addableComponents(entityId), id);

/**
 * Unique per test. `Date.now()` alone is not enough: workers run in parallel and
 * can land on the same millisecond, and durable edits broadcast between pages in
 * the same room — so two tests sharing an id will overwrite each other.
 */
function uniqueSuffix(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let probeId: string;

/**
 * Create the entity through `world.createProp` — the engine's supported creation
 * path, and the one `spawn_prop` uses.
 *
 * `setEntity` — which routes through the generic `applyHistoryPatch` fallback —
 * gets its own tests below rather than being used for setup, so a failure there
 * cannot silently disable every other test in the file.
 */
test.beforeEach(async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto(e2eWorldUrl('/?game=orbit'));
	await waitForWorldReady(page);

	probeId = await page.evaluate((label) => {
		const entity = window.__world.createProp({
			mesh: '/models/barrel.glb',
			position: [0, 0, 0],
			label
		});
		if (!entity) throw new Error('createProp returned null');
		return entity.id;
	}, `probe-${uniqueSuffix()}`);
});

test('setField updates a component field', async ({ page }) => {
	const before = await readEntity(page, probeId);
	expect(before?.components.Transform.position).toEqual([0, 0, 0]);

	const result = await apply(page, [
		{ entityId: probeId, component: 'Transform', field: 'position', value: [7, 8, 9] }
	]);
	expect(result).toEqual({ applied: 1, errors: [] });

	const after = await readEntity(page, probeId);
	expect(after?.components.Transform.position).toEqual([7, 8, 9]);
});

test('setComponent adds a component, removeComponent takes it away', async ({ page }) => {
	const addable = await addableComponents(page, probeId);
	expect(addable.length, 'the prop accepts at least one component').toBeGreaterThan(0);
	const component = addable[0];

	const added = await apply(page, [
		{ kind: 'setComponent', entityId: probeId, component, bag: {} }
	]);
	expect(added).toEqual({ applied: 1, errors: [] });
	expect(Object.keys((await readEntity(page, probeId))!.components)).toContain(component);

	const removed = await apply(page, [{ kind: 'removeComponent', entityId: probeId, component }]);
	expect(removed).toEqual({ applied: 1, errors: [] });
	expect(Object.keys((await readEntity(page, probeId))!.components)).not.toContain(component);
});

test('defineComponent and defineType register new vocabulary', async ({ page }) => {
	const suffix = uniqueSuffix();
	const componentName = `Probe${suffix}`;
	const typeName = `ProbeType${suffix}`;

	const result = await apply(page, [
		{
			kind: 'defineComponent',
			name: componentName,
			fields: { charge: { t: 'number', default: 5 }, tag: { t: 'string' } }
		},
		{
			kind: 'defineType',
			name: typeName,
			components: ['Transform', 'Render'],
			defaults: {}
		}
	]);
	expect(result).toEqual({ applied: 2, errors: [] });

	// Both landed on the app's live registry: the new type resolves, and the new
	// component is offered as addable to it.
	const addableToType = await page.evaluate(
		(t) => window.__world.addableTypeComponents(t),
		typeName
	);
	expect(Array.isArray(addableToType), `type ${typeName} is registered`).toBe(true);
	expect(addableToType).toContain(componentName);
});

test('setEvents attaches behaviour', async ({ page }) => {
	const result = await apply(page, [
		{
			kind: 'setEvents',
			entityId: probeId,
			events: { step: [{ set: 'Transform.position.y', to: '=1 + sin(t)' }] }
		}
	]);
	expect(result).toEqual({ applied: 1, errors: [] });
	expect((await readEntity(page, probeId))?.events).toContain('step');
});

test('removeEntity deletes through the editor path', async ({ page }) => {
	expect(await readEntity(page, probeId)).not.toBeNull();

	const result = await apply(page, [{ kind: 'removeEntity', entityId: probeId }]);
	expect(result).toEqual({ applied: 1, errors: [] });
	expect(await readEntity(page, probeId)).toBeNull();
});

test('a bad patch is reported without stalling the batch', async ({ page }) => {
	const result = await apply(page, [
		{ entityId: 'entity:does-not-exist', component: 'Transform', field: 'position', value: [0, 0, 0] },
		{ kind: 'removeComponent', entityId: probeId, component: 'Nonexistent' },
		{ entityId: probeId, component: 'Transform', field: 'position', value: [4, 4, 4] }
	]);

	expect(result.applied).toBe(1);
	expect(result.errors).toHaveLength(2);
	expect(result.errors[0]).toContain('no entity');
	expect(result.errors[1]).toContain('removeComponent');

	// The patch after the failures still landed.
	expect((await readEntity(page, probeId))?.components.Transform.position).toEqual([4, 4, 4]);
});

test('setEntity creates an entity that survives', async ({ page }) => {
	const id = `entity:probe/${uniqueSuffix()}`;

	const created = await apply(page, [
		{
			kind: 'setEntity',
			entityId: id,
			conformsTo: 'Prop',
			components: {
				Transform: { position: [1, 2, 3] },
				Render: { mesh: '/models/barrel.glb', color: '#ff0000' }
			}
		}
	]);
	expect(created).toEqual({ applied: 1, errors: [] });

	const entity = await readEntity(page, id);
	expect(entity, 'the entity is still there on a later task').not.toBeNull();
	expect(entity?.type).toBe('Prop');
	expect(entity?.components.Transform.position).toEqual([1, 2, 3]);
	expect(entity?.components.Render.color).toBe('#ff0000');

	const moved = await apply(page, [
		{ entityId: id, component: 'Transform', field: 'position', value: [4, 4, 4] }
	]);
	expect(moved).toEqual({ applied: 1, errors: [] });
	expect((await readEntity(page, id))?.components.Transform.position).toEqual([4, 4, 4]);
});

test('failing patches do not corrupt a later write to a setEntity entity', async ({ page }) => {
	const id = `entity:probe/${uniqueSuffix()}`;

	const result = await apply(page, [
		{
			kind: 'setEntity',
			entityId: id,
			conformsTo: 'Prop',
			components: { Transform: { position: [0, 0, 0] }, Render: { mesh: '/models/barrel.glb' } }
		},
		{ entityId: 'entity:does-not-exist', component: 'Transform', field: 'position', value: [0, 0, 0] },
		{ kind: 'removeComponent', entityId: id, component: 'Nonexistent' },
		{ entityId: id, component: 'Transform', field: 'position', value: [4, 4, 4] }
	]);

	expect(result.applied).toBe(2);
	expect(result.errors).toHaveLength(2);
	expect((await readEntity(page, id))?.components.Transform.position).toEqual([4, 4, 4]);
});
