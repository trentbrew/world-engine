#!/usr/bin/env node
/**
 * Exit 0 when the Vite dev server is reachable (default :9292).
 * Used by agents before playwright runs.
 */
import { devBaseUrl, devServerUp } from './dev-status-lib.mjs';

const up = await devServerUp();
if (up) {
	console.log(`dev server up on ${devBaseUrl()}`);
	process.exit(0);
}
process.exit(1);
