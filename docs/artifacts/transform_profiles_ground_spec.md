---
version: 1
name: Transform profiles + ground collider sync
parent: transform_tools_spec (phase-3-ground)
related:
  - docs/plans/character-controller.md
  - docs/artifacts/character_controller_ground_spec.md
  - docs/artifacts/transform_tools_spec.md
status: queue-ready
---

# Spec: Transform profiles, corner resize, and ground collider sync

**Parent:** [transform_tools_spec.md](./transform_tools_spec.md) Phase 3  
**Character controller:** [character-controller.md](../plans/character-controller.md) · [character_controller_ground_spec.md](./character_controller_ground_spec.md)  
**Out of scope:** Phase 2 transform polish (uniform scale, rotation snap); full `BoundingBoxHandles` for glTF props; Trellis migration of existing worlds

---

## Summary

Introduce **transform profiles** so edit-mode manipulation matches entity *gameplay role*, not a single gizmo for everything:

| Profile | Entities | Move | Rotate | Resize |
| ------- | -------- | ---- | ------ | ------ |
| `plane` | `GroundPlane` | XZ only | **Blocked** (keep Y-up) | Corner handles → `Ground.size` |
| `box` | `Platform`, `Prop` + `primitive:box` + `Physics` | Full gizmo | Y (full gizmo v1) | Corner handles → `Transform.scale` |
| `uniform` | `primitive:sphere` / `capsule` | Full gizmo | Full gizmo | Corner drag → uniform `Transform.scale` |
| `free` | Everything else | Existing toolbar + gizmo | Existing | Scale mode (axis gizmo) |

**Collider sync wedge:** `GroundPlane` gains a **thin fixed box** Rapier collider derived from `Ground.size` + `Transform`, so TRL-98 verification (“player rests on floor cuboid”) matches what authors see and resize in the editor. Parkour **platforms** already sync via `Physics` + `Transform.scale`.

---

## Problem

1. **Ground** uses `Ground.size` for mesh/grid; generic scale gizmo writes `Transform.scale` — mismatched semantics (see Phase 1 platform double-scale fix).
2. **`GroundPlane` has no `Physics`** today — walkable floor in play mode is the anonymous 50×50 shadow catcher in `WorldScene.svelte`, not the authored ground entity. `groundStore` shape casts hit platforms but the main floor may not match `Ground.size`.
3. **Character controller** (TRL-97+) treats walkability as **collider + surface normal**, not `Ground` component fields. Editor resize is only correct when visual bounds = Rapier bounds.

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Ground resize field | **`Ground.size`** (scalar, square) | Existing ontology; grid fade already wired in `GroundView` |
| Ground resize UX | **4 corner handles** on XZ plane, opposite corner pinned | Figma-style; clearer than axis scale for floors |
| Ground move | **XZ only** (arrow nudge + translate gizmo constrained) | Reposition arena; avoid accidental Y lift |
| Ground rotate | **Blocked** in `plane` profile | Tilted backdrop breaks “floor” semantics; use `Platform` for ramps |
| Platform / box resize | **Corner handles → `Transform.scale`** | `PhysicsBody` collider already follows scale |
| Sphere resize | Corner drag → **uniform** scale (single scalar) | One degree of freedom |
| Toolbar on ground select | **Move only** (hide Rotate / Scale segments) | Steer authors to corners for size |
| Corner handle widget | **`CornerResizeHandles.svelte`** shared by ground + box | One interaction model; different write targets |
| Ground collider | **`Physics: { body: 'fixed', collider: 'box' }`** on `GroundPlane` type | Same pipeline as parkour platforms |
| Collider dimensions | Thin slab: scale **`[size, 0.15, size]`**, mesh plane at entity origin | Box height ≈ skin thickness; foot probe hits top face |
| Collider mount | **`GroundView`** wraps `PhysicsBody` in play mode (or always with `body: fixed` in edit) | Reuse `PhysicsBody` + `AutoColliders` / analytic box |
| WorldScene fallback plane | **No Rapier collider** when a `Ground` entity exists in the world | Single source of truth for floor collision |
| Durable writes | `Ground.size` on corner **mouseup**; position XZ on drag end or live (match translate policy) | Avoid op-log flood |
| Snap | Corner drag snaps to **`ui.grid.cellSize`** when `ui.chrome.grid` | Consistent with translation snap |
| Min size | **`Ground.size` ≥ 4** | Prevent degenerate collider / grid |
| TRL-98 dependency | Collider sync is **same wedge** as ground corner resize (3b), not a separate issue | Authors testing parkour need floor + platforms aligned |
| `Transform.scale` on ground | **Ignored** for `Ground` entities (do not apply on `transformRoot`) | One authority: `Ground.size` |

---

## Transform profile resolution

Path: `src/lib/engine/render/transformProfile.ts`

```ts
export type TransformProfile = 'plane' | 'box' | 'uniform' | 'free';

export function transformProfile(entity: Entity): TransformProfile {
  if ('Ground' in entity.components) return 'plane';
  const render = entity.components.Render as { mesh?: string } | undefined;
  const mesh = render?.mesh;
  if ('Physics' in entity.components && mesh === 'primitive:box') return 'box';
  if (mesh === 'primitive:sphere' || mesh === 'primitive:capsule') return 'uniform';
  return 'free';
}
```

Consumers: `TransformToolbar.svelte`, `GroundView.svelte`, `MeshView.svelte` / `PhysicsBody.svelte`, `shellKeyboard.ts` (nudge constraints).

---

## Phase 3a — Corner resize handles

### `CornerResizeHandles.svelte` (new)

Viewport widget mounted when selected entity profile is `plane` or `box` (and `uniform` with one active corner set).

**Interaction**

1. Draw 4 handles at world-space corners of the footprint (from `entityFootprint()` + profile).
2. Drag handle → raycast to **Y = 0** plane (or entity `Transform.position.y` for elevated platforms).
3. **Pinned corner:** diagonal opposite the dragged handle stays fixed in XZ.
4. Live-update mesh; **commit on pointerup**:
   - `plane` → `world.setField(id, 'Ground', 'size', newSize)` where `newSize = max(|Δx|, |Δz|)` from pinned center (square v1).
   - `box` → compute new `Transform.scale` from corner delta relative to anchor (per-axis).
   - `uniform` → `scale' = uniform * (distance / startDistance)`.

**Visual:** match `SelectionFootprints` / `GridCellHighlight` — semi-transparent fill + dashed border during drag.

### `GroundView.svelte`

- Remove generic `EntityTransformControls` scale path for ground.
- When selected + `plane` profile: mount `CornerResizeHandles` (size target) + `EntityTransformControls` with **XZ translate only** (or custom `PlaneMoveControls`).
- Toolbar: force `translate` mode when ground selected.

### `MeshView` / `PhysicsBody`

- When profile `box` and selected: mount `CornerResizeHandles` instead of scale gizmo if `ui.transformGizmoMode === 'scale'`, **or** replace scale mode entirely with corners for `box` profile.

### Files

| File | Change |
| ---- | ------ |
| `src/lib/scene/CornerResizeHandles.svelte` | **New** — shared corner drag widget |
| `src/lib/engine/render/transformProfile.ts` | **New** — profile resolver |
| `src/lib/scene/groundResize.ts` | **New** — pinned-corner math, snap, clamp |
| `src/lib/scene/boxResize.ts` | **New** — scale from corner drag |
| `GroundView.svelte` | Plane profile: corners + XZ move |
| `TransformToolbar.svelte` | Hide rotate/scale for `plane`; optional hide scale for `box` |
| `shellKeyboard.ts` | Ground nudge: zero ΔY |
| `EntityTransformControls.svelte` | Optional axis mask for plane translate |

---

## Phase 3b — Ground collider sync (TRL-98 alignment)

### Registry

```ts
registerType({
  name: 'GroundPlane',
  components: ['Transform', 'Ground', 'Physics'],
  defaults: {
    Physics: { body: 'fixed', collider: 'box', friction: 0.9, restitution: 0 }
  }
});
```

Existing world files without `Physics` on ground instances: **merge type defaults on load** (existing `conformsTo` resolution) OR one-time inject in `loadOntology` when `Ground` present and `Physics` absent. Prefer engine merge so `parkour.jsonld` picks up collider without hand-editing every file.

### `GroundView.svelte` + `PhysicsBody`

- Wrap ground mesh in `PhysicsBody` (same pattern as `Platform`).
- Collider: analytic **box** with half-extents `[size/2, 0.075, size/2]` in local space (thin slab).
- Mesh plane remains `PlaneGeometry(size, size)` at `y = 0` local; collider centered so **top face ≈ y = 0** (walk surface).
- On `Ground.size` change: refresh collider (Rapier `collider.setHalfExtents` or remount).

### `WorldScene.svelte`

- Shadow-catcher `T.Mesh` (50×50): **receiveShadow only**, no physics collider.
- If `world.query('Ground').length > 0`, do not add implicit floor collider (document in AGENTS.md).

### Verification link (TRL-98)

From [character_controller_ground_spec.md](./character_controller_ground_spec.md):

| Check | After this wedge |
| ----- | ---------------- |
| Player rests on floor cuboid | Player stands on **`GroundPlane` collider** sized to `Ground.size` |
| `groundStore.grounded` toggles | Shape cast hits ground slab + platforms |
| `?game=parkour` | Main floor at `entity:ground/main` is walkable; platforms unchanged |

**Does not change:** `GroundSensor` algorithm, `groundStore` shape, kinematic player body — only collision geometry authors see.

---

## Phase 3c — Platform box corners (parkour)

Parkour `Platform` type already has `Physics: fixed, box`. Corner resize writes `Transform.scale`; `PhysicsBody` syncs collider (post double-scale fix).

**Acceptance:** Select `entity:platform/finish` → drag corner → mesh and collider grow together → play mode → player collision matches visual.

---

## Sequencing

```
3a CornerResizeHandles + plane profile (Ground.size only)
  ↓
3b GroundPlane Physics + collider from size (TRL-98 floor)
  ↓
3c Box profile corners on Platform/Prop (parkour authoring)
```

3a and 3b can ship in one PR if small; 3c reuses the same widget.

**Relative to character controller phases:**

| CC phase | This wedge |
| -------- | ---------- |
| TRL-97/98 Ground detection | **3b required** for reliable floor verification |
| TRL-99+ Jump feel | No direct dependency |
| TRL-101 Slope movement | Reinforces **Platform for ramps**, not tilted `GroundPlane` |
| TRL-105 Platform velocity | Moving/resizing platforms in edit mode already updates fixed bodies |

---

## Acceptance criteria

### 3a — Ground corners (edit)

1. Select `GroundPlane` in edit mode → four corner handles appear; **no** rotate/scale toolbar modes.
2. Drag corner → `Ground.size` updates on mouseup; grid fade and plane mesh match.
3. Arrow nudge on ground moves XZ only.
4. `Ground.size` snaps to `ui.grid.cellSize` when editor grid enabled.
5. `pnpm check` passes.

### 3b — Collider sync (play)

1. `?game=parkour` → play mode → player stands on main ground (not fall-through at edges within `size`).
2. Edit mode: resize ground corners → play mode → walkable area matches new size (within one reload/HMR).
3. `groundStore.grounded` true when standing on ground entity (debug overlay / console).
4. No duplicate floor collision from `WorldScene` shadow mesh.

### 3c — Platform corners

1. Select parkour platform → corner resize changes `Transform.scale`; gizmo move/rotate still work.
2. Play mode: player collides with resized platform edges.

---

## Verification

```bash
pnpm check
# Edit: ?game=parkour → select ground → corner drag → inspector Ground.size changes
# Play:  same world → spawn → WASD on ground + platforms
# CC:    groundStore.grounded toggles when walking off platform edge (after TRL-98)
```

Optional e2e: `e2e/ground-resize.spec.ts` — select ground, drag corner handle, assert `Ground.size` field in inspector.

---

## Non-goals (explicit)

- `Ground.size` as `vec2` (non-square arenas) — scalar square v1 only
- Rotate `GroundPlane` on Y (oriented rectangular arenas) — use child platforms or defer
- Corner handles on arbitrary glTF meshes (use scale gizmo + bounds cache later)
- Replacing `Platform` type with tilted `Ground` for ramps

---

## TRL issue suggestion

| ID | Title | Blocks |
| -- | ----- | ------ |
| TRL-TBD-spec | Transform profiles + ground collider sync | — |
| TRL-TBD-impl | Corner resize + GroundPlane Physics | spec above |
| TRL-98 | Ground detection impl | benefits from 3b for floor AC |

Update [transform_tools_spec.md](./transform_tools_spec.md) Phase 3 section to link here.
