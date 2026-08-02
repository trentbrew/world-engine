/**
 * TRL-149 / TRL-153 — default Player avatar is Character mannequin + locomotion clips.
 * Spec: docs/artifacts/player_default_skinned_avatar_spec.md
 */
import { expect, test, type Page } from '@playwright/test';
import { enterPlayMode, primeCollabStorage, waitForWorldReady } from './helpers';

async function readLocalPlayer(page: Page) {
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
			id,
			hasRender: 'Render' in e.components,
			mesh: (e.components.SkinnedMesh as { mesh?: string } | undefined)?.mesh ?? null,
			clip: (e.components.Mesh3DAnimator as { clip?: string } | undefined)?.clip ?? null,
			collider: (e.components.Physics as { collider?: string } | undefined)?.collider ?? null
		};
	});
}

/** Deterministic locomotion ticks — Playwright keyboard focus is unreliable for WASD. */
async function tickLocomotion(page: Page, opts: { holdW?: boolean; holdSpace?: boolean; frames?: number }) {
	const frames = opts.frames ?? 36;
	return page.evaluate(
		async ({ holdW, holdSpace, frames }) => {
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
			const inputMod = await import(
				/* @vite-ignore */ moduleUrl('/player/input.ts', '/src/lib/engine/player/input.ts')
			);
			const { jumpSystem } = await import(
				/* @vite-ignore */ moduleUrl(
					'/systems/behaviors/jump.ts',
					'/src/lib/engine/systems/behaviors/jump.ts'
				)
			);
			const { playerSystem } = await import(
				/* @vite-ignore */ moduleUrl(
					'/player/playerSystem.ts',
					'/src/lib/engine/player/playerSystem.ts'
				)
			);
			const { groundStore } = await import(
				/* @vite-ignore */ moduleUrl(
					'/player/groundStore.svelte.ts',
					'/src/lib/engine/player/groundStore.svelte.ts'
				)
			);

			const id = world.localPlayerId;
			const player = id ? world.getEntity(id) : null;
			if (!player) throw new Error('missing local player');

			groundStore.grounded = true;
			groundStore.normal = [0, 1, 0];
			groundStore.height = 0.05;

			if (holdW) inputMod.__testInjectKeyEdge('down', 'w');
			if (holdSpace) inputMod.__testInjectKeyEdge('down', ' ');

			const ctx = { dt: 1 / 60, t: 0, tick: 0 };
			for (let i = 0; i < frames; i += 1) {
				jumpSystem(ctx);
				playerSystem(ctx);
				ctx.t += ctx.dt;
				ctx.tick += 1;
			}

			if (holdW) inputMod.__testInjectKeyEdge('up', 'w');
			if (holdSpace) inputMod.__testInjectKeyEdge('up', ' ');

			return (player.components.Mesh3DAnimator as { clip?: string } | undefined)?.clip ?? null;
		},
		{ holdW: opts.holdW ?? false, holdSpace: opts.holdSpace ?? false, frames }
	);
}

test.describe('player skinned avatar (A+B)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
		await page.addInitScript(() => {
			localStorage.removeItem('engine:play-input-config');
		});
	});

	test('default mannequin visual + idle clip + movement clip', async ({ page }) => {
		await page.goto(`/?game=blank&room=player-skinned-${Date.now()}`);
		await waitForWorldReady(page);
		await enterPlayMode(page);
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

		const atRest = await readLocalPlayer(page);
		expect(atRest).not.toBeNull();
		expect(atRest!.hasRender).toBe(false);
		expect(atRest!.mesh).toContain('mannequin');
		expect(atRest!.collider).toBe('capsule');
		expect(atRest!.clip).toBe('Idle_Loop');

		const walkClip = await tickLocomotion(page, { holdW: true, frames: 40 });
		expect(walkClip).toBe('Walk_Loop');

		const jumpClip = await tickLocomotion(page, { holdSpace: true, frames: 2 });
		expect(jumpClip).toMatch(/^(Jump_Start|Jump_Loop)$/);
	});
});
