import { expect, test, type Page } from '@playwright/test';

const CHAT_URL = '/?game=orbit&net=local';
const PLAY_URL = '/?game=orbit&net=local&play';

async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

async function waitForWorldReady(page: Page, mode: 'edit' | 'play' = 'edit') {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	if (mode === 'edit') {
		await expect(page.getByRole('combobox', { name: 'Select scene' })).toBeVisible();
	} else {
		await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
	}
}

async function openEditChat(page: Page) {
	const btn = page.getByRole('button', { name: 'Open room chat' });
	await expect(btn).toBeVisible({ timeout: 10_000 });
	await btn.click();
	await expect(page.getByRole('dialog', { name: 'Room chat' })).toBeVisible();
	await expect(page.getByLabel('Chat message')).toBeEnabled({ timeout: 10_000 });
}

/** Live roomChat + session access via the module URL the app loaded. */
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

test.describe('room chat', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('opens chat panel from doc bar in edit mode', async ({ page }) => {
		await page.goto(CHAT_URL);
		await waitForWorldReady(page);
		await openEditChat(page);
		await expect(page.getByPlaceholder('Message the room…')).toBeVisible();
	});

	test('syncs messages across tabs in edit mode', async ({ context }) => {
		const pageA = await context.newPage();
		const pageB = await context.newPage();

		await primeCollabStorage(pageA);
		await primeCollabStorage(pageB);

		await pageA.goto(CHAT_URL);
		await pageB.goto(CHAT_URL);
		await waitForWorldReady(pageA);
		await waitForWorldReady(pageB);

		await openEditChat(pageA);
		await openEditChat(pageB);

		await pageA.getByLabel('Chat message').fill('hello from tab A');
		await pageA.getByRole('button', { name: 'Send message' }).click();

		await expect(pageB.getByText('hello from tab A')).toBeVisible({ timeout: 10_000 });
		await expect(pageB.getByText('You', { exact: true })).toHaveCount(0);

		await pageA.close();
		await pageB.close();
	});

	test('play-mode 1:1 messages do not leak to unrelated peers', async ({ context }) => {
		const pageA = await context.newPage();
		const pageB = await context.newPage();
		const pageC = await context.newPage();

		await primeCollabStorage(pageA);
		await primeCollabStorage(pageB);
		await primeCollabStorage(pageC);

		await pageA.goto(PLAY_URL);
		await pageB.goto(PLAY_URL);
		await pageC.goto(PLAY_URL);
		await waitForWorldReady(pageA, 'play');
		await waitForWorldReady(pageB, 'play');
		await waitForWorldReady(pageC, 'play');

		const clientB = await chatProbe(pageB, `(_roomChat, session) => session.clientId`);

		await chatProbe(
			pageA,
			`async (roomChat, session, partnerId) => {
				const { convoId, members } = roomChat.startConvo(partnerId);
				session.sendChatOpen(convoId, members);
				session.sendChat('secret ab only');
			}`,
			clientB
		);

		await expect(pageB.getByText('secret ab only')).toBeVisible({ timeout: 10_000 });

		const leaked = await chatProbe(
			pageC,
			`(roomChat) => roomChat.messages.some((m) => m.text === 'secret ab only')`
		);
		expect(leaked).toBe(false);

		await pageA.close();
		await pageB.close();
		await pageC.close();
	});

	test('third peer can join a play-mode group conversation', async ({ context }) => {
		const pageA = await context.newPage();
		const pageB = await context.newPage();
		const pageC = await context.newPage();

		await primeCollabStorage(pageA);
		await primeCollabStorage(pageB);
		await primeCollabStorage(pageC);

		await pageA.goto(PLAY_URL);
		await pageB.goto(PLAY_URL);
		await pageC.goto(PLAY_URL);
		await waitForWorldReady(pageA, 'play');
		await waitForWorldReady(pageB, 'play');
		await waitForWorldReady(pageC, 'play');

		const clientB = await chatProbe(pageB, `(_roomChat, session) => session.clientId`);

		await chatProbe(
			pageA,
			`async (roomChat, session, partnerId) => {
				const { convoId, members } = roomChat.startConvo(partnerId);
				session.sendChatOpen(convoId, members);
			}`,
			clientB
		);

		await expect(pageB.getByRole('dialog', { name: 'Room chat' })).toBeVisible({
			timeout: 10_000
		});

		await chatProbe(
			pageC,
			`async (roomChat, session, anchorPeerId) => {
				const info = roomChat.peerConvo[anchorPeerId];
				if (!info) throw new Error('expected convo discovery from peer');
				const members = [...new Set([...info.members, session.clientId])].sort();
				roomChat.joinConvo(info.convoId, members);
				session.sendConvoJoin(info.convoId, members);
				session.sendChat('hello from the third');
			}`,
			clientB
		);

		await expect(pageA.getByText('hello from the third')).toBeVisible({ timeout: 10_000 });
		await expect(pageB.getByText('hello from the third')).toBeVisible({ timeout: 10_000 });

		await pageA.close();
		await pageB.close();
		await pageC.close();
	});
});
