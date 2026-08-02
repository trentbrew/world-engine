---
version: 1
name: Trellis Durable Tier — Persist + Sync World Edits
parent: TRL-30
foundation: TRL-25 (eavToGraph, trellisSource, MemoryTrellisClient)
status: queue-ready
---

# Spec: Trellis Durable Tier — Persist + Sync World Edits

**Parent:** TRL-30 (Proposal: Trellis durable tier)  
**Foundation:** TRL-25 — `eavToGraph`, `trellisSource`, `MemoryTrellisClient`, `pnpm test:eav`

---

## Summary

Wire **TrellisDb** as the engine's **durable tier**: inspector edits to durable fields (e.g. `Ground.color`) persist across reload and sync to all peers. **PartyKit stays unchanged** for realtime fields (`Transform.position`, etc.).

Today `world.setField` mutates in-memory only; `NetSession` publishes `realtimeFields` only. This spec adds a **`DurableStore` seam** (load + mutate + subscribe), routes durable writes through it, and boots worlds from Trellis when `?durable=trellis`.

---

## Architect decisions (closes proposal forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| In-browser sql.js local mode | **Not available.** Browser bundle (`trellis/client/sdk`) is **remote-only**. | `sdk.browser.ts` throws on local mode; subscribe also requires remote |
| Phase 1 persistence | **Remote TrellisDb → local `trellis db serve`** (disk-backed `.trellis-db`). Reload works while server is running. | Honest Trellis integration; matches fractal-playground |
| Phase 2 cross-peer | Same server + **`subscribe()`** on world EQL; host-gated durable writes | Server-authoritative ops; no duplicate durable channel on PartyKit |
| Default mode | `?durable=static` (current behavior) until user opts in | Zero breaking change for static demos |
| Opt-in | `?durable=trellis` + optional `?trellis=http://localhost:8230` | Explicit durable tier |
| World / tenant key | `worldId = params.get('room') ?? params.get('game') ?? 'lobby'` | Aligns with existing `session.connect(room)` |
| Entity identity | Preserve JSON-LD `@id` as Trellis entity id (`entity:ground/main`) | 1:1 mapping; no id remapping on seed |
| EAV attribute key | `"Component.field"` per TRL-25 (`Ground.color`, `Transform.scale`) | Existing `eavToGraph` convention |
| What gets persisted | **Durable fields only** (default sync policy + non-formula values). Never realtime or derived. | Matches AGENTS.md tier split |
| Write authority | **Host only** when `session.connected`; single-tab / no session → always allowed | World entities already host-owned in net model |
| Mutation UX v1 | **Await server confirm** before treating write as durable (no optimistic Trellis apply) | Acceptable for infrequent inspector edits; simpler v1 |
| Seed strategy | On first open of empty world: **import static JSON-LD** (`/games/{game}.jsonld`) into Trellis via `create`/`update` | Static files remain authoring bootstrap |
| Schema registration | **No Zod/registerType required** — open-entity `create`/`update` with flat attribute maps | Dynamic ontology from JSON-LD |
| Resubscribe | Thin `resubscribeOnClose(ws)` helper wrapping `subscribe()` | Trellis WS v1 has no auto-reconnect |
| Dev ergonomics | Extend `just run` to start **`trellis db serve`** on `:8230` alongside Vite + PartyKit | One command for full stack |
| Dep | Add `trellis@^3.2` — import `TrellisDb` from `trellis/client/sdk` | Browser build verified in fractal-playground |

---

## Problem statement (symptom → cause)

1. User edits `Ground.color` in inspector → `world.setField` updates RAM.
2. Reload → `loadOntology(staticSource(url))` re-fetches unchanged JSON-LD → color resets.
3. Peer tab → PartyKit `buildPatch` skips durable fields → peer never sees color.

**Fix:** durable mutations → `DurableStore.update` → Trellis op-log → reload via `trellisSource` + live `subscribe` patches.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ WorldShell bootstrap                                         │
│  ?durable=static  → staticSource (unchanged)                 │
│  ?durable=trellis → durableStore.load → trellisSource       │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   loadOntology         world.setField      NetSession
   (entities)           ├ durable → Store     (realtime only)
                        ├ realtime → RAM       PartyKit ~20Hz
                        └ derived → RAM        (unchanged)
                              │
                              ▼
                    ┌──────────────────┐
                    │  DurableStore    │
                    │  load / update   │
                    │  subscribe?      │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ TrellisDb remote │
                    │ trellis db serve │
                    └──────────────────┘
```

**Tier contract (unchanged):**

| Policy | Transport | Persist |
| ------ | --------- | ------- |
| `durable` | Trellis | Yes |
| `realtime` | PartyKit | No |
| `derived` | Local formula | No |

---

## New / changed modules

### 1. `src/lib/engine/ontology/sources/eav.ts` — round-trip

Add:

```ts
/** Flatten a JSON-LD @graph into EAV triples (inverse of eavToGraph). */
export function graphToEav(doc: JsonLdDoc): EavTriple[];

/** Single field write as attribute key. */
export function fieldAttribute(component: string, field: string): string;
```

Rules:
- Skip `ComponentSchema` / `EntityType` nodes on entity export (instances only).
- Emit `@type`, `conformsTo`, and each `components.*` field as triples.
- Coerce vec3/quat to stored shape consistent with loader (arrays preferred).

### 2. `src/lib/engine/ontology/syncPolicy.ts` (or extend `registry.ts`)

```ts
export function syncPolicyFor(component: string, field: string): SyncPolicy;
export function durableFields(component: string): string[];
export function isDurableField(component: string, field: string, value: unknown): boolean;
```

Mirror `realtimeFields`; treat omitted `sync` as `durable`; formula strings as `derived`.

### 3. `src/lib/engine/ontology/durableStore.ts` — seam

```ts
export interface DurablePatch {
  entityId: string;
  component: string;
  field: string;
  value: unknown;
}

export interface DurableStore {
  /** Load world document (same shape staticSource returns). */
  load(worldId: string, seedUrl?: string): Promise<JsonLdDoc>;
  /** Persist one durable field. Throws if not host / not connected when gated. */
  updateField(worldId: string, patch: DurablePatch): Promise<void>;
  /** Live durable patches from Trellis subscribe (Phase 2). */
  subscribe?(worldId: string, onPatch: (patch: DurablePatch) => void): () => void;
}

export function createDurableStore(mode: 'static' | 'trellis', opts?: { url?: string }): DurableStore;
```

**Implementations:**

| Impl | Phase | Behavior |
| ---- | ----- | -------- |
| `StaticDurableStore` | — | `load` = fetch JSON-LD; `updateField` = no-op (current) |
| `MemoryDurableStore` | tests | Wraps `MemoryTrellisClient` + in-memory writes |
| `TrellisDurableStore` | 1+2 | `TrellisDb` remote: seed, query, update, subscribe |

### 4. `src/lib/engine/ontology/sources/trellisDb.ts`

Adapter implementing load/query against TrellisDb:

```ts
export class TrellisDbWorldClient implements TrellisWorldClient {
  constructor(private db: TrellisDb, private worldId: string);
  async queryWorld(worldId: string): Promise<JsonLdDoc>;
}
```

EQL for world entities (v1):

```sql
SELECT ?id ?type ?attr ?val
WHERE { ?id type ?type . ?id ?attr ?val . }
FILTER (?type = "Thing" || ?type = "ComponentSchema" || ?type = "EntityType")
```

If EQL filter on `worldId` is needed, add attribute `worldId` on seed (namespace) — **v1: one tenant per dev server, worldId as seed namespace prefix on entity attributes** OR filter by known entity id prefix `entity:`. Prefer **list all Thing/Schema/Type nodes in tenant** for v1; multi-world isolation via **tenantId = worldId** query param to TrellisDb.

**Tenant isolation decision:** pass `tenantId: worldId` to `TrellisDb({ url, tenantId: worldId })` so `?room=collect` and `?room=orbit` don't collide.

### 5. `src/lib/engine/ontology/seedWorld.ts`

```ts
export async function seedWorldIfEmpty(
  db: TrellisDb,
  worldId: string,
  seedDoc: JsonLdDoc
): Promise<void>;
```

- `list('Thing', { limit: 1 })` — if empty, `graphToEav(seedDoc)` → `create('Thing', attrs, { id: entityId })` per node.
- Use explicit entity ids from `@id` (may require `create` with id if API supports — else `update` after create; **check TrellisDb `create` — use `kernel.createEntity(entityId, ...)` path via update after create with known id**).
- **AC note:** If `create` cannot set id, use `db.update(presetId, ...)` after ensuring entity exists — verify SDK allows id in create body for remote mode; fractal-playground uses generated ids. **For game engine, entities MUST keep `entity:*` ids.** Spec requires: use `PUT /entities/{id}` upsert or pass id in create payload if supported. If not supported in SDK v3.2, add thin `upsertEntity(id, type, attributes)` helper calling raw `_fetch`.

### 6. `src/lib/engine/runtime/world.svelte.ts` — `setField` routing

```ts
setField(entityId, component, field, raw) {
  // ... existing coerce + local RAM update ...

  if (isDurableField(component, field, value)) {
    durableStore?.updateField(worldId, { entityId, component, field, value });
  }
  // realtime: existing publish loop handles wire (no change)
}
```

Inject `durableStore` + `worldId` at bootstrap (module-level setters or `world.bindDurable(store, worldId)`).

### 7. `src/lib/engine/durable/session.ts` — subscribe apply (Phase 2)

On subscribe callback:
- Parse entity attribute changes → `DurablePatch`
- Apply to `world.getEntity` **without** re-sending to Trellis (guard flag `applyingRemoteDurable`)
- Skip if patch origin is self (compare op metadata if available; else accept duplicate apply idempotently)

### 8. `src/lib/ui/WorldShell.svelte` — bootstrap

```ts
const durableMode = params.get('durable') === 'trellis' ? 'trellis' : 'static';
const worldId = params.get('room') ?? game ?? 'lobby';
const trellisUrl = params.get('trellis') ?? 'http://localhost:8230';

let source: WorldSource;
if (durableMode === 'trellis') {
  const store = createDurableStore('trellis', { url: trellisUrl });
  world.bindDurable(store, worldId);
  const doc = await store.load(worldId, url); // seedUrl = static jsonld
  source = () => Promise.resolve(doc);
  store.subscribe?.(worldId, applyDurablePatch); // Phase 2
} else {
  source = staticSource(url);
}
const entities = await loadOntology(source);
```

### 9. `justfile` — dev stack

```just
trellis port='8230':
    npx trellis db serve --port {{port}}

run:
    # vite + partykit + trellis db serve
```

Document: `?durable=trellis` requires `just run` (or manual `trellis db serve`).

### 10. `scripts/durable-smoke.ts` (new)

Extend eav-smoke pattern:
- `graphToEav` ↔ `eavToGraph` roundtrip
- `MemoryDurableStore`: update `Ground.color`, reload, assert persisted

---

## Phased delivery

### Phase 1 — Persist on reload (PR1)

**Scope:** DurableStore seam, graphToEav, TrellisDb adapter, seed, setField routing, `?durable=trellis`, `just run` + trellis server, host write gate (noop when single-tab).

**Manual AC:**
1. `just run` → open `http://localhost:9292/?game=collect&durable=trellis`
2. Select ground → change color to green → reload → **still green**
3. `?durable=static` unchanged (no trellis dep at runtime for static path)

### Phase 2 — Cross-peer sync (PR2)

**Scope:** `subscribe()` on world query, `applyDurablePatch`, host-only durable writes when `session.connected`, resubscribe helper, status indicator in StatusBar (`durable: connected | offline`).

**Manual AC:**
1. Two tabs, same `?game=collect&durable=trellis&room=collect`
2. Host tab changes `Ground.color` → **peer updates within ~1s** (subscribe latency)
3. Non-host tab attempts durable edit → **ignored or toast "Host only"**
4. Player movement still syncs via PartyKit independently

---

## Out of scope (v1)

- Optimistic durable apply + rollback
- Trellis-backed realtime (keep PartyKit)
- Entity spawn/despawn through Trellis (inspector Add Entity stays local RAM only — follow-up issue)
- TurtleDB hosted prod deploy
- Offline IndexedDB fallback without server
- Auto-reconnect beyond manual resubscribe helper

---

## Files touched (expected)

| File | Change |
| ---- | ------ |
| `package.json` | `trellis` dependency |
| `justfile` | trellis server in `run` |
| `src/lib/engine/ontology/sources/eav.ts` | `graphToEav`, `fieldAttribute` |
| `src/lib/engine/ontology/syncPolicy.ts` | new |
| `src/lib/engine/ontology/durableStore.ts` | new |
| `src/lib/engine/ontology/sources/trellisDb.ts` | new |
| `src/lib/engine/ontology/seedWorld.ts` | new |
| `src/lib/engine/runtime/world.svelte.ts` | durable routing |
| `src/lib/engine/durable/session.ts` | subscribe apply (P2) |
| `src/lib/ui/WorldShell.svelte` | bootstrap fork |
| `src/lib/ui/StatusBar.svelte` | durable indicator (P2) |
| `scripts/durable-smoke.ts` | new |
| `AGENTS.md` | document `?durable=trellis` |

---

## Test plan (automated AC)

| AC | Command / check |
| -- | --------------- |
| Typecheck | `pnpm check` |
| Build | `pnpm build` |
| EAV roundtrip | `pnpm test:eav` (extend) |
| Durable store | `pnpm test:durable` (new script → `durable-smoke.ts`) |
| No regression static | `pnpm test:eav` + load `?game=collect` without durable param |

---

## Risk register

| Risk | Mitigation |
| ---- | ---------- |
| `create` can't set `entity:*` id | Upsert via PUT or SDK patch in seedWorld |
| EQL world query too broad | tenantId = worldId isolates rooms |
| WS disconnect | resubscribe helper + StatusBar offline state |
| Host gate UX | toast on rejected write; document host = lowest client id |
| Bundle size | static path never imports TrellisDb (dynamic import in trellis mode only) |

---

## Follow-up issues (post-ship, not blocking)

- TRL-20 close: superseded by this work
- Durable entity spawn/despawn (Add Entity dialog → Trellis `create`/`delete`)
- TurtleDB hosted URL + apiKey via env
- IndexedDB offline cache layer (if serverless persistence needed)
