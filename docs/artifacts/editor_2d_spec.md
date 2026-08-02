---
version: 1
name: 2D editor mode (Phase 4)
status: implemented
---

# Spec: 2D editor mode

**When:** `WorldProfile.dimensions === '2d'` and shell is in **edit** mode.

---

## Summary

Edit mode matches play mode's play plane — orthographic, pan/zoom on-plane, 2D grid, constrained gizmo, plane-aware overlays. No orbit off-plane, no perspective toggle, reduced 3D chrome.

---

## Camera

| Control | 2D edit behavior |
| ------- | ---------------- |
| Projection | Orthographic only (forced; toggle hidden) |
| Rotate | Disabled (`rotateSpeed: 0`) |
| Left / right drag | Truck (pan) |
| Wheel / pinch | Zoom |
| Initial pose | `editCameraPose(plane)` side or top view |

---

## Transform gizmo

- **Mode:** translate only in 2D edit
- **Axes:** `xy` → X+Y; `xz` → X+Z
- **Snap:** position clamped to play plane on commit (`clampPositionToPlane`)

---

## Overlays

| Component | Plane-aware |
| --------- | ----------- |
| `EditorGrid` | `plane` prop from `editorGridPlane()` |
| `GridCellHighlight` | `placementHighlightPosition` + `overlayGroupRotation` |
| `SelectionFootprints` | `entityFootprint(entity, plane)` |
| Backdrop mesh | `playPlaneMeshRotation` |

---

## Chrome defaults (on `worldProfile.hydrate`)

- Sky off
- Shadows off
- Fog off
- Perspective / view-cube hidden in 2D worlds

---

## Files

- [`playPlane.ts`](../../src/lib/scene/playPlane.ts) — shared plane helpers
- [`WorldScene.svelte`](../../src/lib/scene/WorldScene.svelte) — camera + chrome branches
- [`EntityTransformControls.svelte`](../../src/lib/scene/EntityTransformControls.svelte)
- [`entityFootprint.ts`](../../src/lib/scene/entityFootprint.ts)
- [`ViewControls.svelte`](../../src/lib/ui/ViewControls.svelte)

---

## Acceptance

- [x] `?game=platformer2d` edit: side ortho view, pan/zoom, no orbit
- [x] Grid and placement on XY plane
- [x] Gizmo moves on X/Y only for side-view
- [x] Selection footprints on play plane
- [x] No sky / perspective toggle in 2D worlds
