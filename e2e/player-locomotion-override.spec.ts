/**
 * TRL-199 — Mesh3DAnimator.locomotion type override routes play-mode clips.
 * Spec: docs/artifacts/editable_locomotion_bindings_spec.md
 */
import { expect, test, type Page } from '@playwright/test';
import {
	e2eWorldUrl,
	enterEditMode,
	enterPlayMode,
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
					return id && world.getEntity(id) ? id : null;
				}),
			{ timeout: 30_000 }
		)
		.not.toBeNull();
}

async function setWalkOverride(page: Page, clip: string) {
	return page.evaluate(
		async ({ clip }) => {
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
			return world.setTypeDefault('Player', 'Mesh3DAnimator', 'locomotion', { walk: clip });
		},
		{ clip }
	);
}

async function tickWalk(page: Page, frames = 40) {
	return page.evaluate(async ({ frames }) => {
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
		const { applyLocomotionClip, warmLocomotionPack, resetPlayerAnimClipState } = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/playerLocomotionClips.ts',
				'/src/lib/engine/player/playerLocomotionClips.ts'
			)
		);
		const id = world.localPlayerId;
		const player = id ? world.getEntity(id) : null;
		if (!player) return null;

		resetPlayerAnimClipState();
		warmLocomotionPack(player);
		// Allow async catalog warm to settle if needed
		await new Promise((r) => setTimeout(r, 50));
		warmLocomotionPack(player);

		for (let i = 0; i < frames; i++) {
			applyLocomotionClip(player, 'walk');
		}
		return (player.components.Mesh3DAnimator as { clip?: string } | undefined)?.clip ?? null;
	}, { frames });
}

test.describe('player locomotion override (TRL-199)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
		await page.addInitScript(() => {
			localStorage.removeItem('engine:play-input-config');
		});
	});

	test('Walk binding override updates live play-mode clip', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(e2eWorldUrl(`/?game=blank&room=trl199-loco-${Date.now()}`));
		await waitForWorldReady(page);
		await enterEditMode(page);
		await waitForLocalPlayer(page);

		const ok = await setWalkOverride(page, 'Jog_Fwd_Loop');
		expect(ok).toBe(true);

		await enterPlayMode(page);
		await waitForLocalPlayer(page);

		const walkClip = await tickWalk(page, 40);
		expect(walkClip).toBe('Jog_Fwd_Loop');
	});

	test('Objects Events locomotion select is editable for Player', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(e2eWorldUrl(`/?game=blank&room=trl199-ui-${Date.now()}`));
		await waitForWorldReady(page);
		await enterEditMode(page);

		await page.getByRole('button', { name: 'Objects', exact: true }).click();
		await expect(page.getByRole('listbox', { name: 'Object types' })).toBeVisible();
		await page.getByRole('option', { name: /^Player\b/ }).click();

		const inspector = page.getByRole('complementary', { name: 'Object type inspector' });
		await inspector.getByRole('tab', { name: 'Events' }).click();
		const loco = inspector.getByLabel('Locomotion clips');
		await expect(loco).toBeVisible({ timeout: 10_000 });
		const walkSelect = loco.getByLabel('Walk locomotion clip');
		await expect(walkSelect).toBeVisible();
		await walkSelect.selectOption('Jog_Fwd_Loop');

		await enterPlayMode(page);
		await waitForLocalPlayer(page);
		const walkClip = await tickWalk(page, 40);
		expect(walkClip).toBe('Jog_Fwd_Loop');
	});
});
