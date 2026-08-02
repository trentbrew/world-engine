# Character Controller Closeout Report

**Issue:** TRL-120  
**Spec:** TRL-119  
**Epic:** TRL-96  
**Date:** 2026-07-06

## What Shipped

The character-controller pass turned the player stack from toy movement into a BoundingBox-informed controller foundation:

- **Rapier-backed ground sensing:** local players now get a kinematic capsule body; `GroundSensor.svelte` performs a 13-sample shape-cast grid, estimates walkable ground normals, tracks ground height, and records the supporting rigid-body handle.
- **Ground-aware jump behavior:** `jumpSystem` now uses `groundStore` instead of a hardcoded rest-height check, with coyote timing, buffered/held jump behavior, double-jump support, landing/step audio thresholds, and reset cleanup.
- **Velocity motor:** `playerSystem` now keeps horizontal velocity state, ramps ground acceleration, preserves air momentum, supports dot-product air steering, conforms/inhibits movement on slopes, and exposes system hooks for deterministic tests.
- **Collision clipping:** horizontal player velocity is sphere-cast at multiple body heights before displacement, clipping static/kinematic walls while skipping dynamic bodies.
- **Visual step-lag:** the player visual root offsets down on grounded step-up corrections and lerps back, reducing visible pops without moving the physics body.
- **Platform velocity inheritance:** `GroundSensor.svelte` samples supporting platform `linvel()`, while `platformVelocitySystem` handles landing subtraction, grounded carry with collision clipping, and leave/jump inheritance.
- **Closeout hardening:** the red `pnpm check` baseline was fixed in `peerEditToasts.ts` and `viewportNavigation.ts` with typed/narrow changes; deterministic smoke coverage was added for velocity clipping and platform velocity.

## Files / Artifacts Landed

- Specs and plans: `docs/plans/character-controller.md`, `docs/artifacts/character_controller_ground_spec.md`, `docs/artifacts/character_controller_motor_spec.md`, `docs/artifacts/character_controller_clip_visual_spec.md`, `docs/artifacts/platform_velocity_spec.md`, `docs/artifacts/character_controller_closeout_hardening_spec.md`.
- Runtime systems: `src/lib/engine/render/GroundSensor.svelte`, `src/lib/engine/player/groundStore.svelte.ts`, `src/lib/engine/player/playerSystem.ts`, `src/lib/engine/player/playerMovementUtils.ts`, `src/lib/engine/player/playerCollision.ts`, `src/lib/engine/player/playerVisualStepLag.ts`, `src/lib/engine/player/platformVelocityUtils.ts`, `src/lib/engine/systems/behaviors/jump.ts`, `src/lib/engine/systems/behaviors/platformVelocity.ts`, `src/lib/engine/systems/index.ts`.
- Render/player integration: `src/lib/engine/player/spawnPlayer.ts`, `src/lib/engine/render/PhysicsBody.svelte`, `src/lib/engine/render/PhysicsBodySync.svelte`, `src/lib/engine/render/PlayerVisualStepLag.svelte`.
- Verification: `scripts/player-clip-smoke.ts`, `scripts/platform-velocity-smoke.ts`, `e2e/movement-motor.spec.ts`, `e2e/jump-feel.spec.ts`, `e2e/movement-clip-visual.spec.ts`, plus package scripts `test:player-clip` and `test:platform-velocity`.
- Closeout fixes: `src/lib/engine/collab/peerEditToasts.ts`, `src/lib/scene/viewportNavigation.ts`.

## Review Evidence

| Implementation | Feature slice | Review child | Status |
| --- | --- | --- | --- |
| TRL-98 | Ground detection | TRL-108 | Review pass recorded |
| TRL-100 | Jump feel | TRL-116 | Review pass recorded |
| TRL-102 | Velocity motor + air control | TRL-114 | Review pass recorded |
| TRL-104 | Velocity clipping + visual step-lag | TRL-115 | Review pass recorded |
| TRL-106 | Platform velocity inheritance | TRL-117 | Review pass recorded |

## Verification Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm check` | Pass | 0 errors, 6 existing warnings in UI files |
| `pnpm run test:player-clip` | Pass | Deterministic smoke: threshold, static clip, dynamic skip |
| `pnpm run test:platform-velocity` | Pass | Deterministic smoke: landing, leave, carry, clipping |
| `pnpm test:e2e e2e/movement-motor.spec.ts` | Pass | 3/3 Chromium tests passed against reused dev server |
| `pnpm test:e2e e2e/jump-feel.spec.ts` | Pass | 4/4 Chromium tests passed against reused dev server |
| `pnpm test:e2e e2e/movement-clip-visual.spec.ts` | Pass | 1/1 Chromium test passed against reused dev server |

## Static Check Warnings

`pnpm check` exits successfully. Remaining warnings are non-blocking:

- `src/lib/ui/AssetThumbnail.svelte`: initial-value `$state` warning for `asset`.
- `src/lib/ui/CollaborationSection.svelte`: unused `.field-row` selector.
- `src/lib/ui/InspectorField.svelte`: `dblclick` handler on static `<div>`.
- `src/lib/ui/OrbitPopover.svelte`: `dblclick` handler on static `<div>` in two controls.

## Graph Notes

The reviewed character-controller implementation issues still have stale or duplicated acceptance-criteria metadata in Trellis. This report is the closeout artifact tying the review-pass children to the final static, smoke, and focused browser verification.

## Ship Recommendation

Ship recommendation: the character-controller stack is ready to merge and push. Static checks, deterministic smokes, and focused browser verification are green.
