---
version: 1
name: Physics via Rapier (Physics component)
parent: TRL-55
status: queue-ready
---

# Spec: Physics via Rapier (Physics component)

**Parent proposal:** TRL-55  
**Reference:** [@threlte/rapier Getting Started](https://threlte.xyz/docs/reference/rapier/getting-started/)  
**Out of scope (v1):** Joints, triggers/contact events, `Debug` overlay toggle, durable physics authoring sync, folding `Gravity` into `Physics`, player character controller, cross-tab deterministic lockstep

> **Note:** `docs/artifacts/asset_placement_spec.md` previously referenced TRL-55 for placement — graph TRL-55 is **physics**. Placement wedge will get a new issue when queued.

---

## Summary

Add a **`Physics`** ontology component backed by [**@threlte/rapier**](https://threlte.xyz/docs/reference/rapier/getting-started/) + `@dimforge/rapier3d-compat`. Authors opt entities in via JSON-LD; the right-panel inspector auto-renders fields (with `inspectorFieldHelp`). Simulation runs **only in play mode**; **entity owners** integrate and stream `Transform.position` / `Transform.rotation` as existing **realtime** fields.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Sim backend | **@threlte/rapier** `<World>` in `WorldScene.svelte` | Already on Threlte 8; official bridge to Rapier |
| Component shape | **`Physics` component** in ontology (not ad-hoc Svelte props) | Matches AGENTS.md data-first model |
| Opt-in | Entity has `Physics` bag; **`body: 'none'`** = no rigid body (inspector None/On pattern optional — prefer omit component or `body: 'fixed' \| 'dynamic' \| 'kinematic'`) | Clear authoring |
| `body` values | `fixed` \| `dynamic` \| `kinematic` (default **`dynamic`**) | Rapier rigid-body types; no separate enable flag |
| `collider` values | `box` \| `ball` \| `capsule` \| `hull` \| `trimesh` (default **`box`**) | Maps to Rapier collider shapes; `ball` for `primitive:sphere`, `capsule` for `primitive:capsule` |
| Numeric fields | `mass` (default `1`), `restitution` (`0.2`), `friction` (`0.8`), `gravityScale` (`1`) | Standard material props; `gravityScale` → Rapier gravity scale |
| Coexist with `Gravity` | **`Gravity` system skips** entities that have `Physics` | Avoid double integration |
| Edit vs play | **Edit:** rigid bodies **fixed** at authored transform (no stepping). **Play:** types honored; world steps | Matches `startSimulation` / `stopSimulation` seam |
| Ground collision | **Fixed cuboid collider** at scene floor (`y = 0`, large XZ) inside Rapier `<World>` when sim active | Backdrop shadow plane is visual-only today |
| `Ground` entities | **Defer** rigid bodies on `Ground` component v1 | Floor cuboid sufficient for crate demo |
| Transform authority | **Owner:** Rapier → `Transform` each physics tick. **Peer:** apply network patches; **no** local integration | Same as `gravitySystem` / `playerSystem` |
| Bridge location | New **`PhysicsBody.svelte`** wraps entity subtree in `Thing.svelte` when `Physics` present | Keeps `MeshView` rendering-only |
| Rotation sync | Write **quaternion** to `Transform.rotation` when physics rotates body (v1: crates may tumble) | `Transform.rotation` already `realtime` |
| Player entities | **No `Physics` on `Player` type** v1 — keep kinematic `playerSystem` | Character controller is follow-up |
| Inspector enums | Extend `ComponentFieldInput.enumOptions()` for `Physics.body` and `Physics.collider` | Same pattern as `Light.kind` |
| Help text | Add `Physics.*` keys to `inspectorFieldHelp.ts` | Matches recent inspector UX |
| Sliders | `inspectorBounds.ts` entries for mass, restitution, friction, gravityScale | Reuse slider+number pattern |
| Demo world | Update `static/games/playground.jsonld`: `Crate` type adds `Physics`; **remove `Gravity`** from crate instances | Prove stacking/collision |
| Package install | `pnpm add @threlte/rapier @dimforge/rapier3d-compat` | Per Threlte docs |

---

## Dependencies

```bash
pnpm add @threlte/rapier @dimforge/rapier3d-compat
```

Peer: `@threlte/core` (already installed).

---

## Data model

### `Physics` component schema

Register in `src/lib/engine/systems/behaviors/physics.ts` (side-effect import from `systems/index.ts` for registration only — **no** tick system):

```ts
registerComponent({
  name: 'Physics',
  fields: {
    body: { t: 'string', default: 'dynamic' },       // fixed | dynamic | kinematic
    collider: { t: 'string', default: 'box' },       // box | ball | capsule | hull | trimesh
    mass: { t: 'number', default: 1 },
    restitution: { t: 'number', default: 0.2 },
    friction: { t: 'number', default: 0.8 },
    gravityScale: { t: 'number', default: 1 }
  }
});
```

All fields **durable** except none need realtime on Physics itself — motion lives on `Transform`.

### Example entity (playground crate)

```jsonc
"components": {
  "Transform": { "position": { "x": -2, "y": 6, "z": -1 } },
  "Render": { "color": "#ff6b6b" },
  "Physics": { "body": "dynamic", "collider": "box", "mass": 1 }
}
```

### Type default

```jsonc
{ "@id": "type:Crate", "components": ["Transform", "Render", "Physics", "Status"],
  "defaults": { "Physics": { "body": "dynamic", "collider": "box" } } }
```

---

## Render / simulation bridge

### File layout

| File | Role |
| ---- | ---- |
| `src/lib/scene/PhysicsWorld.svelte` | `<World>` wrapper; floor collider; children slot |
| `src/lib/engine/render/PhysicsBody.svelte` | Per-entity `<RigidBody>` + `<Collider>`; sync hooks |
| `src/lib/engine/render/Thing.svelte` | Wrap children in `PhysicsBody` when `entity.components.Physics` |
| `src/lib/scene/WorldScene.svelte` | Nest simulatable content under `PhysicsWorld` when `ui.shellMode === 'play'` **or** always mount World with `gravity` paused in edit (pick simpler: **mount World always, `gravity={0}` in edit, normal gravity in play**) |

### `PhysicsBody.svelte` (normative behavior)

1. Read `Physics` + `Transform` from entity.
2. Map `body` → Rapier `type` (`fixed` / `dynamic` / `kinematic`).
3. Map `collider` + `Render.mesh` → collider shape:
   - `primitive:sphere` + default → `ball`
   - `primitive:capsule` → `capsule`
   - glTF → `hull` if `collider` is `hull`, else `trimesh` when `trimesh` selected, else `box` fallback
4. **Edit mode:** force `fixed` regardless of authored `body`.
5. **Owner + play:** `usePhysicsTask` (or post-step callback) copy rigid-body translation/rotation → `world.setField` or direct `Transform` mutation with new array identity (same as `gravitySystem`).
6. **Non-owner:** set rigid-body pose from `Transform` each frame (network apply); do not write back.

### `gravitySystem` guard

```ts
if (entity.components.Physics) continue;
```

---

## Play mode lifecycle

| Event | Physics behavior |
| ----- | ---------------- |
| `ui.enterPlay()` | `startSimulation()` — Rapier world steps |
| `ui.exitPlay()` | `stopSimulation()` — destroy/recreate bodies or reset to authored transforms via `world.restorePlayState()` |
| Entity spawn/despawn | `PhysicsBody` mounts/unmounts with `Thing` |

Ensure `exitPlay` restores crate positions (existing snapshot) — no drift after stop.

---

## Inspector

| Field | Control | Help key |
| ----- | ------- | -------- |
| `body` | select | `Physics.body` |
| `collider` | select | `Physics.collider` |
| `mass` | slider 0.1–50 | `Physics.mass` |
| `restitution` | slider 0–1 | `Physics.restitution` |
| `friction` | slider 0–2 | `Physics.friction` |
| `gravityScale` | slider 0–3 | `Physics.gravityScale` |

`ComponentFieldInput.enumOptions()`:

```ts
if (component === 'Physics' && field === 'body')
  return ['fixed', 'dynamic', 'kinematic'].map(...)
if (component === 'Physics' && field === 'collider')
  return ['box', 'ball', 'capsule', 'hull', 'trimesh'].map(...)
```

---

## Multiplayer (v1)

- No change to transport protocol — `Transform.position` / `rotation` already realtime.
- Host-owned props: host integrates Physics; tabs apply patches.
- Client-owned player: unchanged (no Physics on Player).

Manual test: two tabs, `?game=playground`, play mode — crates fall and stack; peer sees motion.

---

## Phase plan (executor may ship as one PR if AC green)

| Phase | Deliverable |
| ----- | ----------- |
| **1** | Schema + registry + inspector enums/bounds/help |
| **2** | `PhysicsWorld` + `PhysicsBody` + playground demo |
| **3** | Owner sync + `gravitySystem` guard + exitPlay restore verify |

---

## Acceptance criteria

1. `pnpm add @threlte/rapier @dimforge/rapier3d-compat` — lockfile updated; `pnpm check` passes.
2. `Physics` component registered; fields appear in right inspector for entities with component bag.
3. `?game=playground` + Play: crates with `Physics` fall, collide with floor, **stack** (not pass through each other).
4. Edit mode: crates stay at authored poses; orbit/pick unchanged.
5. Stop play: transforms restore to pre-play snapshot (existing play snapshot behavior).
6. Entity with `Gravity` only (no `Physics`) still falls via `gravitySystem`.
7. Entity with `Physics` does **not** double-integrate via `gravitySystem`.
8. `inspectorFieldHelp` entries for all `Physics.*` fields.
9. Document in `AGENTS.md` built-in components table (one row for `Physics`).

---

## Test plan

```bash
pnpm check
# Manual:
# 1. ?game=playground → Play → crates drop/stack
# 2. Stop → positions restored
# 3. Select crate → edit Physics mass/restitution → Play → behavior changes
# 4. Two tabs play mode → peer sees crate motion (best-effort)
```

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Rapier API churn | All Rapier imports in `PhysicsBody` / `PhysicsWorld` only |
| glTF collider cost | Default `box`; `hull`/`trimesh` opt-in |
| Single World limit | Document; one viewport OK |
| Rotation sync bandwidth | Acceptable v1 for small prop count |
