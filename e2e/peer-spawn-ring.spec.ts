import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

/** Live world-store access — resolve the module URL the app actually loaded. */
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

type SpawnXZ = { id: string; x: number; z: number };

async function playerSpawnXZ(page: Page): Promise<SpawnXZ[]> {
	return worldProbe<SpawnXZ[]>(
		page,
		`(w) => w.entities
			.filter((e) => e.id.startsWith('entity:player/'))
			.map((e) => {
				const pos = e.components?.Transform?.position;
				if (!Array.isArray(pos) || pos.length < 3) return null;
				return { id: e.id, x: pos[0], z: pos[2] };
			})
			.filter(Boolean)`
	);
}

function minPairwiseXZDistance(positions: SpawnXZ[]): number {
	if (positions.length < 2) return Infinity;
	let min = Infinity;
	for (let i = 0; i < positions.length; i++) {
		for (let j = i + 1; j < positions.length; j++) {
			const dx = positions[j]!.x - positions[i]!.x;
			const dz = positions[j]!.z - positions[i]!.z;
			min = Math.min(min, Math.hypot(dx, dz));
		}
	}
	return min;
}

async function waitForPlayReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
}

async function waitForTwoPlayers(page: Page, timeoutMs = 30_000): Promise<SpawnXZ[]> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const positions = await playerSpawnXZ(page);
		if (positions.length >= 2) return positions;
		await page.waitForTimeout(500);
	}
	return playerSpawnXZ(page);
}

test.describe('peer spawn ring', () => {
	test('two peers in orbit do not stack on spawn', async ({ context }) => {
		const room = `spawn-ring-${Date.now()}`;
		const peerA = await context.newPage();
		const peerB = await context.newPage();
		await primeCollabStorage(peerA);
		await primeCollabStorage(peerB);

		await peerA.goto(`/?game=orbit&mode=play&room=${room}`);
		await peerB.goto(`/?game=orbit&mode=play&room=${room}`);

		await waitForPlayReady(peerA);
		await waitForPlayReady(peerB);

		const positionsA = await waitForTwoPlayers(peerA);
		const positionsB = await waitForTwoPlayers(peerB);

		expect(positionsA.length, 'peer A should see two player entities').toBeGreaterThanOrEqual(2);
		expect(positionsB.length, 'peer B should see two player entities').toBeGreaterThanOrEqual(2);

		const minA = minPairwiseXZDistance(positionsA);
		const minB = minPairwiseXZDistance(positionsB);

		expect(minA, `peer A min XZ separation (${minA.toFixed(2)}m)`).toBeGreaterThanOrEqual(1.0);
		expect(minB, `peer B min XZ separation (${minB.toFixed(2)}m)`).toBeGreaterThanOrEqual(1.0);
	});
});
