---
version: 1
name: Step-up upward obstruction clip
parent: TRL-30
proposal: TRL-30
status: queue-ready
---

# Spec: Step-up upward obstruction clip

**Parent proposal:** TRL-30 (follow-on to TRL-24 hall wall collision)  
**Reference:** `~/TURTLE/Projects/oss/charactercontroller` — `CharacterControllerBase.CheckGround` upward `SphereCast` before vertical correction when `touchingGround`.

---

## Problem

Ground snap and step-up can raise the player capsule without checking for overhead geometry. On World Labs trimesh shells (museum hall lips, Town Square balcony rings), the body can **pop through** low overhangs because:

1. `GroundSensor` accepts a higher center hit when `stepUp <= STEP_HEIGHT`.
2. `jumpSystem` integrates `restCenterY - y` upward with no ceiling probe.
3. Horizontal step-up (`canStepOntoTarget`) only checks downward ground at the target — not clearance above the capsule.

TRL-24 fixed horizontal wall block on trimesh; this wedge adds the missing **vertical obstruction** pass.

---

## Summary

Add **`clipUpwardStepDelta`** (Rapier upward `castShape`) and call it wherever grounded vertical correction would move the capsule up. Clip the allowed delta so the capsule inner height does not intersect fixed overhead trimesh. Reuse TRL-24 probe/context patterns; do not regress horizontal wall behavior.

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Where to clip | **`playerCollision.ts`** shared helper; call from **`jump.ts`** grounded Y correction | Unity clips before `MovePosition`; museum vertical authority is jump ground snap |
| Also gate ground height? | **Yes — optional cap in `GroundSensor`** when accepting `stepUp` | Prevents `groundStore.height` from jumping above a blocked ceiling before jump integrates |
| Cast shape | Reuse **`Ball` probe** (`HORIZONTAL_PROBE_SCALE × radius`) | Same as horizontal clip; already bound via `bindPlayerCollisionContext` |
| Cast origin | Foot base + **lower capsule band** (`halfHeight + radius`, same as waist sample foot offset) | Mirrors Unity `capsuleCenterLower` upward ray |
| Cast direction | `+Y` | Ceiling / overhang probe only |
| Cast distance | `desiredUp + capsuleInnerHeight + COLLISION_SKIN` | `capsuleInnerHeight = 2 × halfHeight` (full inner column) |
| Blocking hit | **`normal2.y <= CEILING_NORMAL_Y_MAX`** (default **-0.5**) | Overhead faces point down; avoids treating shallow trimesh noise as ceiling |
| Walkable / floor grazes | Ignore hits with **`normal2.y > 0`** on upward cast | Upward cast should not “hit floor” above player |
| Dynamic bodies | **Skip clip** (same as horizontal `shouldClipHit`) | Player can be pushed under moving props |
| Trimesh glue | Do **not** add chest-height upward samples — waist/lower band only | TRL-24 lesson: extra vertical samples glue on hall trimesh |
| Constants location | `playerCollision.ts` (export if GroundSensor needs) | Single source |
| Out of scope | Crouch, vault, full ceiling navigation, new ontology components, changing `STEP_HEIGHT` | Collision hardening only |

---

## Engine changes

### 1. `playerCollision.ts` — `clipUpwardStepDelta`

```ts
/** Max normal.y for an upward cast hit to count as ceiling (face points down). */
const CEILING_NORMAL_Y_MAX = -0.5;

export function clipUpwardStepDelta(
  entity: Entity,
  desiredUp: number,
  center: [number, number, number],
  halfHeight: number,
  radius: number
): number;
```

Behavior:

- If `desiredUp <= EPSILON` or no context → return `desiredUp`.
- Origin: capsule foot base + `(halfHeight + radius) + UPWARD_CAST_LIFT` (new constant ~0.04, mirror horizontal).
- `castShape` along `+Y` for distance `desiredUp + 2 * halfHeight + COLLISION_SKIN`.
- On closest blocking hit: `allowedUp = max(0, hit.toi - COLLISION_SKIN)`; return `min(desiredUp, allowedUp)`.
- Blocking: not dynamic, `normal2.y <= CEILING_NORMAL_Y_MAX`.

Export a thin wrapper `clipUpwardStepDeltaForEntity(entity, desiredUp): number` that resolves capsule dims (same as horizontal helpers).

### 2. `jump.ts` — clip grounded upward correction

In grounded branch where `deltaToRest = restCenterY - y > 0`:

```ts
const clippedUp = clipUpwardStepDeltaForEntity(entity, Math.max(0, deltaToRest));
// use clippedUp instead of deltaToRest for maxCorrection path
```

Do not clip downward correction (`deltaToRest < 0`).

### 3. `GroundSensor.svelte` — cap accepted step-up (recommended)

After computing `stepUp` from center hit and before setting `groundStore.height`:

- If `stepUp > FLOOR_FUDGE`, compute `maxAllowed = clipUpwardStepDeltaForEntity(entity, stepUp)`.
- If `maxAllowed < stepUp - FLOOR_FUDGE`, treat as blocked step: `tryUnground('stepUp')` **or** keep previous height (prefer **ungound** if clearance insufficient — matches “can't step here”).

Pick one behavior and document in impl; default **reject step** (ungound) when upward clip zeroes the rise.

### 4. Tests

**`scripts/player-clip-smoke.ts`** — add:

- `testUpwardClipAllowsWhenClear` — no hit → full delta
- `testUpwardClipBlocksCeiling` — hit at toi=0.1 with normal y=-1 → delta clipped
- `testUpwardClipIgnoresDynamic` — dynamic ceiling → no clip

No new e2e required if existing collider e2e + smoke pass; label spec `needs-e2e` for regression gate only.

---

## Runtime sequence

1. Player walks toward low lip; horizontal resolve allows small step (steep riser + `canStepOntoTarget`).
2. GroundSensor sees higher center hit; `stepUp` within `STEP_HEIGHT`.
3. **New:** upward cast from lower capsule band; overhang within inner height → step rejected or height capped.
4. If grounded snap still requests upward delta, **jump** clips `deltaToRest` same way.
5. Player stays below balcony lip — no head pop.

---

## Files

| Path | Change |
| ---- | ------ |
| `src/lib/engine/player/playerCollision.ts` | `clipUpwardStepDelta`, constants, export wrapper |
| `src/lib/engine/systems/behaviors/jump.ts` | Clip positive grounded Y correction |
| `src/lib/engine/render/GroundSensor.svelte` | Gate step-up height acceptance |
| `scripts/player-clip-smoke.ts` | Upward clip unit cases |

---

## Acceptance criteria

```
test:cd <repo> && pnpm check
test:cd <repo> && pnpm test:player-clip
test:cd <repo> && PW_REUSE=1 pnpm test:e2e e2e/parkour-colliders.spec.ts
```

Behavioral:

1. **Ceiling clip** — Positive grounded vertical correction is reduced when an upward cast hits overhead trimesh within capsule inner height.
2. **Step gate** — GroundSensor does not accept a step-up that fails upward clearance (player does not pop through low overhang).
3. **No horizontal regression** — Existing player-clip smoke cases (wall block, slope, slide, chest gate) remain green.
4. **Collider regression** — collider e2e still passes (walls block, era swap intact).

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Trimesh false ceilings (shallow upward normals) | `CEILING_NORMAL_Y_MAX = -0.5`; tune only with smoke |
| Double-clip (GroundSensor + jump) feels sticky | Both use same helper; clip is idempotent for same delta |
| 2D worlds | Guard: skip when `worldProfile` is 2D xy (or no capsule) |

---

## Non-goals

- Animated fountain / splat dressing
- Changing horizontal wall thresholds from TRL-24
- Authoring per-room ceiling volumes in JSON-LD
