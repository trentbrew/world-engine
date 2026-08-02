/**
 * Object context — isolated stage, clip library, behavior drawer.
 */
import { expect, test, type Page } from '@playwright/test';

function isBenignConsoleError(text: string): boolean {
	const t = text.toLowerCase();
	return t.includes('webgl') || t.includes('gpu') || t.includes('favicon');
}

function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) errors.push(msg.text());
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(err.message);
	});
	return errors;
}

async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => localStorage.setItem('collab:username-prompted', '1'));
}

async function waitForWorldReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('tree', { name: 'World entities' })).toBeVisible({ timeout: 30_000 });
}

function readField(page: Page, id: string, comp: string, field: string) {
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

async function enterObjectEditor(page: Page, entityId: string) {
	await page.evaluate(async (entityId) => {
		const moduleUrl = (part: string, fallback: string) =>
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes(part)) ?? fallback;
		const { ui } = await import(
			/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
		);
		ui.editObject(entityId);
	}, entityId);
}

test.describe('object context', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('enter via entity list, pick clip, read behavior schedule, round-trip to play', async ({
		page
	}) => {
		const errors = collectConsoleErrors(page);
		await page.goto(`/?game=animated-npc-demo&room=object-ctx-${Date.now()}`);
		await waitForWorldReady(page);

		await enterObjectEditor(page, 'entity:npc/guard');

		await expect(page.getByRole('navigation', { name: 'World navigation' })).toBeVisible();
		await expect(page.getByLabel('Clip library')).toBeVisible();
		await expect(page.getByLabel('Playback inspector')).toBeVisible();
		await expect(page.getByLabel('Clip schedule')).toContainText('Dance_Loop');

		const walkClip = page.getByRole('option', { name: /Walk_Loop/i }).first();
		await expect(walkClip).toBeVisible({ timeout: 15_000 });
		await walkClip.click();

		await expect
			.poll(() => readField(page, 'entity:npc/guard', 'Mesh3DAnimator', 'clip'), {
				timeout: 5_000
			})
			.toBe('Walk_Loop');

		await page.getByRole('button', { name: 'Rooms', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Rooms', exact: true })).toHaveAttribute(
			'aria-current',
			'true'
		);

		await page.getByRole('tab', { name: 'Play' }).click();
		await expect
			.poll(() => readField(page, 'entity:npc/guard', 'Mesh3DAnimator', 'clip'), {
				timeout: 15_000
			})
			.toBe('Dance_Loop');

		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});

	test('instance editor opens empty state when no animated character', async ({ page }) => {
		const errors = collectConsoleErrors(page);
		await page.goto(`/?game=blank&room=object-gate-${Date.now()}`);
		await waitForWorldReady(page);

		await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);
			ui.setRoute('object');
		});
		await expect(page.getByText('No object selected')).toBeVisible();

		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
