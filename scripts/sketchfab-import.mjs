#!/usr/bin/env node
/**
 * @deprecated Use `pnpm import:sketchfab` (scripts/sketchfab-import.ts).
 * Thin shim so old docs/commands keep working.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(
	process.execPath,
	['--env-file=.env', '--import', 'tsx', join(ROOT, 'scripts/sketchfab-import.ts'), ...process.argv.slice(2)],
	{ cwd: ROOT, stdio: 'inherit', env: process.env }
);
process.exit(r.status ?? 1);
