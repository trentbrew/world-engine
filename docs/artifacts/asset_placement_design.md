---
version: alpha
name: Asset Placement — Shapes + Scene Ghost Drop
description: Design artifact for TRL-55 — Shapes catalog, pointer placement session, viewport ghost, grid snap + cell highlight; unified for primitives and models
colors:
  viewport: "#1c1c1c"
  surface: "#252525"
  surface-raised: "#2e2e2e"
  surface-overlay: "#363636"
  surface-glass: "color-mix(in srgb, #363636 72%, transparent)"
  text: "#e4e4e4"
  text-muted: "#949494"
  text-mono: "#b0b0b0"
  primary: "#ff6b6b"
  accent-entity: "#5b9fd4"
  accent-placement: "#5b9fd4"
  accent-placement-muted: "color-mix(in srgb, #5b9fd4 22%, transparent)"
  accent-placement-border: "color-mix(in srgb, #5b9fd4 55%, #a3a3a3)"
  border: "#3d3d3d"
  border-focus: "#a3a3a3"
  ghost-wireframe: "#5b9fd4"
  ghost-fill: "color-mix(in srgb, #5b9fd4 18%, #1c1c1c)"
  cell-highlight: "color-mix(in srgb, #5b9fd4 20%, transparent)"
  cell-highlight-border: "color-mix(in srgb, #5b9fd4 65%, transparent)"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  section:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.04em
    textTransform: uppercase
  shape-label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 400
  placement-hint:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 400
rounded:
  sm: 4px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  float-inset: 16px
  panel-width: 240px
components:
  shapes-section:
    order: first
    defaultOpen: true
    gridColumns: 3
    gap: 6px
  shape-tile:
    minHeight: 72px
    padding: 6px
    border: "1px solid color-mix(in srgb, {colors.border} 55%, transparent)"
    background: "color-mix(in srgb, {colors.viewport} 35%, transparent)"
    thumbHeight: 48px
  shape-tile-armed:
    border: "1px solid {colors.accent-placement-border}"
    background: "{colors.accent-placement-muted}"
  placement-ghost:
    opacity: 0.72
    wireframe: true
    depthWrite: false
    emissive: "{colors.ghost-wireframe}"
  cell-highlight:
    size: "ui.grid.cellSize × ui.grid.cellSize"
    y: 0.025
    fill: "{colors.cell-highlight}"
    border: "1px dashed {colors.cell-highlight-border}"
  placement-banner:
    position: viewport-top-center
    typography: "{typography.placement-hint}"
    background: "{colors.surface-glass}"
---

# Design: Asset Placement — Shapes + Scene Ghost Drop

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-55 (Proposal: Asset placement shapes + scene ghost drop)  
**Mock:** [asset_placement_mockup.html](./asset_placement_mockup.html)  
**Inherits:** [left_scene_panel_simplification_design.md](./left_scene_panel_simplification_design.md), AppShell tokens (`app.css`)

---

## Overview

Authors need to **spawn props from the Assets tab onto the scene** without opening dialogs or manually typing mesh URLs. This design adds a **Shapes** catalog at the top of the Assets tab and a **pointer placement session** that works identically for primitives and imported models: a ghost preview follows the cursor on the ground plane, the active grid cell highlights, and click commits a new `Prop` entity.

**Audience:** builder-engineer in **edit mode**.

**Tone:** tactile authoring — the library becomes a palette, the viewport becomes the canvas. Placement should feel immediate and reversible (Esc cancel).

**Out of scope (v1):** rotation while placing, stack-on-surface / Y snap, HTML drag-and-drop from panel DOM into WebGL canvas, textures/audio placement.

---

## Colors

Reuse AppShell tokens. Placement-specific accents derive from `--accent-entity` (`accent-placement` in YAML) so ghost + cell highlight read as **authoring affordance**, not selection outline or play-mode chrome.

| Role | Token | Usage |
| ---- | ----- | ----- |
| Armed tile | `accent-placement-muted` + border | Shape/model tile selected for placement |
| Ghost mesh | `ghost-wireframe` wireframe + optional `ghost-fill` | Viewport preview before commit |
| Cell highlight | `cell-highlight` fill + dashed border | Floor quad at snapped cell |
| Placement banner | `surface-glass` + `placement-hint` text | "Click to place · Esc to cancel" |

---

## Typography

- **Section header:** existing mono uppercase 10px (`InspectorAccordion` — "SHAPES").
- **Shape labels:** 10px mono under thumbnail ("Box", "Sphere", "Capsule").
- **Placement banner:** 11px UI sans, muted until armed then `accent-entity`.

---

## Layout

### Assets tab IA (normative order)

```
┌─ Assets tab ─────────────────────────────────────┐
│ ASSETS                          [list | grid]      │
│ (pick hint when assetPickTarget set)             │
├──────────────────────────────────────────────────┤
│ ▾ SHAPES                    (no + button)        │
│   [ Box ] [ Sphere ] [ Capsule ]  ← 3-col grid     │
│ ▾ MODELS                              [+]          │
│   …existing asset grid…                            │
│ ▸ TEXTURES                            [+]          │
│ ▸ AUDIO                               [+]          │
└──────────────────────────────────────────────────┘
```

**Shapes** is always first, default **open**, **static catalog** (no upload). **Models / Textures / Audio** unchanged except models gain the same placement affordance as shapes (see Interaction).

### Viewport overlay (during placement)

```
┌─ Viewport ─────────────────────────────────────────┐
│  [ Click to place · Esc to cancel ]  ← banner      │
│                                                    │
│         ┌ ─ ─ ─ ─ ┐  ← cell highlight (1×1)      │
│           ▢ ghost                                  │
│         └ ─ ─ ─ ─ ┘                                │
│  ·····················  ground grid                │
└────────────────────────────────────────────────────┘
```

Banner sits top-center inside viewport float inset; does not block orbit gizmo.

---

## Elevation & Depth

- Shape tiles: same card elevation as `AssetItem` grid cards.
- Cell highlight: `renderOrder` above ground grid, below ghost mesh.
- Ghost: no shadows, `depthWrite: false`, renders above grid highlight.
- Placement banner: glass panel, `z-index` above canvas UI chrome but below modals.

---

## Shapes

| Primitive | `Render.mesh` | Thumbnail | Default color |
| --------- | ------------- | --------- | ------------- |
| Box | `primitive:box` | 1×1×1 solid preview | `#d4d4d4` (registry default) |
| Sphere | `primitive:sphere` | sphere preview | `#d4d4d4` |
| Capsule | `primitive:capsule` | capsule preview | `#d4d4d4` |

Thumbnails match existing `AssetThumbnail` md grid sizing (72px thumb area, `object-fit: contain`).

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **ShapesSection** | `InspectorAccordion` "Shapes" + 3-col grid of shape tiles | default, **armed**, hover, focus | New snippet in `AssetsPanel.svelte` or `ShapesSection.svelte` |
| **ShapeTile** | button: thumb + label | idle, hover, **armed**, disabled (pick mode / play / uploading) | Extends `AssetItem` pattern or shared tile primitive |
| **AssetTile (models)** | existing `AssetItem` | + **armed** when starting placement from model | `AssetItem.svelte` |
| **PlacementBanner** | fixed viewport hint strip | hidden, **active** | New `PlacementBanner.svelte` in viewport shell |
| **PlacementGhost** | Threlte mesh/group at raycast position | primitive wireframe, model bbox, model loaded | New `src/lib/scene/PlacementGhost.svelte` |
| **GridCellHighlight** | 1×1 plane at snapped cell | hidden, **active** | New `src/lib/scene/GridCellHighlight.svelte` |
| **PlacementController** | pointer listeners + raycast + snap | idle → armed → tracking → commit/cancel | New module e.g. `src/lib/scene/placementSession.ts` + `ui.placementDraft` |

---

## Interaction matrix

| Input | Precondition | Action | Output |
| ----- | ------------ | ------ | ------ |
| Click shape tile | edit mode, not pick mode | Arm placement (`placementDraft = { mesh: primitive:* }`) | Tile armed styling; banner shown; cursor crosshair over viewport |
| Click model tile | edit mode, not pick mode | Arm placement (`placementDraft = { mesh: url, anchor: 'bottom' }`) | Same as shape |
| Click shape/model tile | **pick mode active** | Existing pick flow (apply to field) | **No** placement arm |
| Pointer move over viewport | placement armed | Raycast ground plane (y=0); snap X/Z to `ui.grid.cellSize` when `ui.chrome.grid` | Ghost + cell highlight follow snapped position |
| Pointer move over viewport | placement armed, grid off | Raycast ground; **no snap** (free X/Z, 0.1m quantize optional — defer to Architect) | Ghost at hit point; no cell highlight |
| Click viewport (primary) | placement tracking | Commit: spawn `Prop`, select entity, clear draft | Toast "Placed Box" / entity id |
| Esc | placement armed | Cancel draft | Restore idle; clear ghost/highlight |
| Click outside viewport / panel | placement armed | **No cancel** (stay armed until Esc or commit) | — |
| Pointer down on viewport + drag >4px | placement tracking | Orbit/pan takes precedence; **do not commit** on pointerup | Same threshold as `viewportPick.ts` |
| Enter play mode | any | Force cancel placement | — |
| Upload `+` on Models | — | Unchanged file upload | — |

### Placement session state machine

```
idle ──(click tile)──► armed ──(pointer enters viewport)──► tracking
  ▲                        │                                    │
  │                        └── Esc ──────────────────────────────┤
  │                                                              │
  └──────── Esc / commit ◄───────────────────(click viewport)────┘
```

**Normative:** Use **pointer session**, not HTML5 `draggable` across panel → canvas. Optional polish: pointer-down on tile + immediate move to viewport enters tracking without second click (Architect may implement as v1 if raycast hook is cheap).

### Spawn defaults (UX contract — Architect encodes)

| Source | `conformsTo` | `Render.mesh` | `Render.anchor` | `Transform.position.y` |
| ------ | ------------ | ------------- | --------------- | ------------------------ |
| Box / Sphere / Capsule | `Prop` | `primitive:*` | `origin` (default) | snapped cell center on floor (y = 0.5 for unit box center) |
| Model (.glb) | `Prop` | asset URL | `bottom` | snapped X/Z; y from anchor (feet on floor) |

Entity id pattern: `entity:prop/<slug>` with auto-increment suffix (same family as paste ids).

Auto-select spawned entity; switch left tab to **Objects** optional — **defer v1** (stay on Assets unless pick mode was active).

---

## Accessibility

- **Focus order:** Assets tab → shape tiles (DOM order) → viewport is not focus-trapped; banner is `role="status"` `aria-live="polite"`.
- **Labels:** Shape tiles `aria-label="Place box on scene"`; armed tile `aria-pressed="true"`.
- **Esc:** Global cancel while `placementDraft !== null` (edit mode only); announce "Placement cancelled" in live region.
- **Motion:** Cell highlight and ghost snap instant (no spring v1). Respect `prefers-reduced-motion`: skip pulse on cell border if added later.
- **Keyboard (stretch):** Enter to commit at last snapped position — **optional v1.1**; document only, not AC.

---

## Do's and Don'ts

**Do**

- Reuse peer-player wireframe ghost material pattern from `MeshView.svelte`.
- Raycast against existing ground pick plane in `WorldScene.svelte`.
- Read snap cell size from `ui.grid.cellSize` when reference grid visible.
- Disable placement in play mode and during asset pick mode.
- Show cell highlight only when grid snap is active.

**Don't**

- Use HTML drag-and-drop from panel to canvas as the primary interaction.
- Spawn entities on pointerdown (conflicts with orbit controls).
- Block orbit when placement is armed but user hasn't moved to viewport yet.
- Add upload affordance to Shapes section.
- Change pick-to-field behavior for textures/audio.

---

## Open for Architect

1. **Y position for primitives:** center of unit box at `y=0.5` vs bottom at `y=0` — recommend **center at half-height** for box/sphere/capsule so they sit on grid visually (capsule/sphere radii differ — use mesh bounds).
2. **Free placement quantize:** when grid off, snap to 0.1m or fully free — recommend **0.1m quantize** for consistency.
3. **Durable spawn op:** `world.spawn` is RAM-only today; spec durable entity-create patch (host-only) as part of this wedge or explicit follow-up AC.
4. **glTF ghost loading:** bbox wireframe until load completes; timeout fallback to box proxy.
5. **Concurrent armed tile:** only one `placementDraft` at a time; clicking another tile replaces draft.

---

## Handoff checklist

- [x] `docs/artifacts/asset_placement_design.md` (this file, DESIGN.md format)
- [x] `docs/artifacts/asset_placement_mockup.html` (self-contained; CSS vars mirror YAML tokens)
- [ ] Trellis design child TRL-55-D on graph (CLI write failed in strategist pass — Architect may link manually)
