---
version: 1
name: 2D play camera rig
status: implemented
---

# Spec: 2D play camera rig

**Logic:** `src/lib/engine/camera/camera2D.ts`  
**Integration:** `src/lib/scene/WorldScene.svelte`

---

## Summary

When `WorldProfile.dimensions === '2d'` and shell is in **play** mode, the viewport uses a **locked orthographic follow camera** instead of orbit or 3D follow orbit.

---

## Behavior

| Mode | Camera |
| ---- | ------ |
| 3D edit | Orbit `CameraControls` (unchanged) |
| 3D play + follow | 3D orbit follow (`followCamera.svelte`) |
| 2D play | `applyCamera2DFollow` — dead zone + smoothing |

### Side-view (`plane: xy`)

- Camera at `(focusX, focusY, 24)` looking at `(focusX, focusY, 0)`.
- Player horizontal movement on X; Y from jump/gravity.

### Top-down (`plane: xz`)

- Camera at `(focusX, 24, focusZ)` looking at `(focusX, 0, focusZ)`.
- Same dead-zone logic on X/Z.

### Controls disabled in 2D play

`CameraControls.enabled = false` while `use2dPlayCam` — no orbit drift during platformer play.

---

## Config sources

1. **Ephemeral:** `camera2D.svelte.ts` defaults (`DEFAULT_CAMERA2D`).
2. **Durable:** `Camera2D` component on `entity:world/profile` overrides dead zone and zoom.

| Field | Default | Meaning |
| ----- | ------- | ------- |
| `zoom` | `48` | Orthographic zoom multiplier |
| `deadZoneX` | `1.2` | Pan threshold (primary horizontal axis) |
| `deadZoneY` | `0.8` | Pan threshold (vertical / depth axis) |
| `lookAhead` | `0.6` | Offset along travel axis |

---

## Placement plane branch

`placementRaycast.ts` and `placementSession.ts` use `WorldProfile.plane`:

- `xz` → hit `[x, z]` on Y=0 (existing 3D editor behavior)
- `xy` → hit `[x, y]` on Z=0

`WorldScene` backdrop mesh rotates to match the active plane.

---

## Acceptance

- [x] 2D play forces orthographic follow (not 3D follow orbit)
- [x] Orbit controls disabled during 2D play
- [x] `Camera2D` durable overrides merged at runtime
- [x] Placement raycast + backdrop respect `plane`
