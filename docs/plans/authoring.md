# Plan: An agent-authorable, realtime-multiplayer 3D game engine

## Context

This engine today is a single-player JSON-LD **world viewer**: it loads
`static/world.jsonld` (`@graph` of typed nodes) → parses → reactive state → renders
via threlte. It already embodies the right instinct (ontology-driven, declarative
worlds), but every type is **hardcoded** — `KNOWN_TYPES`, an `if/else` chain in
`EntityHydrator.svelte`, per-type `switch` blocks in `SelectionOutline.svelte` and
`EntityInspector.svelte`, and one bespoke Svelte component per type
(`GroundPlane`, `PropMesh`, `SpawnMarker`, `WorldLights`). There is no behavior
layer, no networking, no player model.

**Goal:** turn it into an engine where **AI agents author games as data (JSON-LD)**
against an extensible ontology, and worlds run **realtime multiplayer**. Two
architectural commitments drive the whole design:

1. **Durability split.** The op-log is for *rules*, not frames. Durable, causal,
   auditable graph (ontology, type/component/behavior defs, world rules,
   relationships, persistent progression) → **Trellis**. Ephemeral, high-frequency,
   loss-tolerant runtime state (transforms, velocities, transient fields) →
   **PartyKit**. We do **not** push frame state into the op-log, and we do **not**
   extend `trellis/sync` (byte/op movement) with game state. The engine is a
   separate module that *consumes* Trellis (durable) + PartyKit (realtime);
   eventual home is unscoped-open `trellis-game`.

2. **The fractal `<Thing/>`.** One recursive, JSON-LD-derived component replaces all
   per-type components. It reads an entity's *components* and composes views from a
   **component→view registry**. Same fractal posture as the vantage work; entities
   nest, so the threlte scene graph mirrors the entity graph.

Plus the unlock the user named: **formulas & relationships at the state level** — a
reactive derivation layer (EQL-S-flavored) so we **sync only authoritative inputs
and derive everything else locally & deterministically**. Less bandwidth, more
expressiveness; spreadsheet semantics for live game state.

---

## Target architecture

### Data model: components, types, and the shadow state graph

Entities become **component bags** (ECS-flavored), authored in JSON-LD:

```jsonc
// DURABLE (Trellis / JSON-LD): what a thing IS + its rules
{ "@id": "type:Crate", "@type": "EntityType",
  "components": ["Transform", "Render", "Rigidbody", "Health"] }

{ "@id": "component:Health", "@type": "ComponentSchema",
  "fields": { "max": { "t": "number", "sync": "durable" },
              "current": { "t": "number", "sync": "realtime",
                           "default": "=max" } } }   // formula default

{ "@id": "entity:prop/crate-a", "@type": "Thing", "conformsTo": "type:Crate",
  "components": {
    "Transform": { "position": {"x":-1.5,"y":0.5,"z":0.8} },
    "Render":    { "mesh": "primitive:box", "color": "#ff6b6b" },
    "Health":    { "max": 100 } } }
```

Each component **field carries a sync policy**: `durable` (from the graph),
`realtime` (synced via PartyKit), or `derived` (a formula, never synced — computed
locally). Runtime state is a **shadow graph**: `state:<entity-id>` nodes holding
only `realtime` + `derived` fields, each referencing its durable `entity:<id>`.
Authority: **per-entity ownership** — the owning client is authoritative for its
entity's realtime fields; PartyKit relays + holds last-known. Server-authoritative
reconciliation is a later milestone.

### Formula / reactivity layer

A small reactive expression engine (Svelte 5 runes-backed). Formula strings
(`"=max"`, `"=Transform.position.y > 0"`, `"=other('entity:zone/a').occupied"`)
parse to a dependency graph and re-evaluate when inputs change. Deterministic and
pure so every client derives identical values from the same synced inputs. This is
the runtime cousin of EQL-S formulas — same "formulas & relationships" feel, at
frame rate.

### Engine layers (all under `src/lib/engine/`)

| Layer | Responsibility | Key files |
| --- | --- | --- |
| **ontology** | schemas, type/component/behavior registries, JSON-LD parsing + validation | `ontology/registry.ts`, `ontology/schema.ts`, `ontology/loadOntology.ts` |
| **runtime** | reactive entity store (component bags), spawn/despawn, queries by component | `runtime/world.svelte.ts`, `runtime/query.ts` |
| **formula** | reactive formula parser + evaluator | `formula/parse.ts`, `formula/evaluate.svelte.ts` |
| **systems** | tick scheduler; behavior primitives (code) parameterized by data | `systems/scheduler.ts`, `systems/behaviors/*.ts` |
| **net** | `NetTransport` interface + adapters (PartyKit realtime; Local/BroadcastChannel dev); presence | `net/transport.ts`, `net/partykit.ts`, `net/local.ts` |
| **player** | local player, input mapping, avatars, camera rigs | `player/input.ts`, `player/LocalPlayer.svelte` |
| **render** | fractal `<Thing/>` + component→view registry (mesh/light/etc.) | `render/Thing.svelte`, `render/views/*.svelte` |
| **authoring (AX)** | schema docs, validation CLI/check, examples, `AGENTS.md` game-authoring guide | `docs/`, `static/games/*` |

**Behaviors under data-first authoring:** novel logic is rare; expose a library of
**code-defined behavior primitives** (`movable`, `gravity`, `spawnable`,
`damageOnContact`, …) that agents *parameterize and compose via JSON-LD*. Derived
state covers most "logic"; new primitives are the only thing requiring a code edit.
This keeps the agent surface data-first without capping expressiveness.

---

## Milestone roadmap (maps to TrellisVCS proposal→spec→impl→review)

> The current build (TRL-1..9) ends at "glTF mesh loading." These continue the chain.
> On approval I'll create the TRL issues per milestone via `trellis issue create`.

**M1 — Ontology & the fractal `<Thing/>` (no networking).**
Refactor the hardcoded type system into a component model. Add
`ontology/` (component schemas, type defs, registry), rewrite `runtime/world.svelte.ts`
as a component-bag store, and replace `EntityHydrator` + the four entity components +
`SelectionOutline`'s switch with one `render/Thing.svelte` driven by a
component→view registry (`Transform`→placement, `Render`→mesh, `Light`→light,
`Marker`→spawn gizmo). Migrate `static/world.jsonld` to the component shape.
Generalize `EntityInspector` to render components/fields generically. *Outcome:
same visual demo, fully data-driven; adding a type = data + (maybe) one view.*

**M2 — Runtime, systems & the formula layer.**
Tick scheduler, behavior-primitive registry, and the reactive formula engine
(durable/realtime/derived field policies). Demonstrate gravity + a derived field.
*Outcome: worlds have live behavior, single-player.*

**M3 — Net transport + presence (multi-tab first).**
`NetTransport` interface; `net/local.ts` (BroadcastChannel) for multi-tab
"multiplayer"; shadow state graph; per-entity ownership; presence list. *Outcome:
two tabs share a world with synced realtime fields — no backend yet.*

**M4 — PartyKit adapter.**
`party/` server (room per world), `net/partykit.ts` client adapter. Sync only
`realtime` inputs; derive the rest locally. Connection/presence UI. *Outcome: real
networked multiplayer across machines.*

**M5 — Player & input model.**
Local player entity, input mapping, controllable avatar, camera rig (replace bare
OrbitControls), remote avatars from presence. *Outcome: walk around together.*

**M6 — Trellis durable backing + AX polish.**
Back the durable tier with Trellis (ontology/world/progression as graph; load via
Trellis client instead of static fetch — `loadOntology` seam). Write the
`AGENTS.md` game-authoring guide + schema docs + 1–2 example games under
`static/games/`. *Outcome: the full two-tier engine + the agent-authoring surface.*

> M6's Trellis integration is the largest unknown (depends on Trellis client
> maturity). M1–M5 are fully buildable now and keep `loadOntology`/`NetTransport`
> as clean seams so Trellis/PartyKit slot in without engine changes.

---

## First milestone (M1) — concrete file plan

Reuse, don't reinvent: keep `loadWorld`'s fetch/validate shape, the runes-based
state pattern in `state/world.svelte.ts`, the threlte `T`/`interactivity`/`GLTF`
usage in `PropMesh.svelte`, and all design tokens in `app.css`.

**New (`src/lib/engine/`):**
- `ontology/schema.ts` — `ComponentSchema`, `EntityType`, field `sync` policy types.
- `ontology/registry.ts` — register/lookup component schemas, types, and view
  renderers (replaces `KNOWN_TYPES`); built-in components: `Transform`, `Render`,
  `Light`, `Marker`, `Ground`.
- `ontology/loadOntology.ts` — generalize `world/loadWorld.ts`+`parseEntity.ts`:
  parse JSON-LD `@graph` into component-bag entities; validate components against
  registered schemas; warn-and-skip unknowns (preserve current resilience).
- `runtime/world.svelte.ts` — component-bag store + `selection`/`status`/inspector
  state migrated from `state/world.svelte.ts`; `query(componentName)` helper.
- `render/Thing.svelte` — fractal component: for each component on the entity, look
  up its view in the registry and render; recurse into child entities.
- `render/views/{MeshView,LightView,MarkerView,GroundView}.svelte` — extracted from
  the existing `PropMesh`/`WorldLights`/`SpawnMarker`/`GroundPlane` bodies, but
  keyed on component data instead of `@type`.

**Modified:**
- `scene/WorldScene.svelte` — iterate entities → `<Thing/>`; drop type filtering.
- `scene/SelectionOutline.svelte` — derive bounds from `Transform`/`Render`
  component data, not a `@type` switch.
- `ui/EntityInspector.svelte` — render component list + fields generically (remove
  `typeDotClass`/per-type `attr-row`s).
- `ui/WorldShell.svelte` — call `loadOntology()`; point error hint at the new path.
- `static/world.jsonld` — migrate nodes to `conformsTo` + `components` shape.

**Removed (folded into registry/views):** `hydrate/EntityHydrator.svelte`,
`entities/{GroundPlane,PropMesh,SpawnMarker,WorldLights}.svelte`,
`world/{types,loadWorld,parseEntity}.ts`, `state/world.svelte.ts` (superseded).

---

## Dependencies

- **M4:** `partykit` + `partysocket` (dev/runtime). Adds a `party/` dir + a
  `dev:party` script. Installed via **pnpm** (single lockfile already enforced).
- **M6:** Trellis client SDK (local+remote modes) for the durable tier.
- No new deps for M1–M3.

---

## Verification

- **Per milestone:** `pnpm check` (0 errors) + `pnpm build` green; `pnpm dev` and
  confirm the viewport renders the demo world and selection/inspector still work.
- **M1 specifically:** the migrated `world.jsonld` renders identically to today
  (ground + two crates + spawn + lights), and **adding a brand-new entity type by
  editing only JSON-LD** (no new `.svelte`/`.ts`) renders correctly — the core
  "agents author as data" proof.
- **M3/M4:** open two clients, move an owned entity in one, confirm it replicates;
  confirm derived fields match across clients while only inputs are on the wire.
- **M5:** two avatars visible and independently controllable.
- Track work via TrellisVCS: `trellis issue start TRL-N` per milestone, close with
  acceptance criteria (`--ac`) covering the checks above.
```
```
