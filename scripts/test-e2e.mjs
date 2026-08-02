#!/usr/bin/env node
/**
 * Playwright e2e gate — fail fast when the dev stack is down so agents do not
 * sit on a 120s webServer bootstrap or a hung cold start.
 *
 * Local default: require `just run` (or vite on :9292), set PW_REUSE=1.
 * PW_COLD=1: allow Playwright's webServer (slow; last resort).
 * CI: Playwright owns webServer (unchanged).
 *
 * Node 24+: @playwright/test 1.52 hangs on startup (deprecated module.register).
 * Use Node 22 — see .nvmrc.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { devBaseUrl, devServerUp } from './dev-status-lib.mjs';

const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);
if (nodeMajor >= 24) {
	console.error(`[test:e2e] Playwright hangs on Node ${process.versions.node}.`);
	console.error('[test:e2e] Switch to Node 22: nvm use   (see .nvmrc)');
	process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightBin = join(root, 'node_modules', '.bin', 'playwright');

function otherPlaywrightRuns() {
	const probe = spawnSync('pgrep', ['-f', '[p]laywright test'], { encoding: 'utf8' });
	return probe.stdout.trim().split('\n').filter(Boolean);
}

const peers = otherPlaywrightRuns();
if (peers.length > 0) {
	console.error(`[test:e2e] Another Playwright run is active (pid ${peers.join(', ')}).`);
	console.error('[test:e2e] Wait for it to finish, or: pkill -f "playwright test"');
	process.exit(1);
}

const args = process.argv.slice(2);
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const cold = process.env.PW_COLD === '1';
const forceReuse = process.env.PW_REUSE === '1';

if (!isCI) {
	const up = await devServerUp();

	if (forceReuse && !up) {
		console.error('[test:e2e] PW_REUSE=1 but dev server is not reachable.');
		console.error(`[test:e2e] Expected ${devBaseUrl()} — start with: just run`);
		process.exit(1);
	}

	if (!up && !cold) {
		console.error(`[test:e2e] Dev server not reachable at ${devBaseUrl()}.`);
		console.error('[test:e2e] Start the stack: just run');
		console.error('[test:e2e] Cold bootstrap (slow): PW_COLD=1 pnpm test:e2e');
		process.exit(1);
	}

	if (up) {
		process.env.PW_REUSE = '1';
		console.error(`[test:e2e] reusing dev server at ${devBaseUrl()}`);
	} else {
		console.error('[test:e2e] PW_COLD=1 — Playwright will start Vite (expect 30–90s)');
	}
}

const pwArgs = ['test', ...args];
if (!args.some((a) => a.startsWith('--reporter'))) {
	pwArgs.push('--reporter=line');
}
if (!args.some((a) => a.startsWith('--workers'))) {
	pwArgs.push('--workers=1');
}

const result = spawnSync(playwrightBin, pwArgs, {
	stdio: 'inherit',
	env: process.env,
	cwd: root
});
process.exit(result.status ?? 1);
