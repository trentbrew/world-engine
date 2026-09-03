#!/usr/bin/env node
/**
 * MCP stdio launcher for the headless room agent.
 *
 * Exists because an MCP client starts servers with whatever Node is ambient on
 * PATH, and this repo pins `engines.node >=20 <24` (Playwright 1.52 hangs on 24 —
 * see scripts/test-e2e.mjs). On a machine defaulting to Node 24, `pnpm agent:room`
 * dies with ERR_PNPM_UNSUPPORTED_ENGINE before the server ever speaks MCP, and the
 * client just reports a server that failed to start.
 *
 * So: resolve a Node matching .nvmrc, then exec the real server under it. Runs
 * fine under any Node itself — it only spawns.
 *
 * STDOUT IS THE MCP CHANNEL. Nothing here may write to it; diagnostics go to
 * stderr, which the client shows as server logs.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const note = (msg) => process.stderr.write(`[mcp-agent-room] ${msg}\n`);

/** Major version this repo wants, from .nvmrc. */
function wantedMajor() {
	try {
		const raw = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
		const major = Number(raw.replace(/^v/, '').split('.')[0]);
		return Number.isFinite(major) ? major : null;
	} catch {
		return null;
	}
}

/** Newest installed nvm Node with the wanted major, or null. */
function nvmNode(major) {
	const versionsDir = join(process.env.NVM_DIR || join(process.env.HOME ?? '', '.nvm'), 'versions/node');
	if (!existsSync(versionsDir)) return null;
	const candidates = readdirSync(versionsDir)
		.filter((name) => name.startsWith(`v${major}.`))
		// Numeric compare per segment — lexical sort puts v22.9 above v22.23.
		.sort((a, b) => {
			const pa = a.slice(1).split('.').map(Number);
			const pb = b.slice(1).split('.').map(Number);
			for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
			return 0;
		});
	for (const name of candidates) {
		const bin = join(versionsDir, name, 'bin/node');
		if (existsSync(bin)) return bin;
	}
	return null;
}

const major = wantedMajor();
const current = Number(process.versions.node.split('.')[0]);
let nodeBin = process.execPath;

if (major !== null && current !== major) {
	const found = nvmNode(major);
	if (found) {
		nodeBin = found;
		note(`node ${process.versions.node} is not v${major}; using ${found}`);
	} else {
		note(`WARNING: .nvmrc wants Node ${major}, running ${process.versions.node}, none installed via nvm.`);
		note('If the server fails to start, install it: nvm install ' + major);
	}
}

// The server needs Vite to resolve `$lib`, so it goes through run-with-vite.
const child = spawn(nodeBin, [join(root, 'scripts/run-with-vite.mjs'), join(root, 'scripts/agent-room.ts'), ...process.argv.slice(2)], {
	cwd: root,
	// stdin/stdout are the MCP channel and pass straight through.
	stdio: 'inherit',
	env: process.env
});

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
