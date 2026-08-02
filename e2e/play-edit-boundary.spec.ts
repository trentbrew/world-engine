import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

/** Live world-store access — resolve the module URL the app actually loaded
 * (bare imports can create a second instance once HMR versions the graph). */
async function worldProbe<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(async (body) => {
		const url =
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes('/runtime/world.svelte.ts')) ??
			'/src/lib/engine/runtime/world.svelte.ts';
		const { world } = await import(/* @vite-ignore */ url);
		return new Function('world', `return (${body})(world)`)(world);
	}, fn) as Promise<T>;
}

const countCoins = (page: Page) =>
	worldProbe<number>(
		page,
		`(w) => w.entities.filter((e) => 'Collectible' in e.components).length`
	);

/** Player position and nearest coin offset, for steering. */
const nearestCoin = (page: Page) =>
	worldProbe<{ dx: number; dz: number } | null>(
		page,
		`(w) => {
			const p = w.localPlayerId && w.getEntity(w.localPlayerId);
			const pp = p?.components?.Transform?.position;
			if (!pp) return null;
			let best = null;
			for (const e of w.entities) {
				if (!('Collectible' in e.components)) continue;
				const ep = e.components.Transform?.position;
				if (!ep) continue;
				const dx = ep[0] - pp[0];
				const dz = ep[2] - pp[2];
				if (!best || dx * dx + dz * dz < best.d) best = { dx, dz, d: dx * dx + dz * dz };
			}
			return best && { dx: best.dx, dz: best.dz };
		}`
	);

async function steerUntilCollected(page: Page, initial: number): Promise<number> {
	const deadline = Date.now() + 20_000;
	let remaining = initial;
	while (remaining === initial && Date.now() < deadline) {
		const target = await nearestCoin(page);
		if (!target) break;
		const keyX = target.dx > 0.3 ? 'd' : target.dx < -0.3 ? 'a' : null;
		const keyZ = target.dz > 0.3 ? 's' : target.dz < -0.3 ? 'w' : null;
		for (const key of [keyX, keyZ]) if (key) await page.keyboard.down(key);
		await page.waitForTimeout(250);
		for (const key of [keyX, keyZ]) if (key) await page.keyboard.up(key);
		remaining = await countCoins(page);
	}
	return remaining;
}

test('coins collected in play are restored when returning to edit', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto('/?game=collect&mode=play&room=boundary-test');
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	await page.waitForTimeout(1000);

	const initial = await countCoins(page);
	expect(initial, 'collect world should start with coins').toBeGreaterThan(0);

	const remaining = await steerUntilCollected(page, initial);
	expect(remaining, 'walking into a coin should collect it').toBeLessThan(initial);

	// Exit to edit — the collected coin must come back.
	await page.keyboard.press('Escape');
	await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	await page.waitForTimeout(500);
	expect(await countCoins(page), 'edit mode must show the full authored coin set').toBe(initial);
});

test('runtime despawns do not reach a peer in edit mode', async ({ context }) => {
	const room = `boundary-peers-${Date.now()}`;
	const editor = await context.newPage();
	const player = await context.newPage();
	await primeCollabStorage(editor);
	await primeCollabStorage(player);

	await editor.goto(`/?game=collect&mode=edit&room=${room}`);
	await expect(editor.locator('#world-status')).toContainText(/World loaded/i, {
		timeout: 30_000
	});

	await player.goto(`/?game=collect&mode=play&room=${room}`);
	await expect(player.locator('#world-status')).toContainText(/World loaded/i, {
		timeout: 30_000
	});
	await expect(player.getByRole('tab', { name: 'Play' })).toHaveAttribute(
		'aria-selected',
		'true',
		{ timeout: 15_000 }
	);
	await player.waitForTimeout(1000);

	const initial = await countCoins(player);
	expect(initial).toBeGreaterThan(0);

	await player.bringToFront();
	const remaining = await steerUntilCollected(player, initial);
	expect(remaining, 'player should collect a coin').toBeLessThan(initial);

	// The editor's authored world must be untouched by the match despawn.
	await editor.waitForTimeout(500);
	expect(await countCoins(editor), 'editor peer must keep the authored coin set').toBe(initial);
});
