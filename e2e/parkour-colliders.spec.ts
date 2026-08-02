/**
 * TRL-153 — parkour fixed Physics bodies must sit at Transform, not the origin.
 * Spec: docs/artifacts/player_avatar_polish_spec.md §6
 */
import { expect, test } from '@playwright/test';
import { enterPlayMode, primeCollabStorage, waitForWorldReady } from './helpers';

const PLATFORM_ID = 'entity:platform/start';

async function readPlatformPose(page: import('@playwright/test').Page) {
	return page.evaluate(async (entityId) => {
		const moduleUrl = (part: string, fallback: string) =>
			performance
				.getEntriesByType('resource')
				.map((r) => r.name)
				.find((n) => n.includes(part)) ?? fallback;
		const { world, getEntityRigidBodyTranslation } = await import(
			/* @vite-ignore */ moduleUrl(
				'/runtime/world.svelte.ts',
				'/src/lib/engine/runtime/world.svelte.ts'
			)
		);
		const e = world.getEntity(entityId);
		const pos = (e?.components.Transform as { position?: number[] } | undefined)?.position;
		const transform = pos ? [pos[0], pos[1], pos[2]] : null;
		const rigidBody = getEntityRigidBodyTranslation(entityId);
		return { transform, rigidBody };
	}, PLATFORM_ID);
}

async function waitForRigidBodySync(
	page: import('@playwright/test').Page,
	transform: number[],
	timeoutMs = 8000
) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const pose = await readPlatformPose(page);
		if (pose.rigidBody) {
			const dx = Math.abs(pose.rigidBody[0] - transform[0]);
			const dy = Math.abs(pose.rigidBody[1] - transform[1]);
			const dz = Math.abs(pose.rigidBody[2] - transform[2]);
			if (dx < 0.5 && dy < 0.5 && dz < 0.5) return pose;
		}
		await page.waitForTimeout(100);
	}
	return readPlatformPose(page);
}

test.describe('parkour physics collider poses', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('platform RigidBody translation matches Transform (edit + play)', async ({ page }) => {
		await page.goto(`/?game=parkour&room=parkour-col-${Date.now()}`);
		await waitForWorldReady(page);

		const editPose = await waitForRigidBodySync(page, [0, 0.5, -4]);
		expect(editPose.transform).not.toBeNull();
		expect(editPose.rigidBody).not.toBeNull();
		expect(Math.hypot(editPose.transform![0], editPose.transform![2])).toBeGreaterThan(1);
		expect(Math.abs(editPose.rigidBody![0] - editPose.transform![0])).toBeLessThan(0.5);
		expect(Math.abs(editPose.rigidBody![1] - editPose.transform![1])).toBeLessThan(0.5);
		expect(Math.abs(editPose.rigidBody![2] - editPose.transform![2])).toBeLessThan(0.5);

		await enterPlayMode(page);
		const playPose = await waitForRigidBodySync(page, editPose.transform!);
		expect(playPose.rigidBody).not.toBeNull();
		expect(Math.abs(playPose.rigidBody![0] - playPose.transform![0])).toBeLessThan(0.5);
		expect(Math.abs(playPose.rigidBody![2] - playPose.transform![2])).toBeLessThan(0.5);
	});
});
