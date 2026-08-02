import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

declare global {
	interface Window {
		__motorFeel?: { restY: number; groundHeight: number; t: number; tick: number };
	}
}

type MotorStepResult = {
	x: number;
	z: number;
	/** Horizontal displacement during this step batch. */
	dx: number;
	vx: number;
	vz: number;
	y: number;
	vy: number;
	grounded: boolean;
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
		const playerMod = await import(
			/* @vite-ignore */ moduleUrl(
				'/player/playerSystem.ts',
				'/src/lib/engine/player/playerSystem.ts'
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
			'playerMod',
			'jumpMod',
			'scheduler',
			`return (${body})(world, groundStore, playerMod, jumpMod, scheduler)`
		)(world, groundStore, playerMod, jumpMod, scheduler);
	}, fn) as Promise<T>;
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

async function configureMotor(page: Page, fields: Record<string, unknown> = {}) {
	await appProbe<void>(
		page,
		`(world, groundStore, playerMod, jumpMod, scheduler) => {
			scheduler.pause();
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			const motor = player.components.Player;
			if (!transform || !jump || !motor) throw new Error('missing player components');
			const restY = transform.position[1];
			const groundHeight = groundStore.height;
			playerMod.resetPlayerMovementState();
			jumpMod.resetJumpInputState();
			Object.assign(motor, ${JSON.stringify(fields)});
			Object.assign(jump, { vy: 0, cooldown: 0, useJumpCurve: false, jumpDelay: 0 });
			transform.position = [transform.position[0], restY, transform.position[2]];
			groundStore.height = groundHeight;
			groundStore.grounded = true;
			groundStore.normal = [0, 1, 0];
			window.__motorFeel = { restY, groundHeight, t: 0, tick: 0 };
		}`
	);
}

async function stepMotor(page: Page, frames: number, dt = 1 / 60): Promise<MotorStepResult> {
	return appProbe<MotorStepResult>(
		page,
		`(world, groundStore, playerMod, jumpMod) => {
			const state = window.__motorFeel;
			if (!state) throw new Error('motor test state missing');
			const player = world.localPlayerId && world.getEntity(world.localPlayerId);
			if (!player) throw new Error('missing local player');
			const transform = player.components.Transform;
			const jump = player.components.Jump;
			const startX = transform.position[0];
			for (let i = 0; i < ${frames}; i += 1) {
				const pos = transform.position;
				const resting = pos[1] <= state.restY + 0.025 && jump.vy <= 0.01;
				groundStore.height = state.groundHeight;
				groundStore.grounded = resting;
				if (resting && pos[1] < state.restY) transform.position = [pos[0], state.restY, pos[2]];
				const ctx = { dt: ${dt}, t: state.t, tick: state.tick };
				playerMod.playerSystem(ctx);
				jumpMod.jumpSystem(ctx);
				state.t += ${dt};
				state.tick += 1;
			}
			const [vx, vz] = playerMod.peekHorizontalVelocity();
			return {
				x: transform.position[0],
				z: transform.position[2],
				dx: transform.position[0] - startX,
				vx,
				vz,
				y: transform.position[1],
				vy: jump.vy,
				grounded: groundStore.grounded
			};
		}`
	);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await openPlayWorld(page, `movement-motor-${Date.now()}`);
});

test('ground motor ramps up instead of teleporting at full speed on frame one', async ({ page }) => {
	await configureMotor(page, { groundAcc: 7, airAcc: 2, airDrag: 1 });
	await page.keyboard.down('d');

	const first = await stepMotor(page, 1);
	const later = await stepMotor(page, 9);
	await page.keyboard.up('d');

	const firstDx = first.dx;
	const laterDx = later.dx;
	const dt = 1 / 60;
	const jogSpeed = 3.4;
	const instantFrame = jogSpeed * dt;

	expect(Math.abs(firstDx), 'first frame should not reach full-speed displacement').toBeLessThan(
		instantFrame * 0.85
	);
	expect(Math.abs(laterDx), 'later frames should accumulate more distance while accelerating').toBeGreaterThan(
		Math.abs(firstDx)
	);
	expect(Math.abs(later.vx), 'velocity should be building toward target').toBeGreaterThan(Math.abs(first.vx));
});

test('air carry preserves horizontal momentum after input release', async ({ page }) => {
	await configureMotor(page, { groundAcc: 7, airAcc: 2, airDrag: 0.35 });
	await page.keyboard.down('d');
	await stepMotor(page, 20);
	await page.keyboard.up('d');

	await page.keyboard.press(' ');
	const beforeAirborne = await stepMotor(page, 1);
	const airborne = await stepMotor(page, 8);
	const airCarry = await stepMotor(page, 12);

	await configureMotor(page, { groundAcc: 7, airAcc: 2, airDrag: 0.35 });
	await page.keyboard.down('d');
	await stepMotor(page, 20);
	await page.keyboard.up('d');
	const groundRelease = await stepMotor(page, 1);
	const groundCarry = await stepMotor(page, 12);

	expect(airborne.y, 'player should leave the ground after jump').toBeGreaterThan(beforeAirborne.y + 0.05);
	const airCoastDx = Math.abs(airCarry.x - airborne.x);
	const groundCoastDx = Math.abs(groundCarry.x - groundRelease.x);
	expect(airCoastDx, 'airborne coast should move horizontally').toBeGreaterThan(0.08);
	expect(airCoastDx, 'air coast should exceed ground release coast').toBeGreaterThan(groundCoastDx);
});

test('air steering changes velocity less than ground steering for the same input', async ({ page }) => {
	await configureMotor(page, { groundAcc: 7, airAcc: 2, airDrag: 1 });

	await page.keyboard.down('d');
	const groundStart = await stepMotor(page, 30);
	await page.keyboard.up('d');
	await page.keyboard.down('a');
	const groundSteer = await stepMotor(page, 15);
	await page.keyboard.up('a');
	const groundDelta = Math.abs(groundSteer.vx - groundStart.vx);

	await configureMotor(page, { groundAcc: 7, airAcc: 2, airDrag: 1 });
	await page.keyboard.down('d');
	await stepMotor(page, 20);
	await page.keyboard.press(' ');
	await stepMotor(page, 6);
	await page.keyboard.up('d');
	const airStart = await stepMotor(page, 1);
	await page.keyboard.down('a');
	const airSteer = await stepMotor(page, 15);
	await page.keyboard.up('a');
	const airDelta = Math.abs(airSteer.vx - airStart.vx);

	expect(groundDelta, 'ground steering should produce meaningful velocity change').toBeGreaterThan(0.5);
	expect(airDelta, 'airborne steering should be weaker than on ground').toBeLessThan(groundDelta * 0.75);
});
