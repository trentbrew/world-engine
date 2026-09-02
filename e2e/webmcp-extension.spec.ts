/**
 * Integration with the WebMCP Agent Substrate extension.
 *
 * The extension injects `mcp-main.js` into the page's MAIN world at
 * document_start and wraps `modelContext.registerTool` so it can keep a live
 * reference to each tool's `execute` (the native `getTools()` deliberately does
 * not expose it). A tool is only invokable by the extension if it was registered
 * *after* that wrap.
 *
 * This matters here because museum-oss registers late — gated on
 * `world.status === 'ready'`, behind asset loading and network connect — while
 * the extension's fallback poll for a late-appearing `modelContext` gives up
 * after ~8s. The spec loads the extension's real built content script to prove
 * late registration is still captured.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, waitForWorldReady } from './helpers';
import { WEBMCP_TOOLS } from '../src/lib/engine/agent/webmcp/manifest';

const EXTENSION_MAIN_WORLD_SCRIPT =
	'/Users/trentbrew/TURTLE/Projects/Extensions/WEBMCP/webmcp/dist/assets/mcp-main.js';

type ExtTool = { name: string; description: string; invokable: boolean; origin: string };

declare global {
	interface Window {
		__extMessages: Array<Record<string, unknown>>;
		__extCall(name: string, args: unknown): Promise<Record<string, unknown>>;
	}
}

async function installExtensionHarness(page: Page) {
	// 1. Collector, first, so it sees the extension's document_start broadcasts.
	await page.addInitScript(() => {
		window.__extMessages = [];
		window.addEventListener('message', (event) => {
			if (event.source !== window) return;
			const data = event.data as { source?: string } | undefined;
			if (data?.source === 'webmcp-ext-page') window.__extMessages.push(data);
		});

		window.__extCall = (name, args) =>
			new Promise((resolve, reject) => {
				const requestId = `t${Math.random().toString(36).slice(2)}`;
				const timer = setTimeout(() => reject(new Error('tool-result timeout')), 20_000);
				const onMessage = (event: MessageEvent) => {
					const data = event.data as { source?: string; type?: string; requestId?: string };
					if (data?.source !== 'webmcp-ext-page') return;
					if (data.type !== 'tool-result' || data.requestId !== requestId) return;
					clearTimeout(timer);
					window.removeEventListener('message', onMessage);
					resolve(data as Record<string, unknown>);
				};
				window.addEventListener('message', onMessage);
				window.postMessage(
					{ source: 'webmcp-ext-bridge', type: 'call-tool', requestId, name, args },
					'*'
				);
			});
	});

	// 2. A spec-shaped native modelContext, present before the extension runs —
	//    matching Chrome 149+, where it is a [SameObject] attribute on Document.
	await page.addInitScript(() => {
		const tools = new Map<string, unknown>();
		const ctx = {
			async registerTool(tool: { name?: string }) {
				if (!tool?.name) throw new TypeError('tool.name is required');
				tools.set(tool.name, tool);
			},
			async getTools() {
				// Native getTools() omits `execute` — the reason the extension wraps.
				return [...tools.values()].map((t) => {
					const { execute, ...rest } = t as Record<string, unknown>;
					void execute;
					return rest;
				});
			},
			addEventListener() {}
		};
		Object.defineProperty(document, 'modelContext', { value: ctx, configurable: true });
	});

	// 3. The extension's real shipped MAIN-world script.
	await page.addInitScript({ content: readFileSync(EXTENSION_MAIN_WORLD_SCRIPT, 'utf8') });
}

const latestTools = (page: Page): Promise<ExtTool[]> =>
	page.evaluate(() => {
		const toolMessages = window.__extMessages.filter((m) => m.type === 'tools');
		const last = toolMessages[toolMessages.length - 1];
		return (last?.tools ?? []) as ExtTool[];
	});

test.beforeEach(async ({ page }) => {
	await installExtensionHarness(page);
	await primeCollabStorage(page);
	await page.goto(e2eWorldUrl('/?game=orbit'));
	await waitForWorldReady(page);
	await expect
		.poll(async () => (await latestTools(page)).length, { timeout: 20_000 })
		.toBeGreaterThan(0);
});

test('the extension captures every tool as invokable', async ({ page }) => {
	const tools = await latestTools(page);

	expect(tools).toHaveLength(WEBMCP_TOOLS.length);
	const notInvokable = tools.filter((t) => !t.invokable).map((t) => t.name);
	expect(notInvokable, 'tools registered too late for the extension to wrap').toEqual([]);

	expect(tools.map((t) => t.name).sort()).toContain('spawn_prop');
	expect(tools.every((t) => t.description.length > 0)).toBe(true);
});

test('the extension can invoke a read tool through the page', async ({ page }) => {
	const result = await page.evaluate(() => window.__extCall('list_entities', {}));

	expect(result.ok, `extension call failed: ${result.error}`).toBe(true);
	expect(String(result.result)).toMatch(/\d+ entities:/);
});

test('the extension can invoke a write tool and the world changes', async ({ page }) => {
	const spawn = await page.evaluate(() =>
		window.__extCall('spawn_prop', {
			mesh: '/models/barrel.glb',
			position: [3, 0, -2],
			label: 'ext-probe'
		})
	);
	expect(spawn.ok, `spawn failed: ${spawn.error}`).toBe(true);
	expect(String(spawn.result)).toContain('Placed');

	// Verify through the extension as well, so the check runs against the app's
	// own world rather than a separately-imported copy of the engine.
	const id = String(spawn.result).replace('Placed ', '').split(' at ')[0];
	const described = await page.evaluate(
		(entityId) => window.__extCall('describe_entity', { entityId }),
		id
	);
	expect(described.ok).toBe(true);
	expect(String(described.result), 'the spawned entity is in the live world').toContain('Prop');

	const listed = await page.evaluate(() => window.__extCall('list_entities', {}));
	expect(String(listed.result)).toContain(id);
});

test('a tool error reaches the extension as a result, not a rejection', async ({ page }) => {
	const result = await page.evaluate(() =>
		window.__extCall('describe_entity', { entityId: 'entity:nope' })
	);

	expect(result.ok).toBe(true);
	expect(String(result.result)).toContain('Error:');
});
