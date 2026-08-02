---
version: 1
name: Platform velocity inheritance
parent: TRL-96
issue: TRL-105
impl: TRL-106
status: queue-ready
---

# Spec: Platform Velocity Inheritance

**Parent proposal:** TRL-96  
**Impl:** TRL-106  
**Plan:** [`docs/plans/character-controller.md`](../plans/character-controller.md) Phase 5  
**Depends on:** TRL-98 ground detection, TRL-102 horizontal velocity motor, TRL-104 velocity clipping  
**Reference:** BoundingBox `CharacterControllerBase.cs` parent-helper / platform momentum behavior  
**Out of scope:** Authoring animated platform UI, network reconciliation for moving platforms, vertical elevator carry beyond existing ground-height correction.

---

## Problem

The controller now has grounded state, horizontal velocity, air carry, and collision clipping. It still treats moving ground as static. Standing on a moving platform should move the player with the platform, and jumping or walking off should preserve platform momentum. Landing on a moving platform should convert world velocity back to player-relative velocity so the character does not appear to stop or slide unnaturally.

---

## Architect Decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Rapier access | **Only `GroundSensor.svelte` reads Rapier rigid bodies** | It already owns `useRapier()` and the ground hit; avoids browser module singleton traps from TRL-104 |
| Ground data | Extend `groundStore` with `platformVelocity: [number, number, number]` | Systems can consume sampled velocity without needing Rapier world lookup |
| Handle flow | Keep `platformRigidBodyHandle` and update it with the center ground hit parent handle | Useful for transition identity and future debug UI |
| Velocity space | Player motor velocity remains **relative to supporting platform** while grounded; it becomes **world velocity** when airborne | Matches BoundingBox parent-helper intent |
| Axes | Apply inheritance and platform displacement on XZ in TRL-106 | Existing controller owns vertical motion in `jumpSystem`; moving elevators can be a later wedge |
| System location | New `src/lib/engine/systems/behaviors/platformVelocity.ts` | Keeps platform carry separate from input motor and jump behavior |
| System order | Register after `jumpSystem`, before `collectSystem` / formulas | Jump can cause the grounded→airborne transition; platform carry should run before derived/UI state |
| Wall clipping | Clip platform-applied XZ velocity via existing `clipHorizontalVelocity` before displacement | Reuses TRL-104 collision rules and dynamic-body skip |
| Verification | Deterministic TS smoke, not a wall browser probe | Platform carry depends on ground/Rapier state; pure transition math and mocked collision are more stable |

---

## Ground Bridge Changes

### `groundStore.svelte.ts`

Extend `GroundState`:

```ts
platformVelocity: [number, number, number];
```

Default/reset value:

```ts
platformVelocity: [0, 0, 0]
```

### `GroundSensor.svelte`

For the accepted center ground hit:

1. Read `const parent = hit.collider.parent()`.
2. Write `groundStore.platformRigidBodyHandle = parent?.handle ?? null`.
3. If `parent` exists and is not fixed, sample `parent.linvel()` and write:
   ```ts
   groundStore.platformVelocity = [linvel.x, linvel.y, linvel.z];
   ```
4. If no parent or no grounded hit, reset `platformVelocity` to `[0, 0, 0]`.

Fixed floors should report zero velocity. Dynamic/kinematic platforms should flow their current linear velocity into the store.

---

## Platform Velocity System

Create `src/lib/engine/systems/behaviors/platformVelocity.ts`.

State:

```ts
let wasGrounded = false;
let lastPlatformHandle: number | null = null;
let lastPlatformVelocity: [number, number, number] = [0, 0, 0];
```

Inputs:

- `groundStore.grounded`
- `groundStore.platformRigidBodyHandle`
- `groundStore.platformVelocity`
- local player `Transform`
- local player `Jump.vy`
- horizontal motor test hooks from `playerSystem`: `peekHorizontalVelocity()` and `setHorizontalVelocity()`
- `clipHorizontalVelocity(entity, vx, vz, dt, threshold)`

Derived grounded gate:

```ts
const motorGrounded = groundStore.grounded && (jump?.vy ?? 0) <= 0.01;
```

Algorithm each tick:

1. Resolve local owned `Player`; if missing, update internal previous state to idle and return.
2. Read motor velocity `[vx, vz]` and platform velocity `[pvx, _pvy, pvz]`.
3. **Landing transition** (`!wasGrounded && motorGrounded`):
   - Convert world velocity to platform-relative:
     ```ts
     setHorizontalVelocity(vx - pvx, vz - pvz);
     ```
   - This prevents an apparent stop when landing on a platform moving under the character.
4. **Grounded platform carry** (`motorGrounded && platformHandle !== null`):
   - Clip the platform velocity:
     ```ts
     const [cvx, cvz] = clipHorizontalVelocity(entity, pvx, pvz, dt, threshold);
     ```
   - Apply transform displacement:
     ```ts
     transform.position = [x + cvx * dt, y, z + cvz * dt];
     ```
   - This moves the character with the platform while respecting walls.
5. **Leave transition** (`wasGrounded && !motorGrounded`):
   - Add the last grounded platform velocity to the player's motor velocity:
     ```ts
     setHorizontalVelocity(vx + lastPlatformVelocity[0], vz + lastPlatformVelocity[2]);
     ```
   - Use `lastPlatformVelocity` rather than current store velocity because `GroundSensor` may already have cleared the hit after the player left.
6. Store:
   - `wasGrounded = motorGrounded`
   - `lastPlatformHandle = platformHandle`
   - `lastPlatformVelocity = motorGrounded ? platformVelocity : lastPlatformVelocity`

Reset:

```ts
export function resetPlatformVelocityState(): void
```

Call reset from `stopSimulation()`.

---

## Player System Contract

`playerSystem.ts` already exposes:

- `peekHorizontalVelocity()`
- `setHorizontalVelocity(vx, vz)`

TRL-106 may reuse these. If the implementation needs less test-only naming, it may rename comments from "Test probe" to "System hook" but should not change the function signatures during this wedge.

---

## Frame Pipeline

```
playerSystem             → relative player motor velocity and input movement
jumpSystem               → vertical state; can trigger grounded→airborne
platformVelocitySystem   → platform carry, landing subtraction, leave inheritance
collectSystem
formulaSystem
PhysicsBodySync
GroundSensor             → next-frame ground/platform sample
Rapier simulation
```

Register `platformVelocitySystem` after `jumpSystem`.

---

## Verification

### Deterministic Smoke

Add `scripts/platform-velocity-smoke.ts` and package script:

```json
"test:platform-velocity": "tsx --tsconfig .svelte-kit/tsconfig.json scripts/platform-velocity-smoke.ts"
```

Smoke coverage:

| Test | Assertion |
| ---- | --------- |
| Landing subtraction | Airborne `[vx, vz] = [5, 0]` landing on platform `[2, 0, 0]` stores relative `[3, 0]` |
| Leave inheritance | Grounded relative `[3, 0]` leaving platform `[2, 0, 0]` stores world `[5, 0]` |
| Grounded carry | Grounded platform `[2, 0, 0]` moves transform by `2 * dt` on X |
| Platform clipping | Mocked `clipHorizontalVelocity` / bound collision context clips platform displacement below raw |

Prefer pure helper functions inside `platformVelocity.ts` for the smoke:

```ts
export function subtractPlatformVelocity(...)
export function addPlatformVelocity(...)
export function platformDisplacement(...)
```

The smoke should not depend on browser Playwright or dynamically importing a live Svelte/Rapier scene.

### Manual

Create or reuse a test world with a moving kinematic platform:

1. Stand on a moving platform — player rides horizontally with it.
2. Jump off while platform is moving — player keeps platform XZ momentum.
3. Land on a moving platform while already moving — no abrupt stop/snap.
4. Platform pushes player toward a wall — player does not tunnel.

---

## Files to Create / Modify

| File | Action |
| ---- | ------ |
| `src/lib/engine/player/groundStore.svelte.ts` | Modify — add `platformVelocity` and reset |
| `src/lib/engine/render/GroundSensor.svelte` | Modify — sample parent `linvel()` into `groundStore.platformVelocity` |
| `src/lib/engine/systems/behaviors/platformVelocity.ts` | Create — transition/carry system + pure helpers |
| `src/lib/engine/systems/index.ts` | Modify — register/reset platform velocity system |
| `scripts/platform-velocity-smoke.ts` | Create — deterministic verification |
| `package.json` | Modify — add `test:platform-velocity` |

---

## TRL-106 Acceptance Criteria

1. `groundStore` exposes `platformVelocity` and `GroundSensor` writes platform handle + sampled linear velocity, resetting both when ungrounded.
2. `platformVelocitySystem` is registered after `jumpSystem` and resets on play exit.
3. Landing subtracts platform XZ velocity from motor velocity; leaving adds last platform XZ velocity to motor velocity.
4. Grounded players are displaced by platform XZ velocity each tick, after clipping with existing `clipHorizontalVelocity`.
5. `pnpm run test:platform-velocity` passes deterministic smoke coverage for subtraction, inheritance, carry displacement, and clipping.
6. `pnpm check` remains at project baseline with no new TRL-106 diagnostics.

**Explicitly NOT in TRL-106:** moving-platform authoring UI, networked platform ownership, vertical elevator carry beyond existing ground-height correction.
