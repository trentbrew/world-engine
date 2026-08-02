# Authoring games with this engine

This is a **data-first, realtime-multiplayer 3D game engine**. You build games
by writing **JSON-LD world files** against an extensible ontology — not by
editing engine code. A world is a graph of entities; each entity is a bag of
components; components have typed fields. The renderer, the systems, and the
network layer all read from that data.

> If you only read one thing: drop a `.jsonld` file in `static/games/`, open
> `?game=<name>`, and you have a world. New entity types and components can be
> defined **inside that file** — no `.svelte`/`.ts` changes needed unless you're
> adding a brand-new _behavior_ (see [Behaviors](#behaviors)).

---

## Run it

```bash
just run                      # full stack: vite + trellis db + relay
pnpm dev                      # default world (static/world.jsonld)
# open http://localhost:9292/?game=orbit      → loads static/games/orbit.jsonld
# open the same URL in two tabs               → multiplayer (BroadcastChannel)

pnpm dev:relay                # Trellis realtime relay on :8231 (cross-client)
# open ?net=relay on two browsers (same ?room= / ?game=)
```

URL params: `?game=<name>` (which world), `?room=<id>` (which multiplayer room;
defaults to the game name), `?net=relay` (Trellis relay instead of
BroadcastChannel), `?durable=trellis` (persist durable edits via Trellis —
requires `just run` or `trellis db serve` on :8230), `?trellis=<url>` (Trellis
server, default `http://localhost:8230` via Vite proxy at `/trellis-db`).

**Production (Vercel):** static worlds and BroadcastChannel multiplayer work out
of the box. `?durable=trellis` is **dev/local only** until a hosted Trellis
backend is wired (see TRL-40). For cross-machine MP on Vercel, point
`VITE_RELAY_URL` at a deployed Trellis relay (e.g.
`wss://relay.example.com/rt`) at build time.

---

## Changing the engine (conventions)

Most work here is **authoring** (JSON-LD worlds). When you _do_ edit engine code
under `src/`, prefer **reversible** changes over destructive ones.

> **Flag features off; don't delete them.** To hide, disable, or "remove" a
> feature, gate it behind a flag — a visibility `bool` prop, a `ui` toggle, or a
> `?param` — and keep the code path mounted. Do **not** delete the component,
> route, field, or its tests unless the user explicitly says _delete / remove
> permanently_.

- **Interpret "hide / drop / get rid of / we don't need X" as "flag it off by
  default,"** not "nuke it." A hard delete is a separate, explicit instruction.
- **Removing an entry point** (a tab, button, or route) means hiding the _entry
  point_ — leave the underlying panel/component mounted behind the flag so it
  turns back on without a rebuild, and so its tests keep passing.
- **The canonical pattern** is a visibility prop with a safe default. See
  `AppShell.svelte`'s `rightPanelVisible?: boolean` — the right column collapses
  when a route (e.g. Collections) passes `rightPanelVisible={false}`, but every
  inspector component stays intact.

  ```svelte
  interface Props { fooVisible?: boolean }
  let { fooVisible = true }: Props = $props();   // default on; callers opt out
  {#if fooVisible}{@render foo()}{/if}
  ```

- **Tests track the UI, they don't get deleted with it.** If a change would
  remove or rewrite tests, say so and confirm first. When a feature is _hidden_,
  its tests should still pass (the code path exists); when a feature is
  genuinely _removed_ by explicit request, update or delete the affected specs
  as part of that request.
- **Additive-first for the ontology.** New `FieldType`s, components, and durable
  patch kinds are added alongside existing ones (see how `select` / `longtext` /
  `removeEntity` were introduced) — never repurpose or drop an existing kind
  that authored worlds may depend on.

---

## Mental model

```
World file (JSON-LD)  →  loadOntology  →  reactive entities  →  <Thing/> renders
        rules (durable)                     component bags        per-component views
```

- **Entity** = `@id` + a `components` bag. Optionally `conformsTo` an
  `EntityType`.
- **Component** = named bag of typed fields (e.g. `Transform.position`).
- **`<Thing/>`** is one recursive component that renders an entity by looking up
  a _view_ for each of its components (`Render`→mesh, `Light`→light, …). Add a
  component to an entity → its view appears. No per-type components.
- **Systems** run every tick (gravity, player movement, formula evaluation).
- **Two tiers of state** (this matters for multiplayer — see
  [Sync](#field-sync-policies)):
  - _durable_: the rules, authored here, live in the graph (→ Trellis later).
  - _realtime_: transforms etc., synced over the wire
    (PartyKit/BroadcastChannel).
  - _derived_: never stored or sent — recomputed locally from a formula.

---

## World file structure

A world is a JSON-LD document with an `@graph` array. Three kinds of node:

```jsonc
{
  "@context": {
    "@vocab": "https://game.example/vocab/",
    "conformsTo": { "@type": "@id" },
    "components": { "@type": "@json" }
  },
  "@graph": [
    // 1. (optional) define a new COMPONENT
    {
      "@id": "component:Health",
      "@type": "ComponentSchema",
      "fields": {
        "max": { "t": "number", "sync": "durable" },
        "current": { "t": "number", "sync": "realtime", "default": "=max" }
      }
    },

    // 2. (optional) define a new TYPE = a reusable composition of components
    {
      "@id": "type:Enemy",
      "@type": "EntityType",
      "components": ["Transform", "Render", "Health"],
      "defaults": { "Render": { "color": "#c0392b" } }
    },

    // 3. ENTITY INSTANCES ("Things")
    {
      "@id": "entity:enemy/1",
      "@type": "Thing",
      "conformsTo": "Enemy",
      "components": {
        "Transform": { "position": { "x": 2, "y": 0.5, "z": 0 } },
        "Health": { "max": 80 }
      }
    }
  ]
}
```

- `conformsTo` pulls in the type's components + defaults; the instance's
  `components` override them.
- Unknown components/fields are warned-and-skipped (a typo won't break the
  world).
- `position`/`rotation` accept `{x,y,z(,w)}` or arrays; both coerce to arrays.

---

## Built-in components

| Component   | Fields (default)                                                                                          | Notes                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Transform` | `position` vec3, `rotation` quat, `scale` vec3 `[1,1,1]`                                                  | `position`/`rotation` are **realtime**                                                                                                                   |
| `Render`    | `mesh` `"primitive:box"`, `color` `"#ff6b6b"`, `anchor` `"origin"`                                        | `mesh` = `primitive:*` or a `.glb`/`.gltf` URL; `anchor`: `origin` (file pivot), `bottom` (feet on `position.y`), `center` (bbox center on `position.y`) |
| `Light`     | `kind` `"ambient"`, `intensity` `1`                                                                       | `kind`: `ambient` \| `directional` (uses `Transform.position`)                                                                                           |
| `Marker`    | `kind` `"spawn"`                                                                                          | spawn-point gizmo; players spawn near these                                                                                                              |
| `Ground`    | `size` `20`, `color` `"#0e0e12"`                                                                          | ground plane + grid                                                                                                                                      |
| `Gravity`   | `g` `9.8`, `vy` `0`, `rest` `0.5`                                                                         | falls to `rest` height (a behavior)                                                                                                                      |
| `Physics`   | `body` `dynamic`, `collider` `box`, `mass` `1`, `restitution` `0.2`, `friction` `0.8`, `gravityScale` `1` | Rapier rigid body in play mode (see `@threlte/rapier`)                                                                                                   |
| `Player`    | `speed` `4`, `color`                                                                                      | WASD-controlled avatar, one per client                                                                                                                   |

Built-in **types**: `GroundPlane`, `Prop`, `SpawnPoint`, `AmbientLight`,
`DirectionalLight`, `Player` (SkinnedMesh mannequin + Mesh3DAnimator + Physics
capsule), `Character`. Defined in
[registry.ts](src/lib/engine/ontology/registry.ts).

---

## Field sync policies

Every field declares how it travels (default `durable`):

- **`durable`** — authored, part of the rules. Sent once (e.g. at spawn), then
  static.
- **`realtime`** — streamed (~20 Hz) by the entity's owner; peers apply it.
- **`derived`** — a formula; never stored or sent. **Every client recomputes
  it** locally from synced inputs. This is the whole bandwidth argument: sync
  the few authoritative inputs, derive the rest.

A field whose value (or default) is a formula string is treated as derived no
matter its declared policy.

---

## Formulas

Any field value or default may be a **formula**: a string starting with `=`.
Formulas are pure and deterministic (so every client agrees). Examples:

```jsonc
"current": "=max"                                  // sibling field
"grounded": "=Transform.position.y <= 0.55"        // another component (vector .x/.y/.z/.w)
"tint": "=Health.current > 25 ? 'ok' : 'hurt'"     // ternary
"position": "=vec(cos(t * Orbit.speed) * Orbit.radius, 0.6, sin(t) * Orbit.radius)"
"linked": "=other('entity:zone/a').occupied"       // cross-entity relationship
```

**Scope:** sibling fields (bare), every component by name, `t`/`dt`/`tick`,
`pi`, functions `min max abs floor ceil round sqrt sin cos clamp vec other`.
`vec(x,y,z)` returns a vector — assign it to `Transform.position` to animate
with no code. Operators: `+ - * / %`, `< <= > >= == !=`, `&& || !`, `? :`.
Engine: [formula/parse.ts](src/lib/engine/formula/parse.ts),
[formula/evaluate.ts](src/lib/engine/formula/evaluate.ts).

---

## Behaviors

Behaviors are the **one place code is required**. A behavior is a component + a
system that reads it each tick. Agents normally just _parameterize_ existing
behaviors in data (e.g. add `"Gravity": { "g": 4 }` to an entity). To add a
_new_ behavior primitive:

1. Register a component and write a system in
   `src/lib/engine/systems/behaviors/` (model it on
   [gravity.ts](src/lib/engine/systems/behaviors/gravity.ts)). Guard with
   `if (!world.isOwner(entity.id)) continue;` so only the owner integrates.
2. Register it in [systems/index.ts](src/lib/engine/systems/index.ts) (order:
   behaviors → formula system).

Often you don't need a system at all — a `derived` formula field covers it.

---

## Multiplayer & ownership

- Each browser tab is a **peer**; presence + host election run over a
  [`NetTransport`](src/lib/engine/net/transport.ts) (BroadcastChannel by
  default, the Trellis relay via `?net=relay`).
- **Ownership is per-entity.** Each tab owns its own `Player`; the rest of the
  world is owned by the **host** (lowest client id). Owners run behaviors and
  broadcast their entities' realtime fields; peers apply them and skip those
  behaviors. Entities spawn/despawn across peers automatically (players appear
  and vanish as tabs open/close). See
  [session.svelte.ts](src/lib/engine/net/session.svelte.ts).

---

## Durable tier (Trellis)

World rules load through a [`WorldSource`](src/lib/engine/ontology/source.ts)
seam — today `staticSource('/games/x.jsonld')`. The durability split: durable
rules belong in Trellis (op-logged graph), realtime state stays on PartyKit and
never enters the op-log. To back a world with Trellis, implement
`TrellisWorldClient.queryWorld()` to return the same `@graph` and call
`loadOntology(trellisSource(client, id))` — the only integration point is
[sources/trellis.ts](src/lib/engine/ontology/sources/trellis.ts).

---

## Worked example

[static/games/orbit.jsonld](static/games/orbit.jsonld) defines a new `Orbit`
component and an `Orbiter` type whose `Transform.position` is a `vec()` formula
— three orbiting cubes, authored with **zero engine code**. Open `?game=orbit`.

See also [docs/ontology.md](docs/ontology.md) for the full schema reference.
