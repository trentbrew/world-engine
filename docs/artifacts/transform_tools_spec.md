---
version: 1
name: Transform Tools (move / rotate / scale)
status: in-progress
phases:
  - phase-1-wire-it
  - phase-2-polish
  - phase-3-ground
---

# Spec: Transform Tools

**Scope:** Viewport gizmo modes + toolbar for moving, rotating, and scaling selected entities in edit mode.

---

## Summary

Authors select an entity and manipulate it via Three.js `TransformControls` (already integrated as `EntityTransformControls`). Phase 1 completes the loop: **scale sync**, a **mode toolbar** (move / rotate / scale), and **W/E/R keyboard shortcuts**. Inspector numeric fields remain the precision path.

**Out of scope (later phases):** ground `Ground.size` resize gizmo, rotation/scale snap, local/world space toggle, uniform-scale modifier (Shift), arrow-key nudge for rotate/scale.

---

## Current baseline

| Piece | State before this wedge |
| ----- | ------------------------ |
| `EntityTransformControls` | Translate + rotate sync; no scale write |
| `ui.transformGizmoMode` | `'translate' \| 'rotate'` — no UI |
| `MeshView` | Reads `Transform.scale` on transform root |
| `MarkerView` | Ignores scale |
| Inspector | All `Transform` fields editable |
| Ownership | `world.canTransformEntity` gates gizmo |

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Scale field | `Transform.scale` vec3 | Already in ontology; durable sync |
| "Resize" for props | Same as scale | Ground uses `Ground.size` — separate wedge |
| Toolbar placement | Bottom-center, **above asset dock** in shared `viewport-bottom-chrome` stack | Avoids doc-bar Edit/Play overlap |
| Mode keys | `W` translate · `E` rotate · `R` scale | Blender/Unity convention |
| Scale durable writes | Commit scale on **mouseup** only | Avoid op-log flood during drag |
| Position/rotation | Commit on every gizmo change (existing) | Realtime fields |
| Min scale | Clamp each axis to `0.01` | Prevent zero/inverted colliders |
| Scale snap (v1) | `0.1` when grid off; `grid.cellSize / 10` when grid on | Matches translation snap spirit |
| Entity restrictions | Unchanged | Ground blocked; owner-only; no gizmo during placement |

---

## Phase 1 — Wire it (this impl)

### Files

| File | Change |
| ---- | ------ |
| `EntityTransformControls.svelte` | Scale read/write; scale snap; durable commit on mouseup |
| `ui.svelte.ts` | `transformGizmoMode` includes `'scale'` |
| `TransformToolbar.svelte` | **New** — segmented move / rotate / scale |
| `shellKeyboard.ts` | W/E/R shortcuts in edit mode |
| `MarkerView.svelte` | Apply `Transform.scale` |
| `WorldViewport.svelte` | Mount toolbar in edit mode |
| `access.ts` | `scaleVec()` helper |
| `inspectorBounds.ts` | `Transform.scale` bounds |

### Acceptance criteria

1. Select a prop in edit mode → move/rotate/scale toolbar appears above the bottom asset dock.
2. Click **Scale** (or press `R`) → gizmo shows scale handles; dragging updates mesh size live.
3. Release mouse → `Transform.scale` in inspector matches gizmo; value persists after reload (`?durable=static`).
4. Press `W` / `E` → switches to translate / rotate gizmo modes.
5. Spawn marker scales correctly when `Transform.scale` ≠ `[1,1,1]`.
6. Toolbar hidden in play mode and during placement draft.
7. `pnpm check` passes.

---

## Phase 2 — Polish

- Shift → uniform scale
- Rotation snap (15°)
- Local / world space toggle (`TransformControls.space`)
- Arrow-key nudge for rotate Y and uniform scale

---

## Phase 3 — Ground resize + transform profiles

**Full spec:** [transform_profiles_ground_spec.md](./transform_profiles_ground_spec.md)

- **Transform profiles:** `plane` (GroundPlane), `box` (Platform/box+Physics), `uniform` (sphere/capsule), `free` (default gizmo)
- **Ground:** corner handles → `Ground.size`; XZ move only; no rotate
- **Platforms:** corner handles → `Transform.scale` (collider follows)
- **TRL-98 alignment:** `GroundPlane` type gains thin fixed box collider sized from `Ground.size`; remove implicit floor collision from `WorldScene` shadow mesh when a `Ground` entity exists

---

## Verification

```bash
pnpm check
# Manual: ?game=physics → edit → select PhysBox → R → scale → Play → collider matches
```

Optional e2e: `e2e/transform-tools.spec.ts` — select entity, click Scale, assert inspector scale field changes.
