# Spec: Play-mode entity-set leak fix (TRL-111)

**Parent:** TRL-110 (edit/play state decoupling) — this is wedge 1 of 3.
**Fixes:** coins collected in play stay missing in edit, locally and for peers.

## Root cause

`world.snapshotPlayState()` snapshots only the **component bags** of entities that
exist at play-enter. `collectSystem` removes collected entities from
`world.entities` via `session.despawnEntity`, which also broadcasts an
unconditional `despawn` to every peer. `restorePlayState()` iterates the
*surviving* entities, so a despawned coin is unrecoverable — and a peer sitting
in edit mode applies the despawn to their authored world immediately.
`score` additionally has a `reset()` with zero callers, so it accumulates across
play sessions.

## Changes

### 1. Full-entity play snapshot (`world.svelte.ts`)

- `snapshotPlayState()` stores `Map<id, { entity, components }>` — a live
  reference to the entity object plus a `$state.snapshot` of its components.
  Holding the object reference (not a clone) preserves non-cloneable state
  (compiled formulas) for resurrection.
- `restorePlayState()`:
  - surviving entities: restore component bags (unchanged behavior);
  - snapshot entries missing from the world: re-insert the retained entity
    object with restored components — **except `entity:player/*` ids** (peers
    may legitimately leave during play; resurrecting their avatars would leak
    ghosts the other way).

### 2. Runtime-scoped despawn (`transport.ts`, `session.svelte.ts`)

- Despawn message gains an optional flag:
  `{ t: 'despawn'; id; entityId; runtime?: true }`.
- New `session.despawnRuntime(id)`: local `world.despawn` + broadcast with
  `runtime: true`. Does not touch `owners` and does not raise peer-edit toasts —
  it is gameplay, not authoring.
- Receive path: a `runtime` despawn is applied only when the local simulation
  is running (`scheduler.running` — engine-level signal, keeps `engine/net`
  free of UI imports). Editors ignore it; players apply it, and their own
  snapshot restores the entity when they exit.

### 3. Consumers

- `collectSystem` → `session.despawnRuntime(entity.id)`.
- `ui.enterPlay()` → `score.reset()` (fresh run per session).
- Edit-authored despawns (inspector delete, prop removal) keep using
  `despawnEntity` — those *should* mutate the authored world and replicate
  unconditionally.

## Known interim inconsistency (resolved by wedge 2, match-as-object)

A peer in edit ignores a runtime despawn, so when they later enter play the
coin exists for them while remaining collected for players already in the
match. Divergent per-player match state is acceptable until the shared match
overlay lands; the boundary this wedge enforces is *authored world ⊄ play
mutations*, not match consistency.

## Verification

- New e2e `e2e/play-edit-boundary.spec.ts`: enter collect game in play mode,
  steer into a coin (live entity count drops), Escape to edit, assert the full
  coin set is back.
- Full suite + svelte-check (no new errors vs the 9 pre-existing).
