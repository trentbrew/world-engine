# Decision: prop collision defaults

**Status:** decided  
**Date:** 2026-07-02

## Decision

**Asset-dock placement continues to spawn visual-only `Prop` entities** (`Transform` + `Render` only). Collision is **opt-in** via the `Physics` component in the inspector.

We are **not** changing `createProp` to attach default Physics on placed models.

## Rationale

| Concern | Opt-in (chosen) | Auto-physics on place |
| --- | --- | --- |
| Editor UX | Placement is layout-first; props interpenetrate freely while arranging | Every dropped model simulates immediately in play — surprising stacks/falls |
| Performance | Artists place many decorative meshes without Rapier cost | Hull colliders on every GLB add sim + load cost |
| Explicit physics worlds | `?game=physics` already defines `PhysBox`, `PhysBarrel`, etc. with typed defaults | Duplicates/conflicts with data-first physics authoring |
| Multiplayer | Durable rules stay lightweight until author opts in | Unintended dynamic bodies sync + simulate on all peers |

Duck/rock-style uploads placed from the asset dock match `entity:prop/crate-b` in the default world: a barrel GLB with `anchor: bottom`, no `Physics`.

## Verification

- E2E: [`e2e/prop-collision.spec.ts`](../../e2e/prop-collision.spec.ts)
  - Default prop has no `Physics`
  - `physics.jsonld` `PhysBox` has `Physics`
  - Adding `Physics` via inspector + play mode runs without console errors

## Manual collision setup (today)

For props that should collide in play mode:

| Role | `Physics.body` | `Physics.collider` | Notes |
| --- | --- | --- | --- |
| Static scenery (rock) | `fixed` | `hull` or `trimesh` | `trimesh` only on fixed bodies |
| Movable prop (duck) | `dynamic` | `hull` | Set `mass` as needed |
| Cheap bounds | either | `box` | Analytic cuboid from mesh bounds |

Simulation runs only in **Play** mode; edit mode forces all Rapier bodies to `fixed`.

## Future wedge (not scheduled)

If product later wants “physics props by default” from the dock:

1. Add `PhysProp` entity type or a placement toggle (`visual` | `physics`)
2. Extend [`createProp`](../../src/lib/engine/runtime/world.svelte.ts) / [`draftFromModel`](../../src/lib/scene/placementSession.ts) with defaults: models → `dynamic` + `hull`, primitives → `dynamic` + `box`
3. Register type in [`registry.ts`](../../src/lib/engine/ontology/registry.ts)
4. Extend e2e to assert play-mode settling behavior

Until that wedge is specced and prioritized, **opt-in Physics remains the contract.**
