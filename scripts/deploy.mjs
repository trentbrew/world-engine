#!/usr/bin/env node
/**
 * One-command deploy — Trellis sprite (durable DB + realtime relay) then Vercel.
 *
 *   node scripts/deploy.mjs                 # full pipeline (sprite → Vercel)
 *   node scripts/deploy.mjs --stub          # write configs + Vercel link, no live provisioning
 *   node scripts/deploy.mjs --sprite-only   # only (re)deploy the sprite
 *   node scripts/deploy.mjs --vercel-only   # only link + set env + Vercel prod deploy
 *
 * Sprite: `fractals-demo-0610` (https://fractals-demo-0610-bnsoz.sprites.app) — the
 * shared Trellis deploy target (also used by fractal-playground). The trellis-node
 * `deploy` command attaches the realtime relay (`/rt` WebSocket + `/blob`
 * content-addressed store) to the trellis-db service, so one deploy ships both.
 *
 * Vercel: project `museum` (https://museum-azure-xi.vercel.app). The app reads
 * VITE_RELAY_URL / VITE_RELAY_HTTP at build time for cross-machine multiplayer.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SPRITE_NAME = 'fractals-demo-0610';
const VERCEL_PROJECT = 'museum';
const DEPLOY_DIR = join(root, '.trellis-deploy');
const DEPLOY_CONFIG = join(DEPLOY_DIR, '.trellis-db.json');
// Current live key lives in fractal-playground's deploy record (shared sprite).
const LIVE_CONFIG =
  '/Users/trentbrew/TURTLE/Projects/trellis/fractal-playground/.trellis-db.json';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const stub = flags.has('--stub');
const spriteOnly = flags.has('--sprite-only');
const vercelOnly = flags.has('--vercel-only');
const doSprite = stub || !vercelOnly;
const doVercel = !spriteOnly;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, argv, opts = {}) {
  console.log(`\n$ ${cmd} ${argv.join(' ')}`);
  const res = spawnSync(cmd, argv, { stdio: 'inherit', cwd: root, ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} exited ${res.status}`);
  }
}

function readJsonOrNull(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function relayUrls(baseUrl) {
  const http = baseUrl.replace(/\/$/, '');
  const ws = http.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  return { http, ws: `${ws}/rt` };
}

// ---------------------------------------------------------------------------
// Step 1 — Sprite deploy (durable DB + realtime relay)
// ---------------------------------------------------------------------------

function resolveKey() {
  if (process.env.TRELLIS_API_KEY && process.env.TRELLIS_JWT_SECRET) {
    return {
      apiKey: process.env.TRELLIS_API_KEY,
      jwtSecret: process.env.TRELLIS_JWT_SECRET,
      source: 'env',
    };
  }
  const own = readJsonOrNull(DEPLOY_CONFIG);
  if (own?.mode === 'remote' && own.apiKey && own.jwtSecret) {
    return { apiKey: own.apiKey, jwtSecret: own.jwtSecret, source: DEPLOY_CONFIG };
  }
  const live = readJsonOrNull(LIVE_CONFIG);
  if (live?.apiKey && live?.jwtSecret) {
    return { apiKey: live.apiKey, jwtSecret: live.jwtSecret, source: LIVE_CONFIG };
  }
  return null;
}

function deploySprite() {
  console.log(`\n=== Step 1/2 — Deploy sprite ${SPRITE_NAME} (trellis-db + relay) ===`);
  mkdirSync(DEPLOY_DIR, { recursive: true });

  const key = resolveKey();
  const argv = ['deploy', '--name', SPRITE_NAME, '--config-dir', DEPLOY_DIR];
  if (key) {
    console.log(`  reusing apiKey/jwtSecret from ${key.source}`);
    argv.push('--key', key.apiKey, '--jwt-secret', key.jwtSecret);
  } else {
    console.warn(
      '  no existing key found — trellis will generate a NEW key (this rotates the live credential)'
    );
  }
  if (stub) argv.push('--stub');

  run('pnpm', ['exec', 'trellis', ...argv]);

  const deployed = readJsonOrNull(DEPLOY_CONFIG);
  if (!deployed?.url) {
    throw new Error(`deploy did not write a url to ${DEPLOY_CONFIG}`);
  }
  return deployed.url;
}

// ---------------------------------------------------------------------------
// Step 2 — Vercel: link + env + prod deploy
// ---------------------------------------------------------------------------

function configureVercel(url) {
  const { http, ws } = relayUrls(url);

  console.log(`\n=== Step 2/2 — Vercel project ${VERCEL_PROJECT} ===`);
  run('vercel', ['link', '--yes', '--project', VERCEL_PROJECT]);

  for (const [name, value] of [
    ['VITE_RELAY_URL', ws],
    ['VITE_RELAY_HTTP', http],
  ]) {
    run('vercel', [
      'env',
      'add',
      name,
      'production',
      '--value',
      value,
      '--force',
      '--yes',
    ]);
  }
}

function deployVercel() {
  console.log(`\n=== Deploying to Vercel (production) ===`);
  run('vercel', ['deploy', '--prod', '--yes']);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let url = null;
  if (doSprite) {
    url = deploySprite();
  }

  if (doVercel) {
    if (!url) {
      const deployed = readJsonOrNull(DEPLOY_CONFIG);
      url = deployed?.url;
    }
    if (stub) {
      // Stub deploy has no real URL; use the canonical live sprite URL for env.
      url = url ?? `https://${SPRITE_NAME}-bnsoz.sprites.app`;
    }
    if (!url) {
      throw new Error('no deployed sprite URL available — run sprite deploy first');
    }
    configureVercel(url);
    if (!stub) deployVercel();
  }

  console.log('\n✓ Deploy complete');
  if (stub) console.log('  (stub — configs written, no live provisioning or prod deploy)');
}

main();
