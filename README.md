# threlte world engine

A **data-first, realtime-multiplayer 3D game engine** where games are authored as
**JSON-LD** against an extensible ontology — built for AI agents to compose worlds
from primitives, not by writing engine code. SvelteKit + Threlte (three.js), a
Trellis realtime relay for multiplayer, and a Trellis-backed durable tier.

> **Authoring a game?** Read **[AGENTS.md](AGENTS.md)** (the how-to) and
> **[docs/ontology.md](docs/ontology.md)** (the schema reference). This README is
> the 30,000-ft view.

## Quick start

```sh
pnpm install
just run                # vite (:9292) + trellis db (:8230) + relay (:8231)
# or: pnpm dev          # just the app

# open http://localhost:9292/?game=orbit   → an example world
# open the same URL in two browser tabs     → multiplayer (BroadcastChannel)
# add ?durable=trellis (with `just run`)    → persisted durable edits
# add ?net=relay (with `just run`)          → cross-browser / cross-machine MP
```

`pnpm check` type-checks, `pnpm build` builds.

## Deploy to Vercel

The app ships as a **static-world demo** on Vercel — no Trellis or PartyKit required for the default experience.

1. Connect the repo to [Vercel](https://vercel.com) (framework preset: **SvelteKit**).
2. Build command: `pnpm build` · Install: `pnpm install` · Node **20.x**.
3. Open `https://<project>.vercel.app/?game=orbit` after deploy.

| Feature | Vercel | Local `just run` |
| ------- | ------ | ---------------- |
| Load `?game=` worlds | yes | yes |
| Edit / play mode | yes | yes |
| Multi-tab multiplayer | yes (BroadcastChannel) | yes |
| Cross-machine MP | needs relay deploy + `VITE_RELAY_URL` env | `?net=relay` |
| `?durable=trellis` | no (needs hosted Trellis) | yes (`:8230` + Vite proxy) |
| Assets panel (`/api/assets`) | yes | yes |

**Optional env:** `VITE_RELAY_URL` — WebSocket relay base (e.g. `wss://relay.example.com/rt`) for `?net=relay` in production.

Spec: [docs/artifacts/vercel_demo_deploy_spec.md](docs/artifacts/vercel_demo_deploy_spec.md)

## Core ideas

- **Entities are component bags.** A world is a JSON-LD `@graph` of entities; each
  entity is a set of typed components (`Transform`, `Render`, `Gravity`, …). New
  components and types can be defined *in the world file* — data, not code.
- **One fractal `<Thing/>`.** A single recursive component renders any entity by
  looking up a view per component. No per-type components.
- **Two-tier state, split by durability:**
  - *durable* rules (ontology, types, relationships) → the graph (→ Trellis).
  - *realtime* state (transforms, velocities) → synced over PartyKit (~20 Hz).
  - *derived* state (formulas) → never stored or sent; recomputed locally on every
    client. So only authoritative inputs cross the wire.
- **State-level formulas.** Any field can be a formula (`"=Health.current / max"`,
  `"=vec(cos(t), 0.6, sin(t))"`) — spreadsheet semantics for live game state.
- **Swappable seams.** `NetTransport` (BroadcastChannel ↔ PartyKit) and
  `WorldSource` (static file ↔ Trellis) isolate the backends from the engine.

## Architecture

```
src/lib/engine/
  ontology/   schema, registry, loader, WorldSource (+ sources/trellis)
  runtime/    reactive entity store
  formula/    safe expression compiler + evaluator
  systems/    tick scheduler + behaviors (gravity)
  net/        transport interface, local (BroadcastChannel), relay (Trellis /rt), session
  player/     input, spawnPlayer, movement
  render/     Thing (fractal), component views, camera
scripts/relay.mjs  local Trellis realtime relay (:8231)
static/       world.jsonld (default) + games/*.jsonld (examples)
```

## How it was built

Six milestones, tracked in TrellisVCS (TRL-10 → TRL-15):

| | Milestone |
|---|---|
| M1 | Ontology + fractal `<Thing/>` — data-driven component model |
| M2 | Tick scheduler + behaviors + reactive formula engine |
| M3 | `NetTransport` + presence + shadow-state sync (multi-tab) |
| M4 | PartyKit adapter — cross-machine multiplayer |
| M5 | Player layer — input, avatars, per-entity ownership |
| M6 | Durable-source seam + authoring docs + example games |

## Status

Feature-complete per plan. The durable tier ships as a typed Trellis seam
([sources/trellis.ts](src/lib/engine/ontology/sources/trellis.ts)) pending the
Trellis browser client; netcode is owner-authoritative (server-authoritative
reconciliation is future work). Built on Svelte 5 runes, threlte 8.
