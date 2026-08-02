# Character Controller System — Implementation Plan
**Issues:** TRL-96 → TRL-106 | **Source:** BoundingBoxSoftware/CharacterController analysis

---

## Issue graph

| Issue | Type | Phase | Parent | Blocked by |
|-------|------|-------|--------|------------|
| TRL-96 | Proposal | — | — | — |
| TRL-97 | Spec | 1 — Ground detection | TRL-96 | — |
| TRL-98 | Impl | 1 — Ground detection | TRL-97 | TRL-97 |
| TRL-99 | Spec | 2 — Jump feel | TRL-96 | — |
| TRL-100 | Impl | 2 — Jump feel | TRL-99 | TRL-99 |
| TRL-101 | Spec | 3 — Velocity motor (ground + air + slope) | TRL-96 | — |
| TRL-102 | Impl | 3 — Velocity motor (ground + air + slope) | TRL-101 | TRL-101 |
| TRL-103 | Spec | 4 — Visual step-lag + velocity clip | TRL-96 | — |
| TRL-104 | Impl | 4 — Visual step-lag + velocity clip | TRL-103 | TRL-103 |
| TRL-105 | Spec | 5 — Platform velocity | TRL-96 | — |
| TRL-106 | Impl | 5 — Platform velocity | TRL-105 | TRL-105, TRL-98 |

**Critical path:** TRL-97 → TRL-98 unblocks everything (groundStore). Phases 2–5 can proceed in order after Phase 1; Phase 5 also requires `platformRigidBodyHandle` from Phase 1.

**Architecture note (Phase 1):** Ground detection is a **Svelte/Rapier bridge** (`GroundSensor.svelte` + `groundStore.svelte.ts`), not a tick-system `ground.ts` behavior. The player must get a kinematic `Physics` body in `spawnPlayer.ts` before shape casts can run.

---

## Context

The engine's current player movement is a toy: `playerSystem` updates XZ position from input with no slope awareness, and `jumpSystem` determines "grounded" by checking `transform.position[1] <= jump.rest + 0.02` — a hardcoded constant (default 0.5). There is no ground normal estimation, no coyote time, no slope projection, no platform velocity inheritance.

The BoundingBox analysis produced a prioritized roadmap of six upgrades. This plan covers how to implement them given the engine's actual architecture (ECS-style TS systems + Svelte render components + `@threlte/rapier`).

---

## Critical Architectural Realization

The player entity currently has **no Physics component** — `spawnPlayer.ts` only attaches `Transform`, `Render`, and `Player` components. The player floats at `jump.rest = 0.5` because `jumpSystem` manually integrates gravity and clamps Y at that constant. `PhysicsBodySync.svelte` is **not** involved for the player.

This means:
- There is no collision between the player and world geometry today.
- Ground detection via Rapier shape casts requires the player to have a Rapier body.
- **Phase 1 must add a kinematic Rapier body to the player** before any ground cast can work.

---

## Phase 1 — Ground Detection (TRL-97 / TRL-98)

**Spec:** [`docs/artifacts/character_controller_ground_spec.md`](../artifacts/character_controller_ground_spec.md)

### What changes

**`src/lib/engine/player/spawnPlayer.ts`**
- Add `Physics: { body: 'kinematic-position', collider: 'capsule', mass: 70 }` to the entity built by `buildPlayer()`.
- This makes `PhysicsBody.svelte` mount a `KinematicPositionBased` Rapier capsule for each player.

**`src/lib/engine/render/GroundSensor.svelte`** *(new file)*
- A Svelte component that mounts inside the player's `PhysicsBody` slot.
- Uses `useRapier()` and `useTask()` (before render) from `@threlte/rapier`.
- Casts a Rapier `castShape` (small sphere) straight down from the player's current capsule-bottom position.
- Writes results to a reactive singleton `groundStore`:
  ```ts
  // src/lib/engine/player/groundStore.svelte.ts
  export const groundStore = $state({
    grounded: false,
    normal: [0, 1, 0] as [number, number, number],
    height: 0,
    platformRigidBodyHandle: null as number | null,
  });
  ```
- Shape-cast parameters: 13-point radial grid (outer ring × 8, inner ring × 4, center × 1), max slope filter (skip hits where angle > maxSlope).

**`src/lib/engine/systems/behaviors/jump.ts`**
- Replace `transform.position[1] <= jump.rest + 0.02` with `groundStore.grounded`.
- Remove the `rest` field from the Jump component (no longer a magic constant).
- Keep the manual gravity integration and Transform mutation — the kinematic body follows Transform via PhysicsBodySync's non-owner path (entity.Transform → rigidBody before sim).

**`src/lib/engine/player/playerSystem.ts`**
- Pass `groundStore.normal` through as context so Phase 2 slope work can use it.

### Frame pipeline after Phase 1
```
1. playerSystem / jumpSystem mutate entity.Transform
2. PhysicsBodySync (non-owner task): entity.Transform → kinematic rigidBody
3. GroundSensor task: shape cast → groundStore
4. Rapier simulation (kinematic bodies follow set position, collision response via contact)
5. PhysicsBodySync (owner task): rigidBody → entity.Transform (reconcile any correction)
6. Render
```

---

## Phase 2 — Jump Feel (TRL-99 / TRL-100)

All changes in **`src/lib/engine/systems/behaviors/jump.ts`**.

### New Jump component fields
```ts
coyoteMs: { t: 'number', default: 100 }       // window after leaving ledge
holdCurve: { t: 'boolean', default: false }     // enable hold-to-jump mode
jumpTime: { t: 'number', default: 500 }         // hold curve duration (ms)
curveForce: { t: 'number', default: 8 }         // sustained force magnitude
canDoubleJump: { t: 'boolean', default: false }  // double jump enabled
airTimeLand: { t: 'number', default: 300 }       // airtime (ms) → land sfx
airTimeStep: { t: 'number', default: 100 }       // airtime (ms) → step sfx
```

### Logic changes
- **Coyote time:** track `airTimeMs`; only mark `grounded = false` after `coyoteMs` of `groundStore.grounded === false`.
- **Hold-to-jump:** if `holdCurve` is true and jump is held, apply `curveForce * sin(π * t/jumpTime)` force each frame for `jumpTime` ms instead of instant impulse.
- **Double jump:** `canDoubleJump` flag resets on ground; consumed on second jump in air.
- **Land audio:** use `airTimeMs` at landing — no sfx below `airTimeStep` threshold, step sfx between thresholds, land sfx above `airTimeLand`.

---

## Phase 3 — Velocity Motor + Slope + Air Control (TRL-101 / TRL-102)

**Spec:** [`docs/artifacts/character_controller_motor_spec.md`](../artifacts/character_controller_motor_spec.md)

Horizontal **velocity state** (`velocityX`, `velocityZ`) replaces scalar `smoothedSpeed`. Ground motor lerps toward wish velocity (`groundAcc`); air motor uses dot-product steering (`airAcc`, `airDrag`). Slope conform/inhibit on input direction when grounded. Vertical motion unchanged in `jumpSystem`.

### New Player component fields
```ts
minSlope: { t: 'number', default: 30 }
maxSlope: { t: 'number', default: 60 }
groundAcc: { t: 'number', default: 7 }
airAcc: { t: 'number', default: 2 }
airDrag: { t: 'number', default: 1 }
```

### New util module — `playerMovementUtils.ts`
`conformMovement`, `inhibitMovement`, `integrateGroundVelocity`, `integrateAirVelocity`

### Deferred to Phase 4
`clipVelocity` (Rapier castShape), visual step-lag — not part of TRL-102.

---

## Phase 4 — Visual Step-Lag + Velocity Clipping (TRL-103 / TRL-104)

**Spec:** [`docs/artifacts/character_controller_clip_visual_spec.md`](../artifacts/character_controller_clip_visual_spec.md)

**`playerCollision.ts`** — `clipHorizontalVelocity`: 3-height `castShape` along velocity; skip dynamic hits; integrate in `playerSystem` before displacement.

**`PlayerVisualStepLag.svelte`** — grounded step-up pulls inner visual group down; `visualsLerpFactor` decays offset each frame; clamp `maxVisualsOffset`.

---

## Phase 5 — Platform Velocity Inheritance (TRL-105 / TRL-106)

**Spec:** [`docs/artifacts/platform_velocity_spec.md`](../artifacts/platform_velocity_spec.md)

**`src/lib/engine/systems/behaviors/platformVelocity.ts`** *(new file)*
- `GroundSensor.svelte` remains the Rapier bridge: it writes `platformRigidBodyHandle` and sampled `platformVelocity` to `groundStore`.
- `platformVelocitySystem` reads `groundStore.platformVelocity` without needing direct Rapier world access.
- When `groundStore.grounded` transitions false→true (landing): subtract platform XZ velocity from player velocity (prevent sudden stop).
- When `groundStore.grounded` transitions true→false (leaving): add `worldVelocity` to player velocity (carry platform momentum).
- Before applying platform movement to player position: sphere-cast clip it against world geometry (prevent wall tunneling from fast platforms).

Requires **`GroundSensor.svelte`** to populate `groundStore.platformRigidBodyHandle` from the shape-cast hit (Phase 1 dependency).

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/lib/engine/player/groundStore.svelte.ts` | **Create** — reactive ground state singleton |
| `src/lib/engine/render/GroundSensor.svelte` | **Create** — Rapier shape-cast bridge component |
| `src/lib/engine/systems/behaviors/platformVelocity.ts` | **Create** — platform velocity behavior |
| `src/lib/engine/player/spawnPlayer.ts` | **Modify** — add Physics: kinematic-position to player entity |
| `src/lib/engine/systems/behaviors/jump.ts` | **Modify** — use groundStore, add coyote/curve/double jump/audio |
| `src/lib/engine/player/playerSystem.ts` | **Modify** — slope conformance, inhibition, air control, clipVelocity |
| `src/lib/engine/render/PhysicsBodySync.svelte` | **Modify** — visual step-lag offset + lerp |

---

## Sequencing (one phase at a time)

```
Phase 1 first — everything else depends on groundStore.grounded
  → spawnPlayer (add Physics) 
  → groundStore.svelte.ts 
  → GroundSensor.svelte 
  → jump.ts (swap rest check)

Phase 2 (jump feel) — no new deps, just jumpSystem additions

Phase 3 (slope + air control) — reads groundStore.normal from Phase 1

Phase 4 (visual step-lag) — reads PhysicsBodySync internals, independent of P2/P3

Phase 5 (platform velocity) — requires groundStore.platformRigidBodyHandle from Phase 1
```

---

## Verification

After each phase:
1. `pnpm check` — no type errors
2. Spawn a player in the engine, enter play mode, walk around:
   - **Phase 1:** Player lands on ground plane (no falling through), `groundStore.grounded` toggles in console
   - **Phase 2:** Walk off ledge, jump fires within coyote window; hold jump → higher arc; double jump works
   - **Phase 3:** Walk up/down a ramp — speed constant; steer in air with momentum feel
   - **Phase 4:** Step up a low ledge — no visual pop
   - **Phase 5:** Stand on a moving platform, jump off — player carries the platform's velocity
