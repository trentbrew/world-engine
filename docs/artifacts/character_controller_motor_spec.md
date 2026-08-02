---
version: 1
name: Velocity-based character motor (ground + air + slope)
parent: TRL-96
issue: TRL-101
status: queue-ready
---

# Spec: Velocity-based character motor

**Parent proposal:** TRL-96  
**Impl:** TRL-102  
**Plan:** [`docs/plans/character-controller.md`](../plans/character-controller.md) Phase 3 (reshaped)  
**Reference:** BoundingBox `CharacterControllerBase.cs` — `Movement()` ground lerp + air dot-product steering  
**Out of scope:** `clipVelocity` / Rapier castShape wall clip (TRL-103/104), visual step-lag (TRL-103/104), platform velocity inheritance (TRL-105/106), footstep distance audio (later wedge).

---

## Problem

`playerSystem` today integrates a **scalar** `smoothedSpeed` and steps `Transform.position` each frame. Ground and air share the same motor path, so jumps feel like on-ground movement — no momentum carry, no reduced air steering. User feedback + Sakurai critique: need **horizontal velocity state** with distinct ground vs. air integration.

Vertical motion stays in `jumpSystem` (`Jump.vy`, Y position). This wedge owns **XZ (or X in 2D XY)** only.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Velocity storage | **Module-local** `velocityX`, `velocityZ` in `playerSystem.ts` (reset via `resetPlayerMovementState`) | Matches current `smoothedSpeed` pattern; only owner integrates; remotes receive `Transform` over the wire |
| Motor mode gate | **`motorGrounded = groundStore.grounded && jump.vy <= 0.01`** | Same predicate as jump landing; rising jump arc uses air motor even if foot probe still touches |
| Tier speeds | **Keep** `input.movement()` + `playInputState.config.locomotion` for walk/jog/run targets | Scene-authored feel; `Player.speed` remains scalar multiplier |
| Ground accel source | **`Player.groundAcc`** (default `7`) lerps toward target velocity | Unity parity; scene `locomotion.accel` is separate ramp — **remove** scalar `approachSpeed` path |
| Air steering | **Dot-product method** with `Player.airAcc` (default `2`), `Player.airDrag` (default `1`) | Unity `Movement()` air branch |
| `fallDrag` | **Deferred** — Y owned by `jumpSystem`; do not add `Player.fallDrag` in this wedge | Avoid split ownership of vertical drag |
| Slope projection | **`conformMovement` + `inhibitMovement`** utils applied to **input direction** before motor | Unity `ConformMovementAgainstSlope` / `InhibitMovementAgainstSlope` |
| Normal source | **`groundStore.normal`** via existing `lastGroundNormal` export | Phase 1 dependency — already landed |
| Horizontal collision | **Keep** `resolveHorizontalPlayerMove(entity, dx, dz)` with `dx = velocityX * dt` | Existing Rapier bumper + step-up |
| Velocity clipping | **Not in this wedge** | TRL-103/104 `clipVelocity` |
| 2D worlds | **Same motor** on horizontal play axis (`profile.plane === 'xy'` → integrate `velocityX` only, lock `velocityZ = 0`) | `platformer2d.jsonld` |
| Rotation | **Immediate yaw** toward move direction (unchanged); rotation smoothing is stretch / later | Minimize wedge scope |
| System order | **Unchanged:** `playerSystem` before `jumpSystem` in `systems/index.ts` | XZ then Y per frame |

---

## Prerequisites

- **TRL-98** ground detection landed (`groundStore`, kinematic player capsule, `GroundSensor.svelte`).
- **TRL-100** jump feel landed (`Jump.vy`, coyote, grounded predicate) — impl may still be in review; motor spec does not block on review PASS.

---

## Data model — `Player` component fields

Add to `registerComponent({ name: 'Player', … })` in `spawnPlayer.ts`:

```ts
minSlope: { t: 'number', default: 30 },   // degrees — uphill inhibition starts
maxSlope: { t: 'number', default: 60 },   // degrees — uphill fully blocked
groundAcc: { t: 'number', default: 7 }, // ground velocity lerp factor (1/s style)
airAcc: { t: 'number', default: 2 },    // air steering scalar
airDrag: { t: 'number', default: 1 }    // XZ velocity drag per second in air
```

Existing `speed` field remains the per-entity max-speed multiplier against `input.movement().speed`.

No new realtime-synced velocity fields on the component — horizontal velocity is derived/local.

---

## New util module

**`src/lib/engine/player/playerMovementUtils.ts`** (pure functions, unit-testable):

### `conformMovement(dir, normal)`

Project horizontal move direction onto the ground plane so ramp speed stays constant:

```ts
// dir, normal: [x,y,z] — use y=0 for dir before call in 3D XZ mode
// Returns normalized direction * original horizontal magnitude
```

Algorithm (Unity parity):

```ts
const cross = cross3(dir, normal);
if (lengthSq(cross) < 1e-6) return dir;
return cross3(cross, normal); // then normalize * |dir|
```

### `inhibitMovement(dir, normal, minSlopeDeg, maxSlopeDeg)`

Reduce move magnitude when walking **uphill** beyond `minSlope`:

```ts
const slopeAngle = 90 - angleBetween(-dir, normal); // degrees
const t = clamp01((slopeAngle - minSlope) / (maxSlope - minSlope));
return dir * (1 - t * t);
```

### `integrateGroundVelocity(vx, vz, targetVx, targetVz, groundAcc, dt)`

```ts
vx += (targetVx - vx) * groundAcc * dt;
vz += (targetVz - vz) * groundAcc * dt;
```

### `integrateAirVelocity(vx, vz, moveX, moveZ, moveMag, maxSpeed, airAcc, airDrag, dt)`

Dot-product steering (Unity parity):

```ts
const vDot = moveX * vx + moveZ * vz; // move already unit-scaled by moveMag in caller
const accDif = moveMag * maxSpeed - vDot;
vx -= vx * airDrag * dt;
vz -= vz * airDrag * dt;
vx += moveX * airAcc * accDif * dt;
vz += moveZ * airAcc * accDif * dt;
```

---

## `playerSystem.ts` — normative tick flow

Replace `smoothedSpeed` / `coastDirX` / `coastDirZ` / `approachSpeed` with `velocityX`, `velocityZ`.

Per owned `Player` entity each tick:

1. **Read input** — `move = input.movement()`, `speedScale = player.speed / PLAYER_SPEED_BASELINE`, `maxSpeed = move.speed * speedScale`.
2. **Build wish direction** — `(wishX, wishZ)` from `move.x/move.z` (or `move.x` only in 2D XY). Zero if `move.magnitude <= 0.01`.
3. **Motor gate** — read `jump.vy` from entity `Jump` component; `motorGrounded = groundStore.grounded && jump.vy <= 0.01`.
4. **Slope pass** (3D XZ only, when `motorGrounded` and wish mag > 0):
   - `wish = inhibitMovement(wish, groundStore.normal, player.minSlope, player.maxSlope)`
   - `wish = conformMovement(wish, groundStore.normal)`
5. **Integrate velocity:**
   - **Ground:** `target = wish * maxSpeed`; call `integrateGroundVelocity` toward target.
   - **Air:** call `integrateAirVelocity` with wish components and `move.magnitude`.
6. **Apply displacement** — `dx = velocityX * dt`, `dz = velocityZ * dt`; run `resolveHorizontalPlayerMove`; write `Transform.position` XZ (Y untouched).
7. **Rotation** — existing yaw from wish or velocity direction.
8. **Idle ground snap** — when `motorGrounded` and speed < 0.01, zero `velocityX/Z` to kill micro-jitter.

`resetPlayerMovementState()` zeros `velocityX` and `velocityZ`.

---

## Frame pipeline (unchanged ordering)

```
playerSystem  → XZ velocity integration + collision resolve
jumpSystem    → vy integration + Y clamp to groundStore.height
PhysicsBodySync → Transform → kinematic body
GroundSensor  → groundStore update (next frame)
```

---

## Tunable defaults (parity targets)

| Param | Default | Unity ref | Notes |
| ----- | ------- | --------- | ----- |
| `groundAcc` | 7 | 7 | Higher = snappier ground |
| `airAcc` | 2 | 2 | ~29% of ground — commit to jump arc |
| `airDrag` | 1 | 1 | Bleeds horizontal speed in air |
| `minSlope` | 30° | — | Uphill inhibition start |
| `maxSlope` | 60° | — | Matches ground sensor max walk slope |

**Feel target:** air steering noticeably weaker than ground; releasing input in air preserves momentum longer than ground stop.

---

## Verification

### Manual (play mode, `?game=platformer2d` or default 3D world)

1. **Ground accel** — tap WASD; player ramps up smoothly, not instant teleport.
2. **Ground decel** — release; player coasts briefly then stops (velocity hits zero).
3. **Air momentum** — jump forward, release input mid-arc; horizontal speed carries.
4. **Air steer** — jump, hold opposite direction; heading changes slowly vs. on ground.
5. **Ramp** — walk up authored slope; speed roughly constant on conform path.

### Automated

**`e2e/movement-motor.spec.ts`** (new) — `worldProbe` pattern like `jump-feel.spec.ts`:

| Test | Assertion |
| ---- | --------- |
| Ground ramp-up | After N frames holding input, horizontal displacement > instant-speed baseline |
| Air carry | Jump, release input for M frames; `|Δx|` greater than ground release case |
| Air vs ground steer | Same input duration in air vs ground yields lower velocity change in air |

Run: `PW_COLD=1 pnpm test:e2e e2e/movement-motor.spec.ts`

---

## Files to create / modify

| File | Action |
| ---- | ------ |
| `src/lib/engine/player/playerMovementUtils.ts` | **Create** — conform, inhibit, ground/air integrators |
| `src/lib/engine/player/playerSystem.ts` | **Modify** — velocity motor; remove scalar smoothedSpeed path |
| `src/lib/engine/player/spawnPlayer.ts` | **Modify** — Player schema fields |
| `e2e/movement-motor.spec.ts` | **Create** — deterministic motor probes |

**Do not modify:** `jump.ts` (except reading `jump.vy`), `GroundSensor.svelte`, `PhysicsBodySync.svelte`.

---

## TRL-102 acceptance criteria (impl inherits)

1. `Player` schema exposes `minSlope`, `maxSlope`, `groundAcc`, `airAcc`, `airDrag` with defaults above.
2. `playerMovementUtils.ts` exports `conformMovement`, `inhibitMovement`, `integrateGroundVelocity`, `integrateAirVelocity`.
3. `playerSystem` uses horizontal velocity state; ground and air motors branch on `motorGrounded`; scalar `smoothedSpeed` removed.
4. 3D XZ slope conform/inhibit runs when grounded with input; 2D XY uses X-only motor.
5. `resetPlayerMovementState` clears velocity; play enter/exit does not leak state.
6. `pnpm check` passes (project baseline).
7. `e2e/movement-motor.spec.ts` — ground ramp, air carry, air-vs-ground steer tests pass.

**Explicitly NOT in TRL-102:** `clipVelocity`, visual step-lag, platform velocity, `fallDrag`, rotation lerp, footstep distance SFX.
