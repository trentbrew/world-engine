/**
 * TRL-176 — Player type visual defaults (GameMaker object sprite pattern).
 * Spec: docs/artifacts/player_object_visual_defaults_spec.md
 */
import { expect, test, type Page } from '@playwright/test';
import {
	e2eWorldUrl,
	enterEditMode,
	primeCollabStorage,
	waitForWorldReady
} from './helpers';

async function waitForLocalPlayer(page: Page) {
	await expect
		.poll(
			async () =>
				page.evaluate(async () => {
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
					const id = world.localPlayerId;
					if (!id) return null;
					return world.getEntity(id) ? id : null;
				}),
			{ timeout: 30_000 }
		)
		.not.toBeNull();
}

async function readLocalPlayerMesh(page: Page) {
	return page.evaluate(async () => {
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
		const id = world.localPlayerId;
		if (!id) return null;
		const e = world.getEntity(id);
		if (!e) return null;
		return {
			mesh: (e.components.SkinnedMesh as { mesh?: string } | undefined)?.mesh ?? null,
			typeDefault: world.typeDefaultValue('Player', 'SkinnedMesh', 'mesh')
		};
	});
}

async function setPlayerMeshDefault(page: Page, mesh: string) {
	return page.evaluate(
		async ({ mesh }) => {
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
			const { canEditTypeDefaultField, canRemoveTypeComponent, isEditableObjectType } =
				await import(
					/* @vite-ignore */ moduleUrl(
						'/runtime/typeAccess.ts',
						'/src/lib/engine/runtime/typeAccess.ts'
					)
				);
			return {
				ok: world.setTypeDefault('Player', 'SkinnedMesh', 'mesh', mesh),
				editableObject: isEditableObjectType('Player'),
				canMesh: canEditTypeDefaultField('Player', 'SkinnedMesh', 'mesh'),
				canSpeed: canEditTypeDefaultField('Player', 'Player', 'speed'),
				canRemoveSkinned: canRemoveTypeComponent('Player', 'SkinnedMesh')
			};
		},
		{ mesh }
	);
}

async function openObjectsPlayer(page: Page) {
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
	await page.getByRole('option', { name: /^Player\b/ }).click();
	const inspector = page.getByRole('complementary', { name: 'Object type inspector' });
	await expect(inspector.locator('.header-title')).toHaveText('Player');
	await expect(inspector.getByText(/Visual defaults apply to the avatar/i)).toBeVisible();
	return inspector;
}

test.describe('Player object visual defaults (TRL-176)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('world type:Player override loads player.glb on local avatar', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(
			e2eWorldUrl(`/?game=player-avatar-override&room=trl176-override-${Date.now()}`)
		);
		await waitForWorldReady(page);
		await enterEditMode(page);
		await waitForLocalPlayer(page);

		const state = await readLocalPlayerMesh(page);
		expect(state?.mesh).toContain('player.glb');
		expect(state?.typeDefault).toContain('player.glb');
	});

	test('setTypeDefault updates live player mesh; composition stays locked', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(e2eWorldUrl(`/?game=blank&room=trl176-live-${Date.now()}`));
		await waitForWorldReady(page);
		await enterEditMode(page);
		await waitForLocalPlayer(page);

		const before = await readLocalPlayerMesh(page);
		expect(before?.mesh).toContain('mannequin');

		const policy = await setPlayerMeshDefault(page, '/models/player.glb');
		expect(policy.ok).toBe(true);
		expect(policy.editableObject).toBe(false);
		expect(policy.canMesh).toBe(true);
		expect(policy.canSpeed).toBe(false);
		expect(policy.canRemoveSkinned).toBe(false);

		const after = await readLocalPlayerMesh(page);
		expect(after?.mesh).toBe('/models/player.glb');
		expect(after?.typeDefault).toBe('/models/player.glb');
	});

	test('Objects UI: Player mesh browse applies player.glb', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto(e2eWorldUrl(`/?game=blank&room=trl176-ui-${Date.now()}`));
		await waitForWorldReady(page);
		await enterEditMode(page);
		await waitForLocalPlayer(page);

		const inspector = await openObjectsPlayer(page);
		// Accordion opens all sections by default — browse without toggling SkinnedMesh closed.
		const browse = inspector.getByRole('button', { name: 'Browse assets' });
		await expect(browse).toBeVisible({ timeout: 10_000 });
		await browse.click();
		await expect(page.getByText(/Pick an asset for the selected field/i)).toBeVisible({
			timeout: 10_000
		});

		// Apply via library while pick-target is armed (same path as clicking a model tile).
		const applied = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const { assetLibrary } = await import(
				/* @vite-ignore */ moduleUrl(
					'/ui/assetLibrary.svelte.ts',
					'/src/lib/ui/assetLibrary.svelte.ts'
				)
			);
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);
			if (!ui.assetPickTarget) return { ok: false, reason: 'no pick target' };
			await assetLibrary.ensureLoaded();
			const asset =
				assetLibrary.assets.find((a) => a.url.includes('/models/player.glb')) ??
				assetLibrary.assets.find((a) => a.name === 'player.glb');
			if (!asset) return { ok: false, reason: 'player.glb missing from catalog' };
			assetLibrary.selectAsset(asset);
			return { ok: true, url: asset.url };
		});
		expect(applied.ok, JSON.stringify(applied)).toBe(true);

		await expect
			.poll(async () => (await readLocalPlayerMesh(page))?.mesh ?? null, { timeout: 15_000 })
			.toContain('player.glb');
	});
});
