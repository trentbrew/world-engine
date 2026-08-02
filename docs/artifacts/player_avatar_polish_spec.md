---
version: 1
name: Player avatar polish + parkour collider sync
parent: TRL-151
status: queue-ready
---

# Spec: Player avatar polish + parkour collider sync (TRL-149 follow-ups)

**Parent proposal:** TRL-151\
**Depends on:** TRL-149 (A+B mannequin Player)\
**Out of scope:** Limb-hugging per-bone hulls, crouch/swim clips, root-motion
motor, rewriting parkour.jsonld entity positions (data is correct).

---

## Problem (playtest notes)

| # | Symptom                                          | Probe finding                                                                                                                                                                                |
| - | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Walk→run too fast                                | `DEFAULT_LOCOMOTION.keyboardTier = 'jog'`; pad `thresholds.jog = 0.22`; clip map sends jog→`Jog_Fwd_Loop`, run/sprint→`Sprint_Loop`                                                          |
| 2 | Full-stick gamepad jitter                        | Continuous stick + follow-cam projection → per-frame wish/yaw thrash; keyboard discrete                                                                                                      |
| 3 | Jump anim late                                   | `playerSystem` before `jumpSystem`; `Jump_Start` only on `tookOff`; SkinnedMeshView `CROSSFADE = 0.2`                                                                                        |
| 4 | Faces away from scene; 0°≈180° as `rotation.x:0` | Inspector quat→euler; **yaw is Y**. Visual `rotation.y = π` on skinned mesh. Identity vs Y-180 both have euler.x ≈ 0                                                                         |
| 5 | Player collider still pill                       | Spec TRL-148 kept analytic capsule; human wants **size from model bounds**                                                                                                                   |
| 6 | Parkour colliders stacked at origin              | World JSON positions correct (`Platform` Transform elsewhere). Rapier debug = physics world pose. Fixed/`!playing` RigidBodies skip `setTranslation`; parent Three groups carry visuals only |

---

## Architect decisions

### 1 — Locomotion gating

| Knob                   | Change                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `keyboardTier` default | **`'walk'`** (was `jog`) — plain WASD → `Walk_Loop`                                                                                        |
| Pad thresholds         | Raise to `{ jog: 0.45, run: 0.72, sprint: 0.92 }` (tunable)                                                                                |
| Clip hysteresis        | In `applyLocomotionClip`: require stick/tier to cross band **±0.08** (or stay ≥2 frames) before upgrading/downgrading clip so nudge≠sprint |

Hysteresis lives in `playerLocomotionClips.ts` (clip layer), not motor speeds —
motor can still accelerate; anim is less twitchy.

### 2 — Gamepad full-stick jitter

In `playerSystem` yaw update (and optionally stick sample in `input.ts`):

- **Yaw deadband:** only write `transform.rotation` when `atan2` delta from
  current yaw exceeds `~4°` **or** wish dir changed meaningfully.
- **Stick EMA (gamepad only):** low-pass `pad.x/z` (~12–18 Hz) before
  `resolveLocomotion` / motor; keyboard path unchanged.
- Do **not** change Rapier timestep.

Prefer yaw deadband first (smallest fix); add EMA if still jittery at mag≈1.

### 3 — Earlier Jump_Start

| Change            | Detail                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Anticipatory clip | On `input.jumpPressed()` / buffer arm (before leave-ground), call `applyJumpAnimClip(..., { anticipatory: true })` → `Jump_Start` immediately |
| Crossfade         | For `Jump_*` clips only: fade **0.05–0.08s** (keep 0.2 locomotion crossfade) — toggle in `SkinnedMeshView` or pass via a small helper         |
| System order      | Optional: register `jumpSystem` **before** `playerSystem` so takeoff `vy` and clip same frame — only if anticipatory alone isn’t enough       |

Land / loop logic from TRL-149 remains.

### 4 — Facing + inspector

| Finding                                                    | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspector `rotation.x/y/z` are **euler degrees** from quat | Label fields **Pitch / Yaw / Roll** (or `X° Y° Z°` with help: “Yaw = turn”) so 180° turn doesn’t look like “x:0 bug”                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Visual π vs motor −Z                                       | Keep mesh forward-align; **document**. Spawn default: set initial `Transform.rotation` yaw so player faces **into** the primary lane (+Z for parkour-style worlds) when Marker has no rotation — `buildPlayer` / spawn: quat yaw `0` with visual π means mesh looks +Z (into parkour from z=-7). If still facing away, Executor verifies camera vs mesh in play and **flips visual π → 0** _or_ adds `π` to spawn yaw — **pick one**: prefer **remove visual π and invert motor yaw** for skinned only (`atan2(faceX, faceZ)`) so inspector yaw matches what you see |
| Preferred facing model                                     | **Motor yaw matches visible facing.** Skinned players: use `quatFromYaw(Math.atan2(faceX, faceZ))` (drop − signs) **and remove** PhysicsBody `skinnedForwardYaw = π`. Capsule nose and mannequin then agree; inspector Yaw reads true.                                                                                                                                                                                                                                                                                                                               |

### 5 — Model-adapted player collider

**Policy:** keep **analytic capsule** (motor/ground casts need a stable upright
capsule). Size it from **loaded mesh AABB**, not a fixed 0.25/0.32.

| Step    | Detail                                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source  | `renderBounds.get(entityId)` after SkinnedMesh load (`meshBounds`)                                                                                                                                                                                                      |
| Mapping | `radius = 0.5 * max(size.x, size.z) * 0.45` (≈ torso width); `halfHeight = max(0.05, 0.5 * size.y - radius)`                                                                                                                                                            |
| Apply   | When bounds appear, update Physics collider args used by `PhysicsBody` / `resolveCollider` for Player — e.g. store fitted `{ halfHeight, radius }` on a small runtime cache or optional durable `Physics.capsuleHalfHeight` / `capsuleRadius` if schema needs authoring |
| Debug   | Capsule wireframe should match mannequin footprint/height                                                                                                                                                                                                               |

**Not:** `collider: hull` on skinned pose (limbs / animation blow up motor).
Author can still opt into hull/trimesh for props.

### 6 — Parkour colliders at origin (primary bug)

**Root cause:** `@threlte/rapier` RigidBody physics pose ≠ parent Three.js group
pose for debug. `PhysicsBodySync` **skips fixed** bodies
(`if (physicsBody === 'fixed') return`). Edit mode forces `bodyType = 'fixed'`
and never calls `setTranslation`. Visuals move via `transformRoot` /
`fixedPlayRoot`; Rapier stays at identity → stacked yellow boxes at origin.

**Fix:**

1. **Always** sync Transform → `rigidBody.setTranslation` / `setRotation` for
   entities with Physics, including **fixed** and **edit mode**
   (`playing === false`).
2. Keep fixedPlayRoot visual parenting if useful, but physics pose must match
   entity Transform every frame (or on Transform change via `$effect`).
3. When `!playing`, either sync every frame from Transform, or set RigidBody
   world pose on mount + when selection Transform changes.
4. Confirm with `?game=parkour` + Viewport → Colliders: platform boxes coincide
   with meshes in **edit and play**.

Do **not** rewrite parkour.jsonld positions.

---

## Files to create / modify

| File                                                       | Action                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/engine/player/playInput.ts`                       | keyboardTier → walk; pad thresholds                             |
| `src/lib/engine/player/playerLocomotionClips.ts`           | hysteresis; anticipatory Jump_Start                             |
| `src/lib/engine/player/playerSystem.ts`                    | yaw deadband; skinned yaw formula (note 4)                      |
| `src/lib/engine/player/input.ts` / `gamepad.svelte.ts`     | optional stick EMA                                              |
| `src/lib/engine/systems/behaviors/jump.ts`                 | anticipatory jump clip on press                                 |
| `src/lib/engine/systems/index.ts`                          | optional jump↔player order                                      |
| `src/lib/engine/render/views/SkinnedMeshView.svelte`       | shorter fade for Jump_*                                         |
| `src/lib/engine/render/PhysicsBody.svelte`                 | drop visual π if motor yaw inverted; bounds-fitted capsule args |
| `src/lib/engine/render/PhysicsBodySync.svelte`             | sync fixed + edit mode                                          |
| `src/lib/engine/physics/colliderShape.ts`                  | accept fitted capsule dims                                      |
| `src/lib/ui/ComponentFieldInput.svelte` / inspector labels | Pitch/Yaw/Roll clarity                                          |
| `docs/artifacts/player_avatar_polish_spec.md`              | this file                                                       |
| `e2e/player-skinned-avatar.spec.ts`                        | walk default; jump early; optional                              |
| New smoke or e2e for parkour collider poses                | probe RigidBody translation ≈ Transform.position for a platform |

---

## Verification

### Manual

1. Keyboard WASD without Shift → Walk_Loop; Shift → Sprint; light pad tilt →
   Walk, not Sprint.
2. Full stick pad — smooth motion, no vibration.
3. Space — Jump_Start visible **before** apex; land clip still fires.
4. Inspector: turn 180° → **Yaw** ≈ ±180, Pitch/Roll ≈ 0; mesh faces travel
   direction; parkour spawn faces into course.
5. Colliders on: player capsule ≈ mannequin size; parkour platforms’ yellow
   boxes on their meshes (edit + play).

### Automated

```bash
pnpm check
pnpm run test:player-clip
PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts
# optional:
PW_REUSE=1 pnpm test:e2e e2e/parkour-colliders.spec.ts
```

**parkour-colliders e2e / probe:** load `?game=parkour&mode=play`, enable or
ignore debug, assert via app probe that `entity:platform/start` RigidBody
translation (or collider world AABB center) is within ~0.5 of
Transform.position.

---

## Acceptance criteria

1. Plain keyboard locomotion uses **walk** clip by default; pad thresholds +
   clip hysteresis prevent nudge→sprint.
2. Full-deflection gamepad movement is stable (yaw deadband and/or stick
   filter); keyboard unchanged.
3. `Jump_Start` begins on jump press / buffer (before or as feet leave ground);
   jump crossfade ≤ ~0.08s.
4. Visible facing matches travel; inspector labels Yaw clearly; 0° vs 180°
   distinguishable on **Y**.
5. Player capsule halfHeight/radius derived from SkinnedMesh AABB; policy
   documented (analytic capsule, not pose hull).
6. Parkour (and generally fixed Physics) Rapier poses match Transform in edit +
   play — no origin stack.
7. `test:pnpm check`
8. `test:PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts`
9. Parkour collider pose covered by e2e or deterministic smoke named in impl
   SUMMARY.
