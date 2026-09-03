---
created: 2026-09-02
updated: 2026-09-02
title: 'ADR 0002: Asset storage — content-addressed refs, GitHub registry, relay ingest'
description: Assets keep `trellis-blob:<sha256>` as their only identity; a GitHub registry maps hash → URL; the relay is the write path and cache.
status: proposed
---
# ADR 0002: Asset storage — content-addressed refs, GitHub registry, relay ingest

> **Terminology:** **Ref** = the string stored in a world document to name an
> asset (today `trellis-blob:<sha256>`, a path, or an http URL). **Registry** =
> a public GitHub repo holding reviewed asset metadata (the `turtlehq/worlds`
> pattern, extended to assets). **Relay** = `scripts/relay.mjs` + its
> `BlobStore`, the content-addressed store behind `PUT|GET /blob/:sha256`.

**Status:** Proposed
**Date:** 2026-09-02
**Depends on:** `src/lib/engine/render/meshRef.ts` · `src/lib/assets/catalog.ts`
· `scripts/relay.mjs` · `worlds-registry/` (`turtlehq/worlds`) ·
`scripts/sketchfab-import.ts` + `*.glb.provenance.json` · `ATTRIBUTIONS.md`
· `src/lib/engine/animation/characterMeshDefaults.ts` ·
`src/lib/engine/player/playerAvatarPrefs.ts` (avatar-picker seam — open
questions 6–7)
**Supersedes:** the `worlds-registry/README.md` guidance that worlds reference
meshes by raw GitHub URL

## Context

Assets reach a world three ways today, and only one of them is durable:

1. **`static/`** — 86MB checked into the app, 65MB of it `static/models`. Ships
   in every build and every Vercel deploy. Fine for the handful of engine
   defaults (`player.glb`, `barrel.glb`); wrong as the place community models land.
2. **Relay blob store** — `putRelayBlob` (`catalog.ts:104`) PUTs bytes, gets back
   a SHA-256, and stores a `trellis-blob:<hash>` ref that any peer resolves from
   `/blob/<hash>` (`meshRef.ts:60`). Content-addressed and correct, but the bytes
   live in `.trellis-relay` on whoever ran the relay. Nothing about it is durable
   or shared across machines.
3. **`/api/assets`** — dev-only filesystem write, the fallback when the relay is
   down.

Meanwhile `worlds-registry/` already proves the GitHub-registry pattern for
*worlds*: a `catalog.json` in `turtlehq/worlds`, fetched at runtime from
`raw.githubusercontent.com`, contributions by PR. The open question is whether
models and files should follow it.

Two properties are missing and they are not the same property:

- **Durability** — a ref published in a world today may resolve to a blob store
  that no longer exists.
- **Curation** — models arrive via `scripts/sketchfab-import.ts` under CC
  licenses, carrying `.glb.provenance.json` and rows in `ATTRIBUTIONS.md`. Today
  nothing forces a human to look at a license before an asset becomes canonical.

There is also a hard constraint on any resolver design: **`resolveMeshUrl` is
synchronous** and is called from ~24 sites, most of them inside Svelte `$derived`
(`PlacementGhost.svelte:26`, `AssetPreviewScene.svelte:65`,
`AssetThumbnail.svelte:53`, `modelThumbnail.ts:57`, …). Making resolution async
would touch every one of them.

## Decision

Keep content addressing as the **identity** layer, add GitHub as the
**location** layer, and keep the relay as the **ingest** layer. Six decisions:

### 1. `trellis-blob:<sha256>` is the only asset ref a world document may contain

No `https://raw.githubusercontent.com/...` in world files. This reverses the
current `worlds-registry/README.md` advice ("served via raw GitHub URLs"), which
bakes a hostname into published content: an org rename, a rate limit, or a move
off GitHub would break every world with no migration path. A hash has no host,
so the storage tier stays swappable forever. Paths under `static/` remain legal
for the engine's own built-in defaults only.

### 2. Location is a resolver concern, and the resolver stays synchronous

`resolveMeshUrl` gains a manifest lookup ahead of its current fallback. The
manifest is **fetched once and cached** (boot / first asset use), so resolution
itself remains a sync map read and no call site changes:

```ts
// meshRef.ts — sketch
type AssetLocation = { url: string; name?: string; license?: string; bytes?: number };

let manifest: Map<string, AssetLocation> = new Map(); // hash → location

/** Called once at boot (or on registry switch); never on the render path. */
export async function loadAssetManifest(src = REGISTRY_MANIFEST_URL): Promise<void> {
  const res = await fetch(src, { cache: 'force-cache' });
  if (!res.ok) return;               // registry down → fall through to relay
  const json = await res.json() as { version: 1; assets: Record<string, AssetLocation> };
  manifest = new Map(Object.entries(json.assets));
}

export function resolveMeshUrl(mesh: string): string {
  const trimmed = mesh.trim();
  if (!trimmed) throw new Error('Mesh URL cannot be empty');

  const blob = trimmed.match(TRELLIS_BLOB_REF);
  if (blob) {
    const hash = blob[1]!.toLowerCase();
    // 1. local relay/cache wins — offline dev, unpublished uploads, fastest byte
    if (localBlobCache.has(hash)) return localBlobUrl(hash);
    // 2. registry manifest — the durable, reviewed, CDN-backed copy
    const hit = manifest.get(hash);
    if (hit) return hit.url;
    // 3. relay origin — current behaviour, unchanged
    const origin = relayBlobHttpOrigin();
    return origin ? `${origin}/blob/${hash}` : `/blob/${hash}`;
  }

  return trimmed;
}
```

Ordering is deliberate: local first so an author working offline (or on an asset
they just uploaded and have not published) never round-trips to GitHub; registry
second because it is the durable copy; relay origin last, preserving today's
behaviour exactly when no manifest is loaded.

### 3. The registry holds metadata in git; bytes go in GitHub Releases

The registry repo carries `assets/manifest.json` — `hash → { url, name, license,
attribution, bytes }` — reviewed and merged by PR. The **bytes do not go in the
git tree and do not go in Git LFS**:

- **In-tree** — every clone of the registry pays for every model forever;
  GitHub's per-file push ceiling is 100MB.
- **Git LFS** — bandwidth is metered and throttled on public repos; a popular
  world would exhaust it.
- **Release assets** *(chosen)* — up to 2GB per file, served from GitHub's
  object CDN, immutable per release tag, invisible to clone weight.

`raw.githubusercontent.com` stays the transport for the small JSON
(`catalog.json`, `manifest.json`) — cacheable and already in use — and is not
used for multi-MB binaries. A jsDelivr `/gh` mirror is a reasonable later
addition for small assets; its per-file cap (~20MB, verify before relying on it)
rules it out as the primary tier.

### 4. Promotion from relay → registry is where license review happens

The relay is the **write** path: an in-app upload or an agent-spawned model gets
a hash immediately and is usable in-session, unchanged from today. Publishing
that asset is a separate, deliberate step — a PR to the registry adding a
manifest entry and attaching the bytes to a release.

This is the strongest argument for GitHub, stronger than uptime: a PR is a place
a human checks a CC license before an asset becomes canonical. The inputs
already exist — `sketchfab-import.ts` writes `.glb.provenance.json` per model and
`ATTRIBUTIONS.md` tracks credit. Promotion is the moment those get read.

### 5. `static/models` shrinks to engine defaults

Community and imported models move to the registry. Only assets the engine
cannot boot without stay in `static/`. Removing ~65MB from the build cuts deploy
weight and cold build time.

### 6. Content hashes buy immutable caching and dedupe

Hash-keyed URLs are safe to serve `Cache-Control: immutable` indefinitely, and
two worlds referencing the same tree fetch it once. This is a consequence of
decision 1 rather than a separate mechanism, but it is a large part of why
hash-as-identity is worth protecting.

## Consequences

- **Positive:** published worlds survive a storage migration — swapping tiers is
  a manifest change, not a rewrite of every world document.
- **Positive:** licensing gets a human gate on a path that currently has none,
  on a repo full of third-party CC assets.
- **Positive:** ~65MB out of the build; permanent caching and cross-world dedupe
  come free with the hash.
- **Positive:** the resolver degrades to today's exact behaviour when no manifest
  is loaded, so this ships incrementally and offline dev is unaffected.
- **Negative:** publishing is a PR — minutes to merge, not seconds. Acceptable
  for a curated registry; wrong if in-app publishing ever needs to be instant.
- **Negative:** two systems to operate (relay + registry) instead of one.
- **Risk:** GitHub gives no takedown control and no private/signed URLs. If
  private worlds or DMCA response ever matter, an S3/R2 tier is required — the
  resolver chain is precisely what lets that be added without touching world
  documents.
- **Risk:** a manifest that fails to load silently degrades to relay resolution,
  which may 404. Needs a visible "asset unresolved" state rather than a silent
  broken mesh.

## Alternatives considered

- **Relay blobs only, no registry.** Rejected: `.trellis-relay` on one machine
  is not a publication tier, and there is no review surface for licenses.
- **Registry only, raw GitHub URLs in world files** (the current README's
  advice). Rejected as decision 1 — couples published content to a hostname and
  discards the content addressing already built.
- **Commit binaries to the registry tree, or use Git LFS.** Rejected in decision
  3 — clone weight and metered/throttled bandwidth respectively.
- **S3/R2 (or Vercel Blob) as the durable tier now.** Deferred, not rejected: it
  solves durability but not curation, adds cost and credentials, and the resolver
  chain makes it a drop-in later. Revisit when private assets or takedowns matter.
- **Async resolver with per-asset lookup.** Rejected: ~24 synchronous call sites
  inside `$derived`; a pre-loaded manifest gets the same result with no refactor.

## Open questions (resolve before implementation spec)

1. **Repo layout:** extend `turtlehq/worlds` with `assets/manifest.json`, or a
   separate `turtlehq/assets`? Separate keeps world review and asset review
   independently reviewable; one repo is less to operate.
2. **Manifest load timing:** app boot vs first asset resolution vs build-time
   inline. Affects first-paint on a cold load of a registry world.
3. **Release cutting:** manual tag, or CI on manifest merge? The bytes must exist
   at the URL before the manifest entry merges, so ordering needs a convention.
4. **`localBlobCache` backing:** in-memory only, or Cache Storage / OPFS so a
   reload does not re-fetch? Affects the decision-2 ordering guarantee.
5. **Unresolved-asset UX:** placeholder mesh, inspector warning, or both.
6. **Migration:** do existing `static/models` refs get rewritten to hashes in
   place, or does a compatibility shim map known paths → hashes for one release?
   This has a second surface: the pause-menu avatar preference
   (`playerAvatarPrefs.ts`) persists a **raw ref string** under
   `collab:player-avatar-mesh`. A path → hash migration turns every stored pref
   into a string that fails the allowlist, so `applyStoredPlayerAvatarMesh`
   returns false and the player silently reverts to the default avatar. Cheapest
   fix is a version suffix on the storage key so a migration invalidates old
   values outright instead of half-honouring them.
7. **Per-asset metadata vs. the basename allowlist:**
   `characterMeshDefaults.ts` decides what is a playable avatar via
   `BY_BASENAME`, keyed on `mesh.split('/').pop()`. A `trellis-blob:<hash>` ref
   has no basename, so the lookup misses, `isConfiguredAvatarMesh` returns
   false, and the pause-menu picker **silently no-ops** for every
   registry-hosted avatar. The `{ catalog, rig, forwardYaw, variant }` bag it
   returns is exactly the per-asset metadata decision 3 puts in the manifest, so
   this file is the natural landing site: manifest lookup by hash in front,
   `BY_BASENAME` retained as the fallback for `static/` built-ins. Note the
   current keying also collides — two different `xbot.glb` files from different
   sources resolve to the same defaults today; hash refs fix that.
