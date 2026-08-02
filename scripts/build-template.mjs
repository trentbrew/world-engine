#!/usr/bin/env node
/**
 * Builds the `template/` scaffold directory for create-playlab.
 *
 * The engine repo is the source of truth; this script assembles a lean,
 * runnable snapshot (engine src + configs + starter world) into `template/`.
 * Re-run after engine changes. create-playlab fetches `template/` via the
 * GitHub tarball.
 */

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'template');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'static'), { recursive: true });

const copy = (src, dest = src) => cpSync(join(root, src), join(out, dest), { recursive: true });

// Root configs
for (const f of [
  '.gitignore',
  'pnpm-lock.yaml',
  '.npmrc',
  '.nvmrc',
  'components.json',
  'LICENSE',
  'ATTRIBUTIONS.md',
  'AGENTS.md',
  'svelte.config.js',
  'tsconfig.json',
  'vite.config.ts',
]) {
  copy(f);
}

// Engine app source (whole public src)
copy('src');

// Dev scripts used by the default stack
copy('scripts/relay.mjs', 'scripts/relay.mjs');
copy('scripts/dev-status.mjs', 'scripts/dev-status.mjs');

// Static assets: lean, all in-house / MIT. player.glb (12M) omitted; the
// default Player avatar is mannequin.glb.
copy('static/audio');
copy('static/catalogs');
copy('static/textures');
copy('static/models/barrel.glb', 'static/models/barrel.glb');
copy('static/models/characters', 'static/models/characters');
copy('static/favicon.png');
copy('static/logo.png');
copy('static/robots.txt');

// Starter worlds
copy('static/world.jsonld', 'static/world.jsonld');

const hello = {
  '@context': {
    '@vocab': 'https://game.example/vocab/',
    conformsTo: { '@type': '@id' },
    components: { '@type': '@json' },
  },
  '@graph': [
    {
      '@id': 'entity:ground/main',
      '@type': 'Thing',
      conformsTo: 'GroundPlane',
      components: { Ground: { size: 16 } },
    },
    {
      '@id': 'entity:light/ambient',
      '@type': 'Thing',
      conformsTo: 'AmbientLight',
      components: { Light: { intensity: 0.5 } },
    },
    {
      '@id': 'entity:light/sun',
      '@type': 'Thing',
      conformsTo: 'DirectionalLight',
      components: { Light: { intensity: 1 }, Transform: { position: { x: 5, y: 8, z: 5 } } },
    },
    {
      '@id': 'entity:spawn/center',
      '@type': 'Thing',
      conformsTo: 'SpawnPoint',
      components: { Transform: { position: { x: 0, y: 0.05, z: 0 } } },
    },
    {
      '@id': 'entity:prop/barrel',
      '@type': 'Thing',
      conformsTo: 'Prop',
      components: {
        Transform: { position: { x: 3, y: 0.6, z: 0 } },
        Render: { mesh: '/models/barrel.glb', anchor: 'bottom' },
      },
    },
    {
      '@id': 'entity:obj/cube',
      '@type': 'Thing',
      conformsTo: 'Prop',
      components: {
        Transform: { position: { x: -3, y: 0.5, z: 0 } },
        Render: { mesh: 'primitive:box', color: '#ff6b6b' },
      },
    },
  ],
};

mkdirSync(join(out, 'static', 'games'), { recursive: true });
writeFileSync(join(out, 'static', 'games', 'hello.jsonld'), JSON.stringify(hello, null, '\t') + '\n');

// package.json
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
pkg.name = 'world-engine-starter';
pkg.version = '0.1.0';
pkg.description = 'A starter world for the world-engine. Drop a world file in static/games/ and open ?game=<name>.';
delete pkg.private;
pkg.scripts = {
  dev: 'vite dev',
  'dev:relay': 'node scripts/relay.mjs',
  build: 'vite build',
  preview: 'vite preview',
  prepare: 'svelte-kit sync || echo \'\'',
  check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
  'games:catalog':
    "tsx -e \"import { writeGamesCatalog } from './src/lib/engine/gamesCatalogPlugin.ts'; writeGamesCatalog(process.cwd())\"",
};
writeFileSync(join(out, 'package.json'), JSON.stringify(pkg, null, '\t') + '\n');

// README
writeFileSync(
  join(out, 'README.md'),
  [
    '# Your World',
    '',
    'A starter project for the [world-engine](https://github.com/trentbrew/world-engine) — a data-first, realtime-multiplayer 3D world engine.',
    '',
    '```sh',
    'pnpm install',
    'pnpm dev            # open http://localhost:9292/?game=hello',
    'pnpm check          # type-check',
    'pnpm build          # build (adapter-vercel)',
    '```',
    '',
    'Drop a `.jsonld` world file in `static/games/` and open `?game=<name>`.',
    '',
    'Read **AGENTS.md** to author worlds; **docs/ontology.md** is the schema reference.',
    '',
  ].join('\n')
);

// justfile (dev stack recipes)
try {
  copy('justfile');
} catch {
  /* optional */
}

console.log(`template/ built at ${out}`);
