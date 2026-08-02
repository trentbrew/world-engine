# Spec: Named asset refs + committed manifest (Step 0 of asset tier)

**Status:** spec
**Goal:** Make git-synced assets resolve identically on every client (desktop, ThinkPad, prod preview) with **zero new infrastructure** — no CDN, no Trellis blob client, no peers. Establishes the `asset:` naming layer that the durable blob tier (Step 1+) plugs into later.

## Problem

Assets are local filesystem artifacts, not shared state. `/api/assets` FS-scans `static/` on whichever machine runs the dev server; uploads are dev-only and land on that one disk; worlds store raw path strings (`/models/xbot.glb`). Git already ships `static/models/` to every checkout, but nothing maps a stable, authorable name to those bytes, and the catalog/upload path only works where a dev server is running. Result: the ThinkPad has the files in git but no working catalog, and any machine-specific upload is invisible elsewhere.

## Approach

Two moving parts:

1. A **build-time manifest** (`static/assets.manifest.json`, committed to git) mapping a stable `asset:<id>` name → `{ kind, path, size, sha256 }`.
2. An **`asset:` ref scheme** resolved through the existing `meshRef.ts` seam, with the current `/models/…` path passthrough kept as a legacy fallback.

Worlds reference `asset:characters/xbot` (stable, greppable, agent-authorable). The resolver maps that to `/models/characters/xbot.glb`. Content addressing lives in the manifest's `sha256` field — unused for fetch in Step 0, but present so Step 1 (blob tier) can swap the byte source without touching world files.

---

## 1. Manifest format

`static/assets.manifest.json` (committed):

```json
{
  "version": 1,
  "generatedAt": "2026-07-10T00:00:00.000Z",
  "assets": {
    "asset:characters/xbot": {
      "kind": "models",
      "path": "/models/characters/xbot.glb",
      "size": 1233948,
      "sha256": "9f2c3a…"
    }
  }
}
```

- **Keyed by id** for O(1) lookup.
- `id = "asset:" + <relative path under its root, without extension>`. `static/models/characters/xbot.glb` → `asset:characters/xbot`. `static/models/xbot.glb` → `asset:xbot`.
- Keys **sorted**; JSON pretty-printed with a trailing newline → clean, deterministic git diffs. Running the generator twice on unchanged files produces byte-identical output.
- **Collision guard:** if two files (across any roots) produce the same id, the generator errors and exits non-zero rather than silently overwriting.

## 2. Generator — `scripts/gen-asset-manifest.ts`

- Run via `tsx` (matches existing `scripts/*.ts` convention). Imports `ASSET_ROOTS` from `src/lib/assets/catalog.ts` so the root/extension list stays single-sourced.
- Recursively walks each root (mirrors `collectAssets` in `api/assets/+server.ts`), skipping dotfiles, matching `root.extensions`.
- For each file: compute `sha256` (`node:crypto`), `size` (`stat`), derive `id` and `path` (`/<root.dir>/<relPath>`).
- Sorts keys, writes `static/assets.manifest.json`.
- Exit non-zero on id collision (message names both colliding files).

**Wiring (package.json scripts):**

```jsonc
"assets:manifest": "tsx scripts/gen-asset-manifest.ts",
"predev":   "pnpm assets:manifest",   // regenerate before vite dev
"prebuild": "pnpm assets:manifest"     // regenerate before vite build
```

The **dev upload endpoint** (`POST /api/assets`) calls the generator (or incrementally patches the manifest) after a successful write, so newly uploaded assets get an `asset:` id without a restart.

`static/assets.manifest.json` is **committed to git** — that's what carries the catalog to the ThinkPad.

## 3. Resolver — new module + `meshRef.ts`

New `src/lib/engine/assets/assetManifest.svelte.ts`:

- `loadAssetManifest(): Promise<void>` — fetches `/assets.manifest.json`, populates a module-level `Map<id, entry>`. Idempotent.
- `assetEntry(id): AssetManifestEntry | undefined`, `assetPath(id): string | undefined` — **synchronous** lookups.

Update `src/lib/engine/render/meshRef.ts`:

- `isAssetRef(mesh) => mesh?.startsWith('asset:')`.
- `resolveMeshUrl(mesh)`: if `asset:` → `assetPath(mesh)` (throws/returns '' if unknown → falls back to box); else existing passthrough.
- `isGltfMesh(mesh)`: if `asset:` → look up entry, true when `kind === 'models'` (or resolved path ends `.glb`/`.gltf`); else existing.
- `isPrimitiveMesh` unchanged.

**Load ordering:** `isGltfMesh` is called synchronously in `MeshView`'s `$derived`, so the manifest must be populated before any scene renders. Load it in the root `+layout` universal `load` (runs before first render) and `await` it. The file is small; blocking is fine. Guarantees the sync resolvers always see a populated map.

## 4. Catalog / asset panel (read path)

- Add `id: string` to `AssetEntry` in `catalog.ts`.
- `fetchAssets()` reads **the manifest** (not `/api/assets`), so the catalog works with the dev server stopped (prod/preview). Maps entries → `AssetEntry[]` with `url: entry.path`, `id: entry.id`.
- When the asset panel assigns a model to `Render.mesh`, it writes `entry.id` (the `asset:` ref), not `entry.url`.
- `POST /api/assets` (dev upload) unchanged except it regenerates the manifest and returns the new entry with its `id`.

## 5. Legacy + migration

- Existing worlds with `/models/…` refs keep rendering via the passthrough branch — **no forced migration**.
- Optional follow-up (not this issue): `scripts/migrate-mesh-refs.ts` rewrites path refs → `asset:` ids across `static/games/`.

---

## Acceptance criteria

1. `pnpm assets:manifest` writes `static/assets.manifest.json` with `{kind,path,size,sha256}` for every file under `models/textures/audio/files`. **Deterministic:** running twice yields no git diff. → `test:` `pnpm assets:manifest && git diff --exit-code static/assets.manifest.json`
2. A world whose `Render.mesh` is `asset:<id>` for a `.glb` renders the mesh (resolver maps asset→path; `isGltfMesh` true).
3. Legacy `/models/foo.glb` refs still render (regression).
4. Manifest is loaded before first scene render — no crash/flash when an asset ref is present at initial paint.
5. Catalog list and asset-panel assignment work with the **dev server stopped** (prod `build` + `preview`); assignment writes `asset:` refs.
6. **The point:** on a fresh checkout with no dev-server uploads (ThinkPad simulation), every committed asset resolves from git via the manifest — verified by `preview` loading a world that uses an `asset:` ref.
7. Generator exits non-zero when two files map to the same id.

## Out of scope (later steps)

- Browser Trellis blob GET-by-hash (Step 1 — the real durable unblock; spike separately).
- Upload → blob put for prod authoring (Step 2).
- Peer-assisted / WebRTC fetch (Step 3).
