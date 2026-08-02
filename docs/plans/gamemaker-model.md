# GameMaker-Shaped Authoring Model — Proposal

**Type:** Proposal (pipeline root) | **Issues:** TBD | **Source:** design conversation, July 2026

---

## Thesis

GameMaker's mental model — *sprites, objects, instances, rooms, events, scripts* — is
not a different **engine** from ours; it's a different **authoring projection** over
what is essentially an ECS. Our engine already has the substrate (entities as
component bags, types, per-tick systems, a reactive formula layer, ownership-aware
sync). What we lack is GM's **object-localized, event-driven authoring surface** and
two assets (real sprites, rooms-as-scenes).

The move is therefore **additive, not a rewrite**: put a GameMaker-flavored vocabulary
*on top of* the current runtime. We keep what makes this engine special —
declarative formulas, the multiplayer sync tiers, agent-authorability as JSON-LD —
and we gain GM's approachability. Where GM's design fights our goals (global mutable
state, arbitrary imperative code), we deliberately diverge (see [Non-goals](#non-goals)).

---

## Concept mapping

| GameMaker | What we have today | Gap to close |
|---|---|---|
| **Sprite** | `Render.mesh` + `Render.anchor` (origin), `xy` world profile | frames / animation / collision-mask → a first-class `Sprite` asset |
| **Object** | `EntityType` (components + defaults), `registry.ts` | attach **events** + a default sprite to the type |
| **Instance** | `Entity` / `Thing` (+ per-component `overrides`) | ✅ essentially done |
| **Room** | a world file loaded via `?game=` | multiple rooms + transitions + per-room camera/layers |
| **Event** (Create/Step/Collision/Alarm/Destroy/Input) | per-tick **systems** (global), `systems/index.ts` | per-object **event handlers** + a dispatcher system |
| **Alarm** | — | an `Alarm` component + `alarmSystem` |
| **Collision event** | `Physics`, `GroundSensor`, `Collectible` proximity (`collect.ts`) | generalized overlap → `onCollision(other)` |
| **Script / GML** | no-eval formula compiler (`formula/parse.ts`, `formula/evaluate.ts`) | extend from *expressions* to *actions* = "GML-lite" |
| **`with(obj){…}`** | `world.query(Component/Type)` | thin authoring sugar over the query |
| **Layers** | render order via views | optional `layer` field on renderables |

Two real gaps: **an event layer**, and **sprites + rooms**. The event layer is the
soul of GameMaker, so it leads.

---

## The event model (the core)

### Events are data-authored systems with a dispatch key

Our behaviors today say *"every tick, over all entities with component X, do Y."*
GameMaker says *"when `<trigger>` happens to this object, do Y."* Same machinery,
inverted surface. We implement GM's model as **one event-dispatcher system** running
inside the existing `scheduler.svelte.ts`:

- **Triggers** already exist in the engine's life-cycle:
  `create` = spawn · `destroy` = despawn · `step` = tick · `collision` = overlap ·
  `alarm` = timer expiry · `input` = owned-entity input.
- **Handler bodies** are authored **as data** — an ordered list of safe *actions*
  built on the formula compiler. That keeps games diffable, op-log-friendly, and
  agent-authorable (better than raw imperative GML for our purposes).

An Object reads like GameMaker but stays JSON-LD:

```jsonc
{ "@id": "object:Coin", "@type": "EntityType",        // = GM Object
  "sprite": "sprite:coin",
  "components": ["Transform", "Sprite", "Collectible"],
  "events": {
    "create":    [ { "set": "Sprite.frameSpeed", "to": 0.2 } ],
    "collision": { "with": "object:Player",
                   "do": [ { "score": "+= Collectible.value" },
                           { "sfx": "Bing" },
                           { "destroy": "self" } ] },
    "alarm0":    [ { "destroy": "self" } ]
  }
}
```

### The unifying insight: a built-in behavior *is* an event handler

A "behavior primitive" (a TS system like `gravity.ts` / `jump.ts`) and an authored
event are two implementations of the **same handler interface**:

- **code handler** — shipped in the engine, fast, privileged (keep `gravity`,
  `jump`, `physics` here);
- **data handler** — authored in the world file, safe, sandboxed (collision, alarms,
  custom logic).

The dispatcher runs both. This lets us adopt the event model without rewriting the
existing systems, and it gives a clean story for "graduate a hot data-event into a
code behavior when it needs the speed."

### Action vocabulary ("GML-lite")

A small, finite, composable set — declarative and safe (no arbitrary loops beyond
query-scoped `with`, no eval). All value slots accept a formula (`"=…"`) evaluated
against the entity's components plus `self`, `other` (collision), and `t dt tick`.

| Action | Meaning |
|---|---|
| `{ "set": "Comp.field", "to": <expr> }` | assign a field (routes through `setField`, so sync tiers stay honest) |
| `{ "spawn": "object:Type", "at": <vec3\|expr>, "with": {…} }` | instance a new object |
| `{ "destroy": "self" \| "<id>" \| { "query": "Type" } }` | despawn (replicated) |
| `{ "alarm": n, "in": <seconds> }` | arm alarm *n* on self |
| `{ "if": <expr>, "then": [ … ], "else": [ … ] }` | branch |
| `{ "with": "Type", "do": [ … ] }` | run actions in the context of each matching instance (GM's `with`) |
| `{ "sfx": "<name>" }` · `{ "score": "<expr>" }` · `{ "goto_room": "<room>" }` | effects (reuse `audio/sfx`, `game/score.svelte.ts`, room switch) |

Handler = an ordered action list evaluated by the trigger's authority. Keeping the
DSL finite is the point: it stays diffable, agent-authorable, and multiplayer-safe.

---

## Authority — GM's model made multiplayer-correct

GameMaker never had to ask *"who runs this event?"* We do — and our ownership model
(`net/session.svelte.ts`, `world.isOwner`, host election) already answers it. Every
trigger carries an **authority policy**; this turns a constraint into a differentiator.

| Trigger | Runs on | Why |
|---|---|---|
| `create` / `step` / `destroy` | entity **owner** (world→host, player→client) | mutations flow through the owner's `setField`/patch seams |
| `alarm` | **owner** | the timer is owner-local runtime state |
| `collision` | **host** (single authority) | avoid double-application across peers; mirrors `Collectible`'s networked despawn today |
| `input` / key | **owner** (local client) | input is inherently client-local |

Event bodies must be **deterministic given (self, other, t)** so host- or owner-run
handlers converge. This is the same discipline that already keeps `derived` fields
consistent across peers.

---

## Events vs formulas — keep both

They are complementary channels; do not collapse them.

- **Formula (`derived` field)** — *continuous, stateless*, recomputed every tick,
  never on the wire. For animation and derived state (the coin's bob, `image_index`,
  `Status.grounded`).
- **Event action** — *discrete, stateful side-effect*, fires on a trigger, mutates
  `durable`/`realtime` through the seams. For game logic ("when hit, do this").

Rule of thumb: if it's *a value that is always `f(t, state)`* → formula. If it's
*"when X, change the world"* → event. GameMaker only has the second; offering both is
strictly more expressive.

---

## Sprites (asset upgrade)

Promote `Render` into a real `Sprite` asset:

- `frames` (spritesheet ref + `frameCount`) · `frameSpeed` (`image_speed`) ·
  `frameIndex` (`image_index`) · `origin` (reuses `anchor`) · `mask` (`box|circle|precise`).
- **`frameIndex` is a `derived` formula** by default — `floor(t*frameSpeed) % frameCount`
  — so animation costs nothing on the wire.
- One asset, two views (register in `render/registerViews.ts`): a UV-animated quad in
  the `xy` profile, mesh/material in 3D. Reuses the existing view-registry pattern.

---

## Rooms (scenes + transitions)

Formalize "world file" into a `Room` scene:

```jsonc
{ "@id": "room:level-1", "@type": "Room",
  "camera": "follow", "size": [40, 20], "layers": ["bg", "instances", "fg"],
  "instances": [ /* entities */ ],
  "next": "room:level-2" }
```

- `goto_room` (action) → a **session-level scene switch**: swap the durable graph via
  `loadOntology`, keep the players, re-broadcast. Room transitions become durable
  scene changes over the relay — again, more than GM gives.
- `?game=` already loads one "room"; this adds multiple rooms + in-world transitions.

---

## Phased roadmap

| Phase | Deliverable | Depends on |
|---|---|---|
| **0 — Event substrate** | dispatcher system; `events` on `EntityType`; actions `set`/`spawn`/`destroy`/`if`; triggers `create`/`step`/`destroy`; owner authority; `self`/`other` context in `evaluate.ts` | — |
| **1 — Alarms** | `Alarm` component + `alarmSystem`; `alarm[n]` trigger; `alarm` action | 0 |
| **2 — Collision events** | generalized overlap → `onCollision(other)`; host authority; **migrate `Collectible` to a collision event** (keep the component as data) | 0 |
| **3 — Input events** | `input`/key triggers on owned entities; local authority; `with` action | 0 |
| **4 — Sprites** | `Sprite` asset (frames/anim/origin/mask); `xy` renderer path | — |
| **5 — Rooms** | `Room` type; `goto_room`; per-room camera/layers; durable scene switch | 0 (for `goto_room`) |
| **6 — Scripts / `with`** | named reusable action lists; `with(Type)` sugar; script refs from events | 0 |

**Critical path:** Phase 0 (the dispatcher) unblocks everything. Phases 1–3 proceed in
parallel after 0. Phases 4–5 are largely independent. Each phase becomes a
Spec → Impl → Review chain in the TrellisVCS pipeline; this doc is the Proposal root.

**Smallest slice that "feels like GameMaker":** Phase 0 + Phase 1 + Phase 2 — author
an Object with `create`/`step`/`collision`/`alarm` events end-to-end, and watch
`Collectible` fall out as a special case of the collision event.

---

## Non-goals / deliberate divergences from GM

- **No global mutable state / no arbitrary imperative code.** Event bodies are finite
  action lists over the formula compiler, not free-form GML — this preserves
  determinism, the op-log, and agent-authorability.
- **No immediate-mode `draw` event.** Rendering stays declarative through views;
  visual feedback is expressed as sprites, `derived` fields, and (later) camera/juice
  behaviors, not per-frame draw calls.
- **Not replacing formulas or the ECS runtime.** This is an authoring surface over the
  existing substrate.
- **Not cloning GML syntax.** "GML-lite" is a JSON action DSL, readable by humans and
  agents alike.

---

## Open questions / risks

1. **Step-event cost.** Per-tick handlers over many instances can get hot; prefer
   `derived` formulas for continuous behavior and keep `step` opt-in. Benchmark early.
2. **Collision source.** Unify Rapier contact events with the current proximity check
   (`collect.ts`) behind one `onCollision(other)` surface — decide detection strategy
   in the Phase 2 Spec.
3. **Alarm state tier.** Per-instance timers are runtime state — decide whether they
   live host-authoritative or owner-local, and whether they replicate.
4. **`self`/`other` binding.** Extend the `evaluate.ts` context to bind `self`,
   `other`, and (for `with`) the iterated instance without leaking scope.
5. **Determinism across peers.** Host/owner-run handlers must converge; forbid
   nondeterministic inputs (wall-clock, RNG without a seeded, replicated source).
6. **Event ordering.** Define a stable per-tick order (systems → events, or interleaved
   by priority) so authored logic is predictable.

---

## Why this is the right shape for *this* engine

- **Approachability** (Sakurai's "easy to pick up"): object-localized events are *why*
  GameMaker is teachable — behavior lives next to the thing it governs, not in a global
  system a newcomer can't find.
- **Agent-authorability**: a finite action DSL is far easier for an agent to emit and
  for the op-log to diff than imperative code.
- **Multiplayer as a feature**: per-event authority is something GM users would envy.
- **No sunk cost lost**: formulas, sync tiers, and existing behaviors all survive and
  compose under the new surface.
