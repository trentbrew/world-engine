import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

declare global {
	interface Window {
		__jumpSfxCalls?: string[];
		__jumpFeel?: { restY: number; groundHeight: number; t: number; tick: number };
	}
}

type StepResult = {
	y: number;
	vy: number;
	maxY: number;
	grounded: boolean;
	sfx: string[];
};

async function appProbe<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(async (body) => {
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
		const { groundStore } = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/groundStore.svelte.ts',
				'/src/lib/engine/player/groundStore.svelte.ts'
			)
		);
		const jumpMod = await import(
			/* @vite-ignore */ moduleUrl(
				'/systems/behaviors/jump.ts',
				'/src/lib/engine/systems/behaviors/jump.ts'
			)
		);
		const { scheduler } = await import(
			/* @vite-ignore */ moduleUrl(
				'/systems/scheduler.svelte.ts',
				'/src/lib/engine/systems/scheduler.svelte.ts'
			)
		);

		return new Function(
			'world',
			'groundStore',
			'jumpMod',
			'scheduler',
			`return (${body})(world, groundStore, jumpMod, scheduler)`
		)(world, groundStore, jumpMod, scheduler);
	}, fn) as Promise<T>;
}

async function installAudioSpy(page: Page) {
	await page.addInitScript(() => {
		window.__jumpSfxCalls = [];
		HTMLMediaElement.prototype.play = function () {
			window.__jumpSfxCalls?.push((this as HTMLAudioElement).currentSrc || (this as HTMLAudioElement).src);
			return Promise.resolve();
		};
	});
}

async function openPlayWorld(page: Page, room: string) {
	await primeCollabStorage(page);
	await page.goto(`/?game=physics&mode=play&room=${room}`);
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	await page.waitForTimeout(500);
}

async function configureJump(page: Page, fields: Record<string, unknown> = {}) {
	await appProbe<void>(
		page,
		`(world, groundStore, jumpMod, scheduler) => {
			scheduler.pause();
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			if (!transform || !jump) throw new Error('missing player Transform/Jump');
			const restY = transform.position[1];
			const groundHeight = groundStore.height;
			jumpMod.resetJumpInputState();
			Object.assign(jump, { vy: 0, jumpDelay: 0 }, ${JSON.stringify(fields)});
			transform.position = [transform.position[0], restY, transform.position[2]];
			groundStore.height = groundHeight;
			groundStore.grounded = true;
			groundStore.normal = [0, 1, 0];
			window.__jumpSfxCalls = [];
			window.__jumpFeel = { restY, groundHeight, t: 0, tick: 0 };
		}`
	);
}

async function stepJump(page: Page, frames: number, dt = 1 / 60): Promise<StepResult> {
	return appProbe<StepResult>(
		page,
		`(world, groundStore, jumpMod) => {
			const state = window.__jumpFeel;
			if (!state) throw new Error('jump test state missing');
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			let maxY = transform.position[1];
			for (let i = 0; i < ${frames}; i += 1) {
				const pos = transform.position;
				const resting = pos[1] <= state.restY + 0.025 && jump.vy <= 0.01;
				groundStore.height = state.groundHeight;
				groundStore.grounded = resting;
				if (resting && pos[1] < state.restY) transform.position = [pos[0], state.restY, pos[2]];
				jumpMod.jumpSystem({ dt: ${dt}, t: state.t, tick: state.tick });
				state.t += ${dt};
				state.tick += 1;
				maxY = Math.max(maxY, transform.position[1]);
			}
			return {
				y: transform.position[1],
				vy: jump.vy,
				maxY,
				grounded: groundStore.grounded,
				sfx: window.__jumpSfxCalls ?? []
			};
		}`
	);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await installAudioSpy(page);
	await openPlayWorld(page, `jump-feel-${Date.now()}`);
});

test('coyote jump fires shortly after leaving ground', async ({ page }) => {
	await configureJump(page, { coyoteMs: 120, cooldown: 0, airJumps: 0, useJumpCurve: false });
	await stepJump(page, 1);

	await appProbe<void>(
		page,
		`(world) => {
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			transform.position = [transform.position[0], window.__jumpFeel.restY + 0.12, transform.position[2]];
		}`
	);

	await stepJump(page, 3);
	await page.keyboard.down(' ');
	const result = await stepJump(page, 1);
	await page.keyboard.up(' ');

	expect(result.vy, 'coyote jump should produce upward velocity').toBeGreaterThan(0);
});

test('holding jump reaches a higher apex than tapping with curve mode enabled', async ({ page }) => {
	const fields = {
		height: 0.7,
		cooldown: 0,
		airJumps: 0,
		useJumpCurve: true,
		jumpTime: 450,
		jumpCurveForce: 35,
		jumpCurve: [
			[0, 1],
			[1, 1]
		]
	};

	await configureJump(page, fields);
	await page.keyboard.down(' ');
	await stepJump(page, 2);
	await page.keyboard.up(' ');
	const tap = await stepJump(page, 90);

	await configureJump(page, fields);
	await page.keyboard.down(' ');
	const holdRise = await stepJump(page, 28);
	await page.keyboard.up(' ');
	const holdFall = await stepJump(page, 70);
	const heldMaxY = Math.max(holdRise.maxY, holdFall.maxY);

	expect(heldMaxY, 'held jump should gain visible extra height').toBeGreaterThan(tap.maxY + 0.2);
});

test('double jump consumes the only air jump before landing', async ({ page }) => {
	await configureJump(page, { height: 0.8, cooldown: 0, airJumps: 1, useJumpCurve: false });

	await page.keyboard.press(' ');
	await stepJump(page, 12);
	await page.keyboard.press(' ');
	const second = await stepJump(page, 1);

	await stepJump(page, 6);
	await page.keyboard.press(' ');
	const third = await stepJump(page, 1);

	expect(second.vy, 'second jump should reset upward velocity').toBeGreaterThan(0);
	expect(third.vy, 'third airborne press should not grant another impulse').toBeLessThan(second.vy);
});
