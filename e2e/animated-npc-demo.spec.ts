/**
 * Phase 1 skinned-mesh animation — runtime verification.
 *
 * Loads the animated-npc-demo world and asserts the acceptance criteria from
 * docs/artifacts/skinned_mesh_animation_spec.md:
 *   - two Character entities load with SkinnedMesh + Mesh3DAnimator
 *   - both share one mannequin.glb → fetched exactly once (no duplicate payload)
 *   - lean mannequin has no embedded clips; base + addon clips resolve from the
 *     shared catalog packs (mesh fetch deduped via loadGltf cache)
 *   - clip resolution returns real AnimationClips; unknown clips return undefined
 *   - no fatal console errors (clone / mixer / resolve did not throw)
 */
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT = 'test-results/animated-npc-demo.png';

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

/** Read a live component field off a world entity (in whatever mode is active). */
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

test.describe('animated-npc-demo (skinned mesh + clip catalog)', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('two characters share one mesh, resolve clips, no fatal errors', async ({ page }) => {
		const errors = collectConsoleErrors(page);
		// Unique room per test so parallel workers don't share a room and fight over
		// host ownership of the NPC entities.
		await page.goto(`/?game=animated-npc-demo&room=npc-share-${Date.now()}`);
		await waitForWorldReady(page);
		// let the GLB load + several animation frames elapse
		await page.waitForTimeout(1500);
		await page.screenshot({ path: SCREENSHOT });

		// --- both Character entities loaded with the right components ------------
		const entities = await page.evaluate(async () => {
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
			const pick = (id: string) => {
				const e = world.getEntity(id);
				if (!e) return null;
				return {
					mesh: e.components?.SkinnedMesh?.mesh,
					clip: e.components?.Mesh3DAnimator?.clip
				};
			};
			return { guard: pick('entity:npc/guard'), walker: pick('entity:npc/walker') };
		});
		expect(entities.guard).toMatchObject({
			mesh: '/models/characters/mannequin.glb',
			clip: 'Idle_Loop'
		});
		expect(entities.walker).toMatchObject({
			mesh: '/models/characters/mannequin.glb',
			clip: 'Walk_Loop'
		});

		// --- shared mesh + clip resolution, all through the loader the view uses.
		// (Resource-timing counts are unreliable in Vite dev — >250 module requests
		// evict early entries — so we assert the cache mechanism directly instead.)
		const probe = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const cc = await import(
				/* @vite-ignore */ moduleUrl(
					'/animation/clipCatalog.ts',
					'/src/lib/engine/animation/clipCatalog.ts'
				)
			);
			const mesh = '/models/characters/mannequin.glb';
			// Two loads return the SAME cached promise → both NPCs share one fetch.
			const dedup = cc.loadGltf(mesh) === cc.loadGltf(mesh);
			const gltf = await cc.loadGltf(mesh);
			const embedded = gltf.animations;
			const idle = await cc.resolveClip('catalog:mesh2motion-human', 'Idle_Loop', embedded);
			const walk = await cc.resolveClip('catalog:mesh2motion-human', 'Walk_Loop', embedded);
			const addon = await cc.resolveClip('catalog:mesh2motion-human', 'Angry', embedded);
			const bogus = await cc.resolveClip('catalog:mesh2motion-human', 'Nope_NotReal', embedded);
			return {
				dedup,
				embeddedCount: embedded.length,
				// lean mesh has no embedded clips → all resolve from catalog packs
				idle: idle ? { name: idle.name, hasDur: idle.duration > 0, embedded: embedded.includes(idle) } : null,
				walk: walk ? { name: walk.name, embedded: embedded.includes(walk) } : null,
				addon: addon ? { name: addon.name, embedded: embedded.includes(addon) } : null,
				bogus: bogus ?? null
			};
		});
		expect(probe.dedup, 'both NPCs share one cached GLB fetch').toBe(true);
		expect(probe.embeddedCount, 'lean mannequin has no embedded clips').toBe(0);
		expect(probe.idle).toMatchObject({ name: 'Idle_Loop', hasDur: true, embedded: false });
		expect(probe.walk).toMatchObject({ name: 'Walk_Loop', embedded: false });
		expect(probe.addon, 'addon clip resolves from shared pack').toMatchObject({
			name: 'Angry',
			embedded: false
		});
		expect(probe.bogus, 'unknown clip resolves to undefined').toBeNull();

		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});

	test('play mode: event-driven clip switch, play/pause, and root motion', async ({ page }) => {
		const errors = collectConsoleErrors(page);
		// Unique room so this worker is the sole member → host → owns the NPCs whose
		// alarms/events we assert on.
		await page.goto(`/?game=animated-npc-demo&room=npc-play-${Date.now()}`);
		await waitForWorldReady(page);

		// Systems (alarms/events) + root motion only run in play mode.
		await page.getByRole('tab', { name: 'Play' }).click();
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');

		// clip-switch via alarm event: guard flips Idle_Loop → Dance_Loop (~2.5s).
		await expect
			.poll(() => readField(page, 'entity:npc/guard', 'Mesh3DAnimator', 'clip'), { timeout: 15_000 })
			.toBe('Dance_Loop');

		// play/pause via alarm event: walker freezes (~3s).
		await expect
			.poll(() => readField(page, 'entity:npc/walker', 'Mesh3DAnimator', 'playing'), {
				timeout: 15_000
			})
			.toBe(false);

		// root motion: Roll_RM drives the root bone → roller's Transform travels away
		// from its start (z = 0). Direction-agnostic: assert it moved, not which way.
		await expect
			.poll(
				async () => {
					const p = await readField(page, 'entity:npc/roller', 'Transform', 'position');
					return Array.isArray(p) ? Math.abs(Number(p[2])) : 0;
				},
				{ timeout: 15_000 }
			)
			.toBeGreaterThan(2);

		await page.screenshot({ path: 'test-results/animated-npc-demo-play.png' });
		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});

	test('placement routes a rigged GLB to a Character, a static GLB to a Prop', async ({ page }) => {
		const errors = collectConsoleErrors(page);
		await page.goto(`/?game=animated-npc-demo&room=npc-place-${Date.now()}`);
		await waitForWorldReady(page);

		const result = await page.evaluate(async () => {
			const moduleUrl = (part: string, fallback: string) =>
				performance
					.getEntriesByType('resource')
					.map((r) => r.name)
					.find((n) => n.includes(part)) ?? fallback;
			const cc = await import(
				/* @vite-ignore */ moduleUrl(
					'/animation/clipCatalog.ts',
					'/src/lib/engine/animation/clipCatalog.ts'
				)
			);
			const { world } = await import(
				/* @vite-ignore */ moduleUrl(
					'/runtime/world.svelte.ts',
					'/src/lib/engine/runtime/world.svelte.ts'
				)
			);
			const ps = await import(
				/* @vite-ignore */ moduleUrl('/scene/placementSession.ts', '/src/lib/scene/placementSession.ts')
			);
			const { ui } = await import(
				/* @vite-ignore */ moduleUrl('/ui/ui.svelte.ts', '/src/lib/ui/ui.svelte.ts')
			);

			const riggedMannequin = await cc.isRiggedModel('/models/characters/mannequin.glb');
			const riggedBarrel = await cc.isRiggedModel('/models/barrel.glb');

			// rigged GLB → animated Character
			ui.placementDraft = ps.draftFromModel('/models/characters/mannequin.glb', 'Mannequin');
			ui.placementPosition = [4, 0, 2];
			await ps.commitPlacement();

			// static GLB → static Prop
			ui.placementDraft = ps.draftFromModel('/models/barrel.glb', 'Barrel');
			ui.placementPosition = [-4, 0, 2];
			await ps.commitPlacement();

			const entities = world.entities as Array<{
				id: string;
				type?: string;
				components?: Record<string, Record<string, unknown>>;
			}>;
			const char = entities.find((e) => e.id.startsWith('entity:character/'));
			const prop = entities.find((e) => e.id.startsWith('entity:prop/'));
			return {
				riggedMannequin,
				riggedBarrel,
				char: char
					? {
							type: char.type,
							mesh: char.components?.SkinnedMesh?.mesh,
							clip: char.components?.Mesh3DAnimator?.clip
						}
					: null,
				prop: prop ? { type: prop.type, mesh: prop.components?.Render?.mesh } : null
			};
		});

		expect(result.riggedMannequin, 'mannequin detected as rigged').toBe(true);
		expect(result.riggedBarrel, 'barrel detected as static').toBe(false);
		expect(result.char).toMatchObject({
			type: 'Character',
			mesh: '/models/characters/mannequin.glb',
			clip: 'Idle_Loop'
		});
		expect(result.prop).toMatchObject({ type: 'Prop', mesh: '/models/barrel.glb' });

		await page.waitForTimeout(600);
		await page.screenshot({ path: 'test-results/animated-npc-demo-place.png' });
		expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
	});
});
