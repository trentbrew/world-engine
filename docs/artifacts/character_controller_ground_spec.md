---
version: 1
name: Ground detection (Rapier shape-cast grid)
parent: TRL-96
issue: TRL-97
status: queue-ready
---

# Spec: Ground detection system (Rapier shape-cast grid)

**Parent proposal:** TRL-96  
**Impl:** TRL-98 (blocked on this spec)  
**Plan:** [`docs/plans/character-controller.md`](../plans/character-controller.md) Phase 1  
**Out of scope (this wedge):** Coyote time, slope movement, air control, visual step-lag, platform velocity transfer logic (later phases). No `ground.ts` tick behavior.

---

## Summary

Replace the jump `rest` magic constant with **Rapier-backed ground sensing** for the local owned player. Ground detection is a **Svelte/Rapier bridge** (`GroundSensor.svelte` → `groundStore`), not a scheduler behavior. The player must gain a **kinematic-position** Rapier capsule so shape casts and floor collision work.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Detection location | **`GroundSensor.svelte`** inside `PhysicsBody`, not `systems/behaviors/ground.ts` | Rapier `World` lives in the Threlte render tree; shape casts need `useRapier()` + stepping order |
| State sink | **`groundStore.svelte.ts`** singleton | Local-player-only ground facts consumed by `jumpSystem` / `playerSystem` |
| Player Physics | **`Physics: { body: 'kinematicPosition', collider: 'capsule', mass: 70, gravityScale: 0 }`** on `buildPlayer()` | Kinematic capsule collides with floor; Transform remains integration authority |
| `body` string | **`kinematicPosition`** (alias `kinematic` ok via existing mapper) | Matches `PhysicsBody.svelte` Rapier type map |
| Transform authority (owner) | **Transform → rigidBody before sim; skip rigidBody → Transform after sim** for `kinematicPosition` owner | Current owner post-step sync would overwrite `jumpSystem` integration |
| Remote players | Unchanged: network `Transform` → rigidBody pre-step; no `groundStore` | Peers don't run local ground sense on remotes |
| Probe method | **`world.castShape`** with small **sphere** probe, direction **−Y** | Robust on edges vs single ray; matches BoundingBox grid approach |
| Sample layout | **13-point radial grid** (outer ×8, inner ×4, center ×1) | BoundingBox CharacterController ground normal mesh |
| Normal estimation | Triangulate fan from center to adjacent ring hits → **area-weighted average** of face normals | 16 triangles when all samples hit; degrade gracefully with partial hits |
| Grounded predicate | **Center probe hit** within `stepHeight + floorFudge` **and** surface angle ≤ `maxSlope` | Prevents wall/ceiling false positives |
| `Jump.rest` | **Remove** from schema; landing height from `groundStore.height` | Eliminates magic constant |
| `jumpSystem` wiring | **Register** in `systems/index.ts`; add **`Jump`** to `Player` type + `buildPlayer()` | Component exists but is not on player entities today |
| Params (Phase 1) | **Constants in `GroundSensor.svelte`** (not a new ontology component) | `stepHeight`, `floorFudge`, `maxSlope`, ring radii — promote to data later if needed |

---

## Prerequisites (current engine gaps)

1. Player has **no `Physics`** → no Rapier body, no collision, `PhysicsBodySync` not mounted.
2. Player has **no `Jump`** component → `jumpSystem` no-ops.
3. `jumpSystem` is **not registered** in `systems/index.ts`.
4. `PhysicsBodySync` **owner post-step** path would fight kinematic Transform integration.

All four are in scope for TRL-98.

---

## Data model changes

### `buildPlayer()` components (normative)

```ts
components: {
  Transform: { position: spawn },
  Render: { mesh: 'primitive:capsule', color },
  Player: { speed: 4, color },
  Physics: { body: 'kinematicPosition', collider: 'capsule', mass: 70, gravityScale: 0 },
  Jump: {} // defaults: height 1.2, g 9.8, delay 120, cooldown 280, vy 0
}
```

Update `registerType({ name: 'Player', components: [...] })` to include `Physics` and `Jump`.

### `Jump` schema change

Remove field:

```ts
rest: { t: 'number', default: 0.5 }, // DELETE
```

Landing/clamp uses `groundStore.height` when `groundStore.grounded`.

---

## `groundStore.svelte.ts`

Path: `src/lib/engine/player/groundStore.svelte.ts`

```ts
export type GroundState = {
  grounded: boolean;
  normal: [number, number, number];
  /** World-space Y of ground under capsule foot probe. */
  height: number;
  /** Rapier rigid-body handle of supporting platform, if any. */
  platformRigidBodyHandle: number | null;
};

export const groundStore = $state<GroundState>({
  grounded: false,
  normal: [0, 1, 0],
  height: 0,
  platformRigidBodyHandle: null
});

/** Call on play exit / local player despawn. */
export function resetGroundStore(): void {
  groundStore.grounded = false;
  groundStore.normal = [0, 1, 0];
  groundStore.height = 0;
  groundStore.platformRigidBodyHandle = null;
}
```

---

## `GroundSensor.svelte`

Path: `src/lib/engine/render/GroundSensor.svelte`

### Mount

Render inside `PhysicsBody.svelte` when **all** of:

- `playing`
- `world.isOwner(entity.id)`
- `'Player' in entity.components`
- `rigidBody` defined

Pass `{ entity, rigidBody }`.

### Constants (Phase 1)

| Constant | Value | Notes |
| -------- | ----- | ----- |
| `PROBE_RADIUS` | `0.08` | Rapier ball shape radius |
| `OUTER_RADIUS` | `0.35` | XZ offset from foot anchor |
| `INNER_RADIUS` | `0.15` | XZ offset |
| `STEP_HEIGHT` | `0.35` | Max vertical gap to still count grounded |
| `FLOOR_FUDGE` | `0.05` | Extra cast slack |
| `MAX_SLOPE_DEG` | `60` | Skip hits steeper than this |
| `CAST_DISTANCE` | `STEP_HEIGHT + FLOOR_FUDGE + PROBE_RADIUS` | Downward cast length |

### Foot anchor

Use `resolveCollider()` with entity `Render.mesh` + `Transform.scale` (same as `PhysicsBody`):

- Capsule args `[halfHeight, radius]` → foot Y = `transform.y - halfHeight - radius`
- Probe origin = `[transform.x + offsetX, footY + PROBE_RADIUS, transform.z + offsetZ]` (sphere center slightly above foot)

### 13 sample offsets (XZ, meters)

- **Center:** `(0, 0)`
- **Inner ring (4):** `(0, ±INNER)`, `(±INNER, 0)`
- **Outer ring (8):** `(±OUTER, 0)`, `(0, ±OUTER)`, `(±OUTER×0.707, ±OUTER×0.707)`

### Cast filter

- Direction: `(0, -1, 0)`
- **Exclude** colliders belonging to this entity's `rigidBody` (self-filter)
- Accept hit iff `hit.normal.y > cos(MAX_SLOPE_DEG)` (surface not a wall/ceiling)

### Per-sample output

For each valid hit store `{ point: Vec3, normal: Vec3, toi: number, bodyHandle: number | null }`.

### Normal estimation

1. If **center** miss → `grounded = false`, defaults, return.
2. Build triangles: for each outer-ring sector `i`, triangle `(center, outer[i], outer[i+1])`; add inner-sector triangles when inner hits exist (same fan pattern as BoundingBox — **16 triangles** when full).
3. For each triangle with 3 valid vertices, `faceNormal = normalize(cross(b-a, c-a))`, flip if `faceNormal.y < 0`.
4. **Aggregate normal** = normalize(Σ `faceNormal * triangleArea`).
5. Fallback if degenerate: use center hit normal, else `[0,1,0]`.

### Grounded + height

```ts
grounded = centerHit != null && centerHit.toi <= CAST_DISTANCE;
height = centerHit ? footY - centerHit.toi + PROBE_RADIUS : groundStore.height;
platformRigidBodyHandle = centerHit?.bodyHandle ?? null;
```

### Task timing

```ts
const { simulationTask } = useRapier();
usePhysicsTask(() => { /* run casts, write groundStore */ });
```

Runs **after** owner kinematic Transform→RB sync (see below) and **before** Rapier step — same phase as other pre-step probes.

---

## `PhysicsBodySync.svelte` change

Add derived `kinematicOwner`:

```ts
const kinematicOwner = $derived(
  playing && isOwner && (entity.components.Physics as { body?: string })?.body
    && ['kinematic', 'kinematicPosition'].includes(body)
);
```

| Mode | Pre-step (`usePhysicsTask`) | Post-step (`useTask after simulationTask`) |
| ---- | --------------------------- | ------------------------------------------ |
| Non-owner | Transform → RB | skip |
| Owner + dynamic/fixed | skip | RB → Transform |
| **Owner + kinematicPosition** | **Transform → RB** | **skip** |

This preserves jump/gravity integration on `Transform` while keeping the Rapier body aligned for casts/collision.

---

## `jump.ts` changes (TRL-98)

1. Import `groundStore` from `groundStore.svelte.ts`.
2. Replace grounded check:

```ts
const grounded = groundStore.grounded && jump.vy <= 0.01;
```

3. Replace Y clamp:

```ts
if (grounded) {
  y = Math.max(y, groundStore.height);
  if (y <= groundStore.height + 0.02) {
    y = groundStore.height;
    vy = 0;
    // land sfx...
  }
}
```

4. Remove `rest` from `Jump` registration.
5. Call `resetGroundStore()` from `resetJumpInputState()` (or play-mode exit hook).

---

## `playerSystem.ts` (Phase 1 stub)

Import `groundStore`; read `groundStore.normal` into a local `const` (even if unused) so Phase 3 slope work doesn't require import plumbing. Optional: assign to module-level `lastGroundNormal` export.

---

## `systems/index.ts`

```ts
import './behaviors/jump';
import { jumpSystem } from './behaviors/jump';
// ...
scheduler.register(playerSystem);
scheduler.register(jumpSystem);
```

Order: `playerSystem` then `jumpSystem` (XZ then Y integration).

---

## Frame pipeline (play mode, local player)

```
1. scheduler tick: playerSystem → jumpSystem (mutate Transform)
2. usePhysicsTask: PhysicsBodySync — Transform → kinematic RB (owner)
3. usePhysicsTask: GroundSensor — castShape grid → groundStore
4. Rapier simulation step
5. useTask (post-step): PhysicsBodySync — RB → Transform (dynamic owner only; skip kinematic)
6. Render
```

---

## Verification (manual + automated)

| Check | Command / action |
| ----- | ---------------- |
| Types | `pnpm check` |
| Smoke | `pnpm test:e2e e2e/smoke.spec.ts` |
| Play | `?game=playground` → play mode → WASD + space |
| Ground | Player rests on floor cuboid (no fall-through); jumping works |
| Store | Temporary dev log or debug overlay: `groundStore.grounded` toggles on leave/land |

---

## TRL-98 acceptance criteria (impl inherits)

1. `src/lib/engine/player/groundStore.svelte.ts` created with `GroundState` + `resetGroundStore`
2. `src/lib/engine/render/GroundSensor.svelte` — 13-point cast grid, normal estimation, writes `groundStore`
3. `PhysicsBody.svelte` mounts `GroundSensor` for owned `Player` entities in play mode
4. `spawnPlayer.ts` — `Physics` + `Jump` on player; `Player` type updated
5. `PhysicsBodySync.svelte` — kinematic owner pre-step sync; skip post-step overwrite
6. `jump.ts` — uses `groundStore.grounded` / `groundStore.height`; `rest` removed
7. `jumpSystem` registered in `systems/index.ts`
8. `playerSystem.ts` imports `groundStore.normal` (stub ok)
9. `pnpm check`
10. Manual play-mode verification per table above

**Explicitly NOT in TRL-98:** `systems/behaviors/ground.ts`, new `Ground` ontology component.
