# world-engine

<img width="1920" height="1080" alt="CleanShot 2026-07-03 at 00 22 39" src="https://github.com/user-attachments/assets/98632242-e9ed-43a8-b0f8-ba5b4084fa20" />
<img width="1920" height="1080" alt="CleanShot 2026-06-28 at 21 16 22" src="https://github.com/user-attachments/assets/7730dd39-f33d-4225-aac2-cf05aeeeb58e" />

A **data-first, realtime-multiplayer 3D game engine** where games are authored as
**JSON-LD** against an extensible ontology — built for AI agents to compose worlds
from primitives, not by writing engine code. SvelteKit + Threlte (three.js), a
Trellis realtime relay for multiplayer, and a Trellis-backed durable tier.

> **Authoring a game?** Read **[AGENTS.md](AGENTS.md)** (the how-to) and
> **[docs/ontology.md](docs/ontology.md)** (the schema reference). This README is
> the 30,000-ft view plus a getting-started walkthrough.

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

## Author your first world

A world is a JSON-LD `@graph` with three kinds of node:

- a **component** — a schema of typed fields (`ComponentSchema`)
- a **type** — a reusable composition of components (`EntityType`)
- a **thing** — an entity instance that `conformsTo` a type

```jsonc
{
  "@context": {
    "@vocab": "https://game.example/vocab/",
    "conformsTo": { "@type": "@id" },
    "components": { "@type": "@json" }
  },
  "@graph": [
    { "@id": "component:Health", "@type": "ComponentSchema",
      "fields": { "max": { "t": "number" }, "current": { "t": "number", "default": "=max" } } },

    { "@id": "type:Enemy", "@type": "EntityType",
      "components": ["Transform", "Render", "Health"],
      "defaults": { "Render": { "color": "#c0392b" } } },

    { "@id": "entity:enemy/1", "@type": "Thing", "conformsTo": "Enemy",
      "components": { "Transform": { "position": { "x": 2, "y": 0.5, "z": 0 } },
                      "Health": { "max": 80 } } }
  ]
}
```

Add a component to an entity and its view appears — no per-type components, no
new `.svelte` files. `conformsTo` pulls in the type's components and defaults;
the instance's `components` override them. A typo in an unknown component or
field is warned and skipped, not fatal.

The **worked example** — [`static/games/orbit.jsonld`](static/games/orbit.jsonld)
— defines an `Orbit` component and an `Orbiter` type whose position is a formula:

```jsonc
"Transform": { "position": "=vec(cos(t * Orbit.speed) * Orbit.radius, 0.6, sin(t * Orbit.speed) * Orbit.radius)" }
```

Three cubes orbiting, animated entirely by that one derived field. Zero engine
code. Open `?game=orbit` to see it.

Because formulas are pure and deterministic, every client agrees on the result
without a byte crossing the wire. That's the whole bandwidth argument: **sync the
few authoritative inputs, derive the rest.**

Next steps: **[AGENTS.md](AGENTS.md)** covers world structure, sync policies,
formulas, behaviors, and multiplayer in full. **[docs/ontology.md](docs/ontology.md)**
is the complete schema reference.

## Example worlds

Every `static/games/*.jsonld` is a runnable lesson. Open any with `?game=<name>`.

| World | What it teaches |
| ----- | --------------- |
| `orbit` | Derived-formula animation — a component + type in data, zero code |
| `physics` | Rapier rigid bodies, ramps, `Status`-driven response |
| `physics-pit` | A bigger physics sandbox — walls, balls, momentum |
| `collision-demo` | Collision events (pick up a coin by touching it) |
| `rooms-demo` | Rooms and doors — world navigation between spaces |
| `scripts-demo` | The `Scripts` component — behavior wired from data |
| `events-demo` | The events system — risers, fountains, timers |
| `animated-npc-demo` | Skinned-mesh NPC animation (`Character`) |
| `parkour` | Player controller platforming — platforms, coins, gravity |
| `collect` | A complete risk/reward loop — a real game, not a demo |
| `agent-demo` | **Brave** bot player spawns automatically — walk up and Press E to talk |

The full folder is [`static/games/`](static/games/).

### Agent bot (optional)

Add `?agent=brave` in play mode to spawn **Brave**, a host-owned bot player you can talk to like any other player (Press E when nearby). The **agent-demo** world enables Brave automatically. Replies use a server-side Ollama-compatible API with mock fallback when Ollama is offline:

```
AGENT_OLLAMA_URL=http://127.0.0.1:11434
AGENT_OLLAMA_MODEL=muse-glimmer
```

Demo: `http://localhost:9292/?game=agent-demo&mode=play`

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
