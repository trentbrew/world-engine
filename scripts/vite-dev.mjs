#!/usr/bin/env node
/**
 * Vite dev with optional root `.env` loaded into process.env (Node --env-file).
 * Forwards all args to `vite dev` — e.g. `--port 9292`.
 *
 * Used by `pnpm dev`, `just run`, and Playwright cold-start so server-only
 * routes (Sketchfab import, relay URLs) see the same env as CLI scripts.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const viteBin = join(root, 'node_modules/vite/bin/vite.js');

const nodeArgs = [];
if (existsSync(envPath)) nodeArgs.push('--env-file', envPath);
nodeArgs.push(viteBin, 'dev', ...process.argv.slice(2));

const child = spawn(process.execPath, nodeArgs, {
	cwd: root,
	stdio: 'inherit',
	env: process.env
});

child.on('exit', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 1);
});
