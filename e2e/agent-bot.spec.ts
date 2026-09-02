import { expect, test, type Page } from '@playwright/test';

const AGENT_URL = '/?game=agent-demo&agent=brave&mode=play&net=local';

async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
}

async function chatProbe<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
	return page.evaluate(
		async ({ body, params }) => {
			const resources = performance.getEntriesByType('resource').map((r) => r.name);
			const chatUrl =
				resources.find((n) => n.includes('/collab/roomChat.svelte.ts')) ??
				'/src/lib/engine/collab/roomChat.svelte.ts';
			const sessionUrl =
				resources.find((n) => n.includes('/net/session.svelte.ts')) ??
				'/src/lib/engine/net/session.svelte.ts';
			const { roomChat } = await import(/* @vite-ignore */ chatUrl);
			const { session } = await import(/* @vite-ignore */ sessionUrl);
			return new Function(
				'roomChat',
				'session',
				'params',
				`return (${body})(roomChat, session, ...(params ?? []))`
			)(roomChat, session, params);
		},
		{ body: fn, params: args }
	) as Promise<T>;
}

async function worldProbe<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(async ({ body }) => {
		const resources = performance.getEntriesByType('resource').map((r) => r.name);
		const worldUrl =
			resources.find((n) => n.includes('/runtime/world.svelte.ts')) ??
			'/src/lib/engine/runtime/world.svelte.ts';
		const { world } = await import(/* @vite-ignore */ worldUrl);
		return new Function('world', `return (${body})(world)`)(world);
	}, { body: fn }) as Promise<T>;
}

test.describe('agent bot player', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('spawns Brave and replies in proximity chat', async ({ page }) => {
		await page.goto(AGENT_URL);
		await waitForWorldReady(page);

		const botId = await worldProbe<string | null>(
			page,
			`(world) => world.getEntity('entity:player/bot:brave')?.id ?? null`
		);
		expect(botId).toBe('entity:player/bot:brave');

		await worldProbe(page, `(world) => {
			const bot = world.getEntity('entity:player/bot:brave');
			const player = world.localPlayerEntity;
			if (!bot || !player) return;
			const botPos = bot.components.Transform?.position;
			const playerPos = player.components.Transform?.position;
			if (!botPos || !playerPos) return;
			world.applyFieldLocal(player.id, 'Transform', 'position', [
				botPos[0] + 1.2,
				playerPos[1],
				botPos[2]
			]);
		}`);

		await expect(page.getByText('Talk with Brave')).toBeVisible({ timeout: 10_000 });

		await chatProbe(
			page,
			`async (roomChat, session) => {
				const { convoId, members } = roomChat.startConvo('bot:brave');
				session.sendChatOpen(convoId, members);
				session.sendChat('hello brave');
			}`
		);

		await expect(page.getByRole('dialog', { name: 'Room chat' })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText(/Hello! I'm Brave|mock/i)).toBeVisible({ timeout: 20_000 });
	});
});
