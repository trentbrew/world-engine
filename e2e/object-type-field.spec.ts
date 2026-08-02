import { expect, test, type Page } from '@playwright/test';
import {
	enterPlayMode,
	primeCollabStorage,
	dismissAllToasts,
	waitForToastsToClear,
	waitForWorldReady,
	openObjectTypeBehaviorPane,
	submitTypeBehaviorForm
} from './helpers';

async function readField(page: Page, id: string, comp: string, field: string) {
	return page.evaluate(
		async ({ id, comp, field }) => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { world } = await import(
				/* @vite-ignore */ moduleUrl(
					'/runtime/world.svelte.ts',
					'/src/lib/engine/runtime/world.svelte.ts'
				)
			);
			return world.getEntity(id)?.components?.[comp]?.[field] ?? null;
		},
		{ id, comp, field }
	);
}

async function readScore(page: Page) {
	return page.evaluate(async () => {
		const moduleUrl = (part: string, fallback: string) =>
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes(part)) ?? fallback;
		const { score } = await import(
			/* @vite-ignore */ moduleUrl('/game/score.svelte.ts', '/src/lib/engine/game/score.svelte.ts')
		);
		return score.value;
	});
}

async function openObjectsRoute(page: Page) {
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
}

async function spawnFromType(page: Page, typeName: string, suffix: string) {
	await page.getByRole('button', { name: 'Rooms', exact: true }).click();
	const roomViews = page.getByRole('tablist', { name: 'Room views' });
	await expect(roomViews.getByRole('tab', { name: 'Objects', exact: true })).toBeVisible();
	await expect(roomViews.getByRole('tab', { name: 'Assets' })).toHaveCount(0);
	await expect(roomViews.getByRole('tab', { name: 'Settings' })).toHaveCount(0);

	const ok = await page.evaluate(
		async ({ typeName, suffix }) => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { world } = await import(
				/* @vite-ignore */ moduleUrl(
					'/runtime/world.svelte.ts',
					'/src/lib/engine/runtime/world.svelte.ts'
				)
			);
			return !!world.spawnFromType(typeName, suffix);
		},
		{ typeName, suffix }
	);
	expect(ok, `spawnFromType(${typeName}, ${suffix})`).toBe(true);

	await page.getByRole('tab', { name: 'Instances' }).click();
}

async function createCustomType(page: Page, name: string) {
	const panel = page.locator('.objects-resource-panel');
	await panel.getByRole('button', { name: 'New object type' }).click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toBeVisible();
	await page.getByLabel('Type name').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'New object type' })).toHaveCount(0);
	await expect(page.locator('.type-row.active .type-name')).toHaveText(name);
	await waitForToastsToClear(page);
}

test.describe('object type fields', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('add a field to an object type from the Objects route', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Widget');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await dismissAllToasts(page);

		await typeEditor.getByRole('button', { name: 'Add field' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add field' });
		await expect(dialog).toBeVisible();
		await dialog.locator('#field-name').fill('powerLevel');
		await dialog.getByLabel('Type').selectOption('number');
		await dialog.getByRole('button', { name: 'Add field', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Add field' })).toHaveCount(0);

		// The new WidgetData schema component (carrying the field) shows in the type editor.
		await expect(typeEditor.getByRole('button', { name: 'WidgetData', exact: true })).toBeVisible({
			timeout: 10_000
		});
	});

	test('delete a field from an object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Gadget');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await dismissAllToasts(page);

		async function addField(name: string) {
			await typeEditor.getByRole('button', { name: 'Add field' }).click();
			const d = page.getByRole('dialog', { name: 'Add field' });
			await d.locator('#field-name').fill(name);
			await d.getByLabel('Type').selectOption('number');
			await d.getByRole('button', { name: 'Add field', exact: true }).click();
			await expect(page.getByRole('dialog', { name: 'Add field' })).toHaveCount(0);
			await dismissAllToasts(page);
		}

		await addField('powerLevel');
		await addField('armor');
		await expect(typeEditor.getByRole('button', { name: 'Delete field armor' })).toBeVisible({
			timeout: 10_000
		});

		// Delete armor → its row goes; powerLevel stays (component keeps ≥1 field).
		await typeEditor.getByRole('button', { name: 'Delete field armor' }).click({ force: true });
		await expect(typeEditor.getByRole('button', { name: 'Delete field armor' })).toHaveCount(0, {
			timeout: 10_000
		});
		await expect(
			typeEditor.getByRole('button', { name: 'Delete field powerLevel' })
		).toBeVisible();
	});

	test('rename a field on an object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Relic');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await dismissAllToasts(page);

		await typeEditor.getByRole('button', { name: 'Add field' }).click();
		const addDialog = page.getByRole('dialog', { name: 'Add field' });
		await addDialog.getByLabel('Field name').fill('powerLevel');
		await addDialog.getByLabel('Type').selectOption('number');
		await addDialog.getByRole('button', { name: 'Add field', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Add field' })).toHaveCount(0);

		const editBtn = typeEditor.getByRole('button', { name: 'Edit field powerLevel' });
		await expect(editBtn).toBeVisible({ timeout: 10_000 });
		await editBtn.click();
		const editDialog = page.getByRole('dialog', { name: 'Edit field' });
		await expect(editDialog).toBeVisible({ timeout: 10_000 });
		await editDialog.locator('#edit-field-name').fill('mightLevel');
		await editDialog.getByRole('button', { name: 'Save field' }).click();
		await expect(page.getByRole('dialog', { name: 'Edit field' })).toHaveCount(0);

		await expect(typeEditor.getByRole('button', { name: 'Edit field mightLevel' })).toBeVisible({
			timeout: 10_000
		});
		await expect(typeEditor.getByRole('button', { name: 'Edit field powerLevel' })).toHaveCount(0);
	});

	test('change a field type on an object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Flag');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await typeEditor.getByRole('button', { name: 'Add field' }).click();
		const addDialog = page.getByRole('dialog', { name: 'Add field' });
		await addDialog.getByLabel('Field name').fill('active');
		await addDialog.getByLabel('Type').selectOption('string');
		await addDialog.getByRole('button', { name: 'Add field', exact: true }).click();

		const editBtn = typeEditor.getByRole('button', { name: 'Edit field active' });
		await expect(editBtn).toBeVisible({ timeout: 10_000 });
		await editBtn.click();
		const editDialog = page.getByRole('dialog', { name: 'Edit field' });
		await expect(editDialog).toBeVisible({ timeout: 10_000 });
		await editDialog.locator('#edit-field-type').selectOption('boolean');
		await editDialog.getByRole('button', { name: 'Save field' }).click();
		await expect(page.getByRole('dialog', { name: 'Edit field' })).toHaveCount(0);

		await expect(typeEditor.getByRole('spinbutton', { name: 'active' })).toHaveCount(0, {
			timeout: 10_000
		});
		await expect(typeEditor.locator('.bool-well')).toBeVisible({ timeout: 10_000 });
	});

	test('add a create behavior action to an object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'TriggerBox');

		const behavior = await openObjectTypeBehaviorPane(page);
		const behaviorForm = behavior.locator('form[aria-label="Add type event action"]');
		await behaviorForm.getByLabel('Event trigger', { exact: true }).selectOption('create');
		await behaviorForm.getByLabel('Event action', { exact: true }).selectOption('set');
		await behaviorForm.getByLabel('Set field path', { exact: true }).selectOption('Render.color');
		await behaviorForm.getByLabel('Set field value', { exact: true }).fill('#ff3366');
		await submitTypeBehaviorForm(page, behavior);

		await expect(behavior.getByText('set Render.color = #ff3366')).toBeVisible({
			timeout: 10_000
		});
	});

	test('spawned instance runs type create behavior in play mode', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto(`/?room=obj-events-${Date.now()}`);
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'ColorBox');

		const behavior = await openObjectTypeBehaviorPane(page);
		const behaviorForm = behavior.locator('form[aria-label="Add type event action"]');
		await behaviorForm.getByLabel('Event trigger', { exact: true }).selectOption('create');
		await behaviorForm.getByLabel('Event action', { exact: true }).selectOption('set');
		await behaviorForm.getByLabel('Set field path', { exact: true }).selectOption('Render.color');
		await behaviorForm.getByLabel('Set field value', { exact: true }).fill('#ff3366');
		await submitTypeBehaviorForm(page, behavior);

		await spawnFromType(page, 'ColorBox', 'demo');

		await enterPlayMode(page);
		await expect
			.poll(() => readField(page, 'entity:colorbox/demo', 'Render', 'color'), { timeout: 15_000 })
			.toBe('#ff3366');
	});

	test('add a clip schedule step to an animatable object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'Mascot');

		const typeEditor = page.getByRole('complementary', { name: 'Object type editor' });
		await dismissAllToasts(page);
		const addBtn = typeEditor.getByRole('button', { name: 'Add capability' });
		await addBtn.focus();
		await page.keyboard.press('Enter');
		await page.getByRole('menuitem', { name: 'Mesh3DAnimator' }).click({ force: true });
		await expect(typeEditor.getByRole('button', { name: 'Mesh3DAnimator', exact: true })).toBeVisible({
			timeout: 10_000
		});

		const behavior = await openObjectTypeBehaviorPane(page);
		const clipForm = behavior.locator('form[aria-label="Add type clip step"]');
		await clipForm.getByLabel('Clip', { exact: true }).fill('Dance_Loop');
		await clipForm.getByLabel('After (s)', { exact: true }).fill('1.5');
		await clipForm.evaluate((el) => (el as HTMLFormElement).requestSubmit());

		const schedule = behavior.getByLabel('Clip schedule');
		await expect(schedule.getByText('Dance_Loop')).toHaveCount(1, { timeout: 10_000 });
		await expect(schedule.getByText('+1.5s')).toBeVisible({ timeout: 10_000 });
	});

	test('add score and spawn behavior actions to an object type', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto('/');
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'BonusBox');

		const behavior = await openObjectTypeBehaviorPane(page);
		const behaviorForm = behavior.locator('form[aria-label="Add type event action"]');

		await behaviorForm.getByLabel('Event action', { exact: true }).selectOption('score');
		await behaviorForm.getByLabel('Score points', { exact: true }).fill('25');
		await submitTypeBehaviorForm(page, behavior);
		await expect(behavior.getByText('score += 25')).toBeVisible({ timeout: 10_000 });

		await behaviorForm.getByLabel('Event action', { exact: true }).selectOption('spawn');
		await behaviorForm.getByLabel('Spawn type', { exact: true }).selectOption('Prop');
		await submitTypeBehaviorForm(page, behavior);
		await expect(behavior.getByText('spawn Prop')).toBeVisible({ timeout: 10_000 });
	});

	test('spawned instance runs type score behavior in play mode', async ({ page }) => {
		test.setTimeout(180_000);

		await page.goto(`/?room=obj-score-${Date.now()}`);
		await waitForWorldReady(page);

		await openObjectsRoute(page);
		await createCustomType(page, 'PointBox');

		const behavior = await openObjectTypeBehaviorPane(page);
		const behaviorForm = behavior.locator('form[aria-label="Add type event action"]');
		await behaviorForm.getByLabel('Event action', { exact: true }).selectOption('score');
		await behaviorForm.getByLabel('Score points', { exact: true }).fill('10');
		await submitTypeBehaviorForm(page, behavior);

		await spawnFromType(page, 'PointBox', 'demo');
		await enterPlayMode(page);

		await expect.poll(() => readScore(page), { timeout: 15_000 }).toBe(10);
	});
});
