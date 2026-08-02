---
version: 1
name: Velocity clipping + visual step-lag
parent: TRL-96
issue: TRL-103
status: queue-ready
---

# Spec: Velocity clipping + visual step-lag

**Parent proposal:** TRL-96  
**Impl:** TRL-104  
**Plan:** [`docs/plans/character-controller.md`](../plans/character-controller.md) Phase 4  
**Depends on:** TRL-102 (horizontal velocity motor), TRL-98 (`bindPlayerCollisionContext` via `GroundSensor`)  
**Reference:** BoundingBox `CharacterControllerBase.cs` — `ClipVelocity()`, ground step `visualsOffsetThreshold` / `FixVisualPosition()`  
**Out of scope:** Platform velocity (TRL-105/106), footstep audio, pushable dynamic props force application.

---

## Problem

After TRL-102, the player has horizontal velocity but can still **tunnel corners** at high speed or large `dt`, and **visual mesh pops** when the kinematic capsule steps up a ledge (collision resolves Y before the eye catches up). Unity solves this with multi-height sphere casts along velocity (`ClipVelocity`) and a **decoupled visual child** that lags Y back down after step-ups.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Velocity clip location | **`playerCollision.ts`** — `clipHorizontalVelocity(vx, vz, entity, dt)` | Reuses `bindPlayerCollisionContext` already set by `GroundSensor` on local player |
| Sample heights | **3 casts** at capsule lower / middle / upper Y (same layout as Unity `verticalSamplePoints`) | Closest hit wins; scale velocity magnitude |
| Clip skip threshold | **`velocityClipThreshold` default `0.1`** — skip when `\|v\| * dt` below | Unity parity |
| Dynamic body filter | **Skip hits** whose parent rigid body is **dynamic** (non-kinematic) | Player can push objects; don't clip against them |
| Clip integration | **`playerSystem`** after motor integrate, **before** `dx = v * dt` | Clips velocity, not position |
| Visual lag scope | **Local owned `Player` only** | Remotes don't run local ground sense; no offset sync needed |
| Visual lag detection | **`PlayerVisualStepLag.svelte`** — compare `Transform.position.y` frame-to-frame when `groundStore.grounded && jump.vy <= 0.01` | Matches step-up while grounded, not jump arc |
| Step vs jump gate | Apply offset only when `0 < deltaY <= maxStepVisual` (default **0.5** = capsule step band) | Large jump deltas skip visual pull |
| Visual target | Inner **`<T.Group bind:ref={visualRoot}>`** wrapping `{@render children()}` in player `PhysicsBody` play branch | Offset `visualRoot.position.y` locally |
| Lerp | Each frame: `offsetY -= offsetY * visualsLerpFactor * dt` (Unity `FixVisualPosition`) | Exponential decay toward 0 |
| Tunables storage | **`Player` component fields** (durable defaults) | Data-first; matches TRL-102 motor fields |
| 2D XY worlds | **Velocity clip on X only** (Z locked); **visual lag on Y** unchanged | Same play plane rules as motor |
| Velocity clip automated test | **Deterministic TS smoke test, not Playwright browser probe** | Browser probes dynamically import modules and can miss the `GroundSensor`-bound collision singleton; clip math is better verified with a mocked Rapier world |

---

## Prerequisites

- `GroundSensor.svelte` binds `bindPlayerCollisionContext` while local player plays.
- `playerSystem` uses module-local `velocityX` / `velocityZ` (TRL-102).
- Player capsule collider resolvable via `resolveCollider(render.mesh, 'capsule', scale)`.

---

## Data model — `Player` component fields

Add to `registerComponent({ name: 'Player', … })`:

```ts
velocityClipThreshold: { t: 'number', default: 0.1 },
visualsOffsetThreshold: { t: 'number', default: 0.1 },
visualsLerpFactor: { t: 'number', default: 20 },
maxVisualsOffset: { t: 'number', default: 0.5 },
maxStepVisual: { t: 'number', default: 0.5 }
```

---

## `clipHorizontalVelocity` — `playerCollision.ts`

```ts
export function clipHorizontalVelocity(
  entity: Entity,
  vx: number,
  vz: number,
  dt: number,
  threshold: number
): [number, number]
```

Algorithm:

1. If `!collisionContext` or `hypot(vx,vz) * dt < threshold` → return `[vx, vz]`.
2. Resolve capsule `halfHeight`, `radius` (same as bumper).
3. For each sample Y offset `[radius, halfHeight, halfHeight + radius]` above foot base:
   - Origin = capsule center XZ at sample Y.
   - Direction = normalized `(vx, 0, vz)`.
   - `castShape` with **ball** radius = `radius * 0.9`, distance = `|v| * dt + COLLISION_SKIN`.
   - Track **closest** `time_of_impact` among walkable/non-dynamic hits.
4. If closest hit at distance `d < travel`: scale velocity by `(d - COLLISION_SKIN) / travel`.
5. Return clipped `[vx, vz]`.

**Dynamic skip:** if hit collider's rigid body exists and `bodyType() === 'Dynamic'` → ignore hit.

Reuse constants: `COLLISION_SKIN`, `IDENTITY_ROT` from existing file.

---

## `playerSystem.ts` integration

After motor integrate (ground/air), before idle snap:

```ts
const clipThreshold = numberOr(player.velocityClipThreshold, 0.1);
[velocityX, velocityZ] = clipHorizontalVelocity(
  entity, velocityX, velocityZ, ctx.dt, clipThreshold
);
```

2D profile: clip X velocity only (pass `vz=0`, ignore Z clip result).

---

## `PlayerVisualStepLag.svelte` — new component

Mount in `PhysicsBody.svelte` **only when** `isLocalPlayer && playing && rigidBody`, sibling to `GroundSensor`.

Props: `entity`, `visualRoot: Group` (ref to inner mesh group).

Each `useTask` (after simulation / same phase as render):

1. Read `transform.position[1]`, `jump.vy`, `groundStore.grounded`.
2. `deltaY = y - prevY` (store `prevY` module-local or `$state`).
3. If `motorGrounded && deltaY > visualsOffsetThreshold && deltaY <= maxStepVisual`:
   - `visualOffsetY -= deltaY` (pull mesh down in local space).
   - Clamp: `visualOffsetY = max(visualOffsetY, -maxVisualsOffset)`.
4. Lerp: `visualOffsetY -= visualOffsetY * visualsLerpFactor * dt`.
5. `visualRoot.position.y = visualOffsetY`.
6. `prevY = y`.

Reset `visualOffsetY` and `prevY` on play exit (export `resetPlayerVisualLag()` called from `stopSimulation` or component destroy).

**PhysicsBody change:** wrap play-mode `{@render children()}` in `<T.Group bind:this={visualRoot}>` when local player; pass ref to `PlayerVisualStepLag`.

---

## Frame pipeline (additions)

```
playerSystem → clipHorizontalVelocity → Transform XZ
jumpSystem   → Transform Y
PlayerVisualStepLag → visual mesh local Y offset (render only)
PhysicsBodySync → kinematic body follows Transform
```

---

## Verification

### Manual

1. Sprint into concave corner — no tunneling through wall mesh.
2. Walk up low ledge — capsule rises but mesh eases up (no single-frame pop).
3. Jump — visual lag does **not** yank mesh down (deltaY > maxStepVisual).

### Automated

**Velocity clip deterministic smoke** (new script, no browser):

Add `scripts/player-clip-smoke.ts` and a package script such as:

```json
"test:player-clip": "tsx --tsconfig .svelte-kit/tsconfig.json scripts/player-clip-smoke.ts"
```

The smoke should import `bindPlayerCollisionContext` / `clipHorizontalVelocity`, bind a mocked Rapier context, and assert:

| Test | Assertion |
| ---- | --------- |
| Threshold no-op | `speed * dt < velocityClipThreshold` returns raw `[vx, vz]` |
| Static wall clip | 3 height samples are cast and closest static hit scales velocity below raw speed |
| Dynamic skip | Dynamic rigid-body hit is ignored and raw velocity is returned |

**Visual step-lag browser e2e** (`e2e/movement-clip-visual.spec.ts`):

Keep the browser e2e for the visual/render-facing behavior only:

| Test | Assertion |
| ---- | --------- |
| Visual offset applies on grounded step-up | Probe: bump `transform.y` while grounded, read visual lag offset `< 0` after lag step |

Run:

```bash
pnpm run test:player-clip
PW_COLD=1 pnpm test:e2e e2e/movement-clip-visual.spec.ts
```

---

## Files to create / modify

| File | Action |
| ---- | ------ |
| `src/lib/engine/player/playerCollision.ts` | **Modify** — `clipHorizontalVelocity` |
| `src/lib/engine/player/playerSystem.ts` | **Modify** — call clip before displacement |
| `src/lib/engine/player/spawnPlayer.ts` | **Modify** — Player schema fields |
| `src/lib/engine/render/PlayerVisualStepLag.svelte` | **Create** |
| `src/lib/engine/render/PhysicsBody.svelte` | **Modify** — visual inner group + mount lag |
| `src/lib/engine/systems/index.ts` | **Modify** — reset visual lag on `stopSimulation` |
| `scripts/player-clip-smoke.ts` | **Create** — deterministic velocity-clip verification |
| `package.json` | **Modify** — add `test:player-clip` script |
| `e2e/movement-clip-visual.spec.ts` | **Create/modify** — visual step-lag browser e2e only |

---

## TRL-104 acceptance criteria (impl inherits)

1. `Player` schema exposes `velocityClipThreshold`, `visualsOffsetThreshold`, `visualsLerpFactor`, `maxVisualsOffset`, `maxStepVisual` with defaults above.
2. `clipHorizontalVelocity` exported; 3-height castShape; skips dynamic bodies; no-op when below threshold.
3. `playerSystem` clips horizontal velocity before applying displacement (3D + 2D X).
4. `PlayerVisualStepLag.svelte` applies grounded step-up offset and lerps toward zero; clamped to `-maxVisualsOffset`.
5. Local player play branch wraps render children in offset group; reset on play exit.
6. `pnpm check` (project baseline).
7. `pnpm run test:player-clip` passes for velocity clip; `PW_COLD=1 pnpm test:e2e e2e/movement-clip-visual.spec.ts` passes for visual step-lag.

**Explicitly NOT in TRL-104:** platform velocity (TRL-106), push-force on walked-on dynamics, networked visual offset sync.
