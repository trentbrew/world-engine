---
version: 2
name: Game (Project) tier + Collections
parent: TRL-collections
status: draft
labels: spec, ontology, durable, ia, gamemaker, needs-e2e
related: gamemaker_navigation_spec.md, editor_shell_refactor_spec.md, object_context_spec.md
---

# Spec: Game (Project) tier + Collections (v1)

**Parent:** TRL-collections (Proposal — architecture scope, Jul 2026)
**Pathway:** A — real Game container above rooms; Collections are game-global non-spatial entities

> **Implementation note (shipped v1).** Collections shipped **without** a separate `GameBundle`
> tenant or merge-load. Records live as non-spatial entities in the **existing per-game
> `WorldBundle` graph** (a game file already contains rooms via [`roomCatalog.ts`](../../src/lib/engine/ontology/roomCatalog.ts),
> with `inRoom` unset ⇒ global), so they persist/sync/undo through the existing durable path and
> survive room switches for free. What was actually built: `collection`-tagged `EntityType`s
> (`world.defineCollection`), records via `world.createRecord`/`deleteRecord`, a new
> `removeEntity` durable patch kind, a `Collections` bottom-dock route + `CollectionsPanel` +
> `CollectionRecordEditor`, and typed refs (`FieldSchema.of` + `RefField`). The separate-tenant
> `GameBundle` design below is retained as the **cross-game library** future (see Open questions),
> not part of v1.

---

## Summary

Introduce a **Game (Project)** tier above the existing per-room worlds. A Game owns
(1) a set of member **Rooms**, (2) shared **ComponentSchema / EntityType** definitions,
and (3) game-global **Collections** — named sets of non-spatial "record" entities for
arbitrary authored data (story beats, character profiles, level info, magic systems).
Records carry **relational `ref` fields** that point at other records, room entities, or
assets. Runtime merges the game-global graph with the active room graph, so collections
are visible and editable from any room without living inside one.

This closes a scope gap: today there is **no container above a room**, so data that should
be shared across a game's rooms has no home.

**This is the data model the GameMaker editor IA is already a front-end for.** The bottom
dock's game-global routes (Assets · Objects · Graph, and the reserved **Collections** slot)
are project-scoped surfaces; the Rooms route + Instances tab are the room-scoped surfaces.
See [[gamemaker_navigation_spec]] and [[editor_shell_refactor_spec]].

---

## Terminology reconciliation (normative)

The codebase historically overloaded "world." As of this spec, adopt two tiers, using the
**GameMaker-native** vocabulary already shipped in the editor IA:

| Term | Definition | Today's code |
| ---- | ---------- | ------------ |
| **Game** (a.k.a. Project) | The whole authored product. Owns rooms, shared types, collections. | **Does not exist** — no container groups rooms |
| **Room** (was: "Scene") | One spatial level/area: a graph of spatial entities + room settings. | one `.jsonld` = one `?game=` param = one multiplayer room = one tenant = one `WorldBundle` |

> **"Room" replaces "Scene"** everywhere in this spec — it is GameMaker-native and already
> live in the editor (`Rooms` bottom-dock route, `Instances` pane tab). The `SceneSelector` /
> `SceneDocument` components keep their filenames for now (rename is cosmetic follow-up); read
> them as "Room picker" / "Room document."

> The `SceneSelector` picker today switches between what are really standalone Games (full
> reload into a different tenant via [`loadGame`](../../src/lib/engine/games.ts)). This spec
> makes the Game real and demotes each `.jsonld` to a true Room under it.

The runtime variable `world` (`world.svelte.ts`) continues to mean **the live merged entity
store for the active room** (game-global records + active-room spatial entities). We do not
rename it in v1; document it as "active room view."

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Container model | **`GameBundle`** durable entity holding a manifest + shared graph | Mirrors `WorldBundle`; one blob is fine at authored-data scale |
| Game ↔ Room link | Room declares **`partOf: game:<id>`**; Game manifest lists `rooms[]` | Bidirectional; manifest drives the switcher, `partOf` drives load |
| Persistence keying | Game and each Room are **separate Trellis tenants**; Game tenant id = `game:<slug>` | Reuses existing `tenantId = worldId` seam in [WorldShell](../../src/lib/ui/WorldShell.svelte); no new store class |
| Shared vocabulary | `ComponentSchema` / `EntityType` nodes move to the **Game graph**, registered once at load | Fixes today's per-room duplication; `saveAsType` writes here |
| Collection definition | A collection **is an `EntityType`** tagged as a collection (`collection: true` or `Collection` marker) | Reuse `defineType` + registry; no parallel schema system |
| **Objects ↔ Collections backend** | **Same primitive.** Both are game-global `EntityType`s via `defineType`. Objects = types instantiated into rooms; Collections = types holding data records. | One type-definition backend, not two (see [[object_context_spec]] — the `ObjectsResourcePanel` resource editor and Collections share it) |
| Record identity | Records are **entities** conforming to a collection type, id `record:<collection>/<slug>` | Load as normal entities with no pickable component ⇒ invisible to viewport by construction |
| Where records live | In the **Game graph**, not any room graph | Game-global is the whole point |
| Relational field | Extend `ref` with an optional **target descriptor** (`ref` → `{ t:'ref', of:'record:Character' \| 'asset' \| 'entity' }`) | `ref` already exists ([schema.ts](../../src/lib/engine/ontology/schema.ts)); today it's an opaque string |
| Runtime merge | Load **Game graph first** (schemas/types/records), then active Room graph; concat into `world.entities` | Types must register before room instances build (matches `loadOntology` two-pass) |
| Editing surface | New **Collections** bottom-dock route (table/list); records edited via the **existing field inspector** | Fills the reserved dock slot ([[gamemaker_navigation_spec]]); inspector is already schema-driven |
| Graph route | The stubbed **Graph** route becomes the game-global **record + `ref`-edge** view | Natural home to visualize relational props |
| Sync | Game-global durable patches replicate on a **Game durable channel**; room patches unchanged | Editors in different rooms of the same game must see record edits |
| Undo/redo | Record create/edit/delete flow through the **existing `editHistory`** as `spawnEntity`/`setField`/`despawnEntity` | Records are entities; reuse the stack |
| Play mode | Collections are **read-only in play** in v1; behaviors/formulas may *read* records | Authoring-only surface first; runtime writes are a follow-up |
| Backend residency | Game/Room graphs live in **Trellis** (the durable tier is already `TrellisDurableStore`) | The Game tier is the seam for "data lives outside the editor"; UI stays the standalone GameMaker editor |
| Cross-game library | **Out of scope v1** | A Game is the unit; reusing records across Games is a later import feature |

---

## Data model

### Game bundle (new durable type)

```ts
// src/lib/engine/ontology/gameBundle.ts (new)
export const GAME_BUNDLE_TYPE = 'GameBundle';

export interface GameManifest {
  id: string;                 // "game:powder"
  title: string;
  rooms: RoomRef[];           // ordered; drives the switcher
  defaultRoom: string;        // room id to open on load
}

export interface RoomRef {
  id: string;                 // "room:mountain-1"
  title: string;
  dimensions: '2d' | '3d';
  file?: string;              // static seed url, if any
  tenant: string;             // multiplayer room / persistence tenant
}
```

The Game graph (`GameBundle.graph`) is a JSON-LD `@graph` holding exactly the node kinds
`loadOntology` already understands, plus records:

- `ComponentSchema` nodes — shared component vocabulary
- `EntityType` nodes — shared types **and** collection definitions
- record entity nodes — `conformsTo` a collection type

### Collection = tagged EntityType

```jsonc
{
  "@id": "type:Character",
  "@type": "EntityType",
  "collection": true,              // NEW: marks this type as a collection
  "collectionMeta": { "icon": "user", "plural": "Characters" },
  "components": ["CharacterProfile"]
}
```

```jsonc
{
  "@id": "record:Character/alba",
  "conformsTo": "Character",
  "components": {
    "CharacterProfile": {
      "displayName": "Alba",
      "bio": "…",
      "homeRoom": "room:mountain-1",       // ref → entity/room
      "portrait": "asset:tex/alba.png",     // ref → asset
      "rival": "record:Character/koa"       // ref → record
    }
  }
}
```

### Relational ref (schema extension)

```ts
// schema.ts — FieldSchema gains an optional target hint
export interface FieldSchema {
  t: FieldType;                 // 'ref' unchanged
  sync?: SyncPolicy;
  default?: unknown;
  optional?: boolean;
  of?: RefTarget;               // NEW: what a ref points at (UI + validation only)
}
export type RefTarget =
  | { kind: 'record'; collection: string }  // record:<collection>/*
  | { kind: 'asset' }                         // asset catalog
  | { kind: 'entity' };                       // any entity in the merged world
```

`of` is **advisory** — refs stay plain strings on the wire; `of` drives the picker widget
and a soft validation warning. Unknown/dangling refs never break load (match existing
warn-and-skip resilience).

---

## Load & merge pipeline

Change in [WorldShell.svelte](../../src/lib/ui/WorldShell.svelte) bootstrap:

1. Resolve `gameId` (from `?game=` / manifest) and `roomId` (from `?room=`, default
   `manifest.defaultRoom`).
2. Load **Game durable store** (tenant `game:<id>`) → `gameDoc` (schemas, types, records).
3. `loadOntology(gameDoc)` **pass 1** effect: register all `ComponentSchema` /
   `EntityType` (incl. collections). Records build into `world.entities`.
4. Load **Room durable store** (tenant = room, existing path) → `roomDoc`.
5. Build room instances against the already-registered vocabulary; append to
   `world.entities`.
6. `world.setReady([...records, ...roomEntities])`.

`loadOntology` already does register-then-build in two passes ([loadOntology.ts](../../src/lib/engine/ontology/loadOntology.ts));
v1 generalizes it to accept **multiple graphs** sharing one registry pass.

Room switch (`loadGame` → intent `loadRoom`) stays a reload but keeps the **same `gameId`**;
only `?room=` changes. Game-global data persists across the switch.

> **Naming collision to resolve in impl:** the existing `?room=` param
> ([roomUrl.ts](../../src/lib/engine/net/roomUrl.ts)) is today the *multiplayer* room id and
> defaults to `?game=`. Under this spec `?room=` should select a **Room within a Game**;
> the multiplayer tenant becomes `game:<id>/<room>`. Sequencing handled in the plan.

---

## Persistence & sync

- **Game store:** a second `TrellisDurableStore` bound to tenant `game:<id>`, with its own
  bundle read/write helpers (`GameBundle` instead of `WorldBundle`). Same class, new type
  constant — no new store implementation.
- `world.svelte.ts` gains a **routing rule**: a durable patch targeting a `record:*` /
  `type:*` / `component:*` id persists to the **Game store + Game durable channel**;
  everything else keeps going to the room store. Single branch in `#persistToStore` /
  `#broadcastDurablePatch`.
- Static/read-only Games use `StaticDurableStore` for the Game graph too (seed `.jsonld`).

---

## Editor surfaces (IA)

Collections and the Game tier slot into the **existing GameMaker navigation** — they do not
introduce a new shell. See [[gamemaker_navigation_spec]] / [[editor_shell_refactor_spec]].

| Surface | Route / location | Scope | Content |
| ------- | ---------------- | ----- | ------- |
| **Collections** | bottom-dock route (reserved slot) | game-global | collection list → record table |
| Record editor | Collections route right pane | game-global | existing field inspector + `ref` picker |
| **Graph** | bottom-dock route (currently stub) | game-global | records + `ref` edges |
| **Objects** | bottom-dock route | game-global | `EntityType`s (shares backend w/ Collections) |
| **Rooms** | bottom-dock route | selects a room | room list / switcher |
| Instances | left-pane tab (Rooms route) | active room | placed spatial entities |

**Rule (extends nav spec):** bottom-dock routes are **game-global**; only the **Rooms** route
selects which room is active. Records never appear in the viewport or `selectableEntities`
(no pickable component) — they are a data surface, not a spatial one.

Actions: **New collection** (name → `defineType` with `collection:true`), **New record**
(`spawnFromType` into the Game graph, no viewport select), **duplicate**, **delete**. Record
edits route to the Game store; a `ref` picker widget is keyed off `FieldSchema.of`.

---

## Scope

**In v1:** Game container + manifest, shared schemas/types at game level, collection
types, record CRUD in a Collections route, relational `ref` with picker, merge-load,
game-scoped sync + undo, static seed support.

**Out of v1:** cross-Game record import/library; runtime record writes from play/behaviors
(read-only in play); per-record live EQL subscriptions (stays blob + poll like `WorldBundle`);
reordering/foldering collections; permissions per collection; renaming `Scene*` files to
`Room*`.

---

## Migration path (from today / interim "B")

1. **Wrap, don't rewrite.** Introduce `GameBundle` with a manifest whose `rooms[]` are the
   current `GAMES` entries. Existing room `.jsonld` files are unchanged; each becomes a
   `RoomRef`.
2. **Hoist shared vocabulary.** Move duplicated `ComponentSchema`/`EntityType` nodes out of
   individual room files into the Game graph (codemod over `static/games/*.jsonld`).
3. **Interim fallback (B):** before the Game store lands, a reserved `__globals` room can
   host collections and be loaded alongside the active room. The merge pipeline is the same
   shape, so A absorbs B by swapping the second graph's source from a room tenant to the
   Game tenant.

---

## Open questions

1. **Manifest source of truth** — `GAMES` table (code) vs. a `GameBundle` per tenant
   (durable). Proposal: durable manifest is canonical; `GAMES` becomes a dev seed list.
2. **Room tenancy / `?room=` collision** — keep one Trellis tenant per room, id
   `game:<id>/<room>` (see load pipeline note). v1 keeps per-room tenants for netcode
   continuity.
3. **Ref integrity on delete** — soft (dangling-ok, warn) vs. cascade. v1: soft.
4. **Record → room entity refs across a reload** — resolvable because Game graph is always
   loaded; a ref into a *non-active* room is valid but unresolved until that room opens.

---

## Files (anticipated)

| Path | Change |
| ---- | ------ |
| `src/lib/engine/ontology/gameBundle.ts` | **new** — `GameBundle` type, manifest, read/write helpers |
| `src/lib/engine/ontology/schema.ts` | `FieldSchema.of` (RefTarget); collection flags on `EntityType` |
| `src/lib/engine/ontology/loadOntology.ts` | multi-graph load (shared registry pass) |
| `src/lib/engine/ontology/registry.ts` | `isCollection` / `listCollections` helpers |
| `src/lib/engine/ontology/durableStore.ts` | `GameBundle` read/write (parallel to `seedWorld`) |
| `src/lib/ui/WorldShell.svelte` | load Game store + merge; resolve `gameId`/`roomId` |
| `src/lib/engine/runtime/world.svelte.ts` | patch routing (record/type/component → Game store) |
| `src/lib/engine/games.ts` | `loadRoom` (keep game, switch room); manifest-backed list |
| `src/lib/ui/CollectionsPanel.svelte` | **new** — collection/record browser (Collections route) |
| `src/lib/ui/BottomDock.svelte` | add **Collections** route to center group |
| `src/lib/ui/ui.svelte.ts` | `WorldRoute` gains `'collections'` |
| `src/lib/ui/inspector/RefField.svelte` | **new** — ref picker keyed off `FieldSchema.of` |
| `e2e/collections.spec.ts` | **new** — create collection, add record, ref another record, survives room switch |

---

## References

- [[gamemaker_navigation_spec]] — bottom-dock IA; Collections is the reserved center-group slot
- [[editor_shell_refactor_spec]] — route → layout; Collections route + Graph route
- [[object_context_spec]] — instance editor; shares the game-global `EntityType` backend
- `src/lib/engine/ontology/` — registry, loadOntology, durableStore, seedWorld
</content>
