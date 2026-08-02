---
version: alpha
name: Spline-Inspired Authoring Shell
description: Design artifact — consolidates floating_chrome + play_mode into Spline-adjacent viewport-first shell; center tool pill, left Objects|Assets panel, right scene/entity inspector, bottom view bar
colors:
  viewport: "#0c0c10"
  viewport-grid: "#1a1524"
  surface: "#131318"
  surface-raised: "#1a1a22"
  surface-overlay: "#22222c"
  surface-glass: "color-mix(in srgb, #22222c 68%, transparent)"
  text: "#ececf2"
  text-muted: "#8b8b9c"
  text-mono: "#a8a8bc"
  primary: "#7b6df0"
  primary-foreground: "#f4f2ff"
  primary-muted: "color-mix(in srgb, #7b6df0 18%, transparent)"
  accent-play: "#7b6df0"
  accent-play-foreground: "#f4f2ff"
  accent-selection: "#5b9fd4"
  accent-entity: "#9d94f5"
  accent-link: "#6b8afd"
  success: "#6ee7a8"
  destructive: "#f87171"
  border: "#2a2a38"
  border-focus: "#7b6df0"
  ring: "#7b6df0"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.05em
    textTransform: uppercase
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  doc-bar-height: 36px
  tool-pill-height: 44px
  left-panel-width: 240px
  right-panel-width: 280px
  view-bar-height: 36px
  float-inset: 12px
  panel-gap: 10px
components:
  doc-bar:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.border}"
    height: "{spacing.doc-bar-height}"
    position: docked-top
  tool-pill:
    backgroundColor: "{colors.surface-glass}"
    backdropFilter: blur(20px)
    border: "1px solid color-mix(in srgb, {colors.border} 60%, transparent)"
    borderRadius: "{rounded.pill}"
    height: "{spacing.tool-pill-height}"
    boxShadow: "0 8px 32px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.04)"
  left-panel:
    extends: tool-pill
    borderRadius: "{rounded.lg}"
    width: "{spacing.left-panel-width}"
  right-panel:
    extends: left-panel
    width: "{spacing.right-panel-width}"
  view-bar:
    extends: tool-pill
    borderRadius: "{rounded.pill}"
    height: "{spacing.view-bar-height}"
  play-button:
    backgroundColor: "{colors.accent-play}"
    color: "{colors.accent-play-foreground}"
    borderRadius: "{rounded.pill}"
    height: 32px
    minWidth: 88px
    fontWeight: 600
  play-button-active:
    backgroundColor: "{colors.surface-overlay}"
    color: "{colors.text}"
    border: "1px solid {colors.border}"
  tab-active:
    color: "{colors.text}"
    borderBottom: "2px solid {colors.primary}"
  tree-row-selected:
    backgroundColor: "{colors.primary-muted}"
    color: "{colors.text}"
---

# Design: Spline-Inspired Authoring Shell

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-28 (Proposal: Spline-inspired authoring shell — pending graph queue)  
**Mock:** [spline_authoring_shell_mockup.html](./spline_authoring_shell_mockup.html)  
**Supersedes:** [floating_chrome_shell_design.md](./floating_chrome_shell_design.md), [play_mode_controls_shell_design.md](./play_mode_controls_shell_design.md) (spatial + token direction; popover contents carry forward)

---

## Overview

Trent asked to **lean into Spline's UI/UX** as the north star. Spline treats the 3D canvas as the product; chrome is minimal, floating, and soft. This artifact consolidates prior floating/play-mode work into one coherent shell that matches Spline's **spatial logic** while staying faithful to our **data-first engine** (entities, components, JSON-LD worlds — not Spline's object/material model).

**Brand posture:** creative 3D tool, not IDE panel stack. Violet accent signals "active / go" without the generic green-play trope from prior artifacts.

**Audience:** builder-engineer authoring worlds in JSON-LD; needs fast edit ↔ play, hierarchy browsing, component inspection.

**Signature element:** **center-top tool pill** with violet Play CTA — the one control cluster always visible, mirroring Spline's floating toolbar.

**Non-goals (v1):** transform gizmos (move/rotate/scale), vector/2D tools, timeline, material node editor, multi-document tabs beyond game switcher, Share/Export actions (placeholder labels OK).

## Colors

Extends `app.css` dark tokens with a **violet-forward accent system** inspired by Spline's purple UI chrome.

| Token | Role |
| ----- | ---- |
| `viewport` / `viewport-grid` | Near-black canvas; grid carries subtle purple undertone |
| `primary` / `accent-play` | Violet `#7b6df0` — active tabs, Play CTA, focus rings |
| `primary-muted` | Selected tree row wash |
| `accent-selection` | Entity type dots, secondary highlights |
| `surface-glass` @ 68% | All floating panels — slightly more opaque than prior 42% for Spline-like legibility |

Play and primary accent **share violet** — Play is prominent via filled pill shape + center placement, not a second color.

## Typography

Unchanged stack: **DM Sans** UI, **JetBrains Mono** for entity ids and file names. Section headers in panels use uppercase 11px labels (`typography.label`).

Doc bar uses 13px semibold for active world tab; muted 12px for inactive tabs.

## Layout

### Desktop (≥768px) — Edit mode

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ● collect.jsonld   orbit.jsonld   tower.jsonld          ★ 12   100%   │ doc bar
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐                              ┌──────────────┐            │
│ │ Objects│Assets│ search…                   │ Scene / Entity│            │
│ │ ▾ Scene     │         ┌─────────────────┐  │ Grid ✓       │            │
│ │   Ground    │         │  🎯  📷  ▶ Play  │  │ Camera       │            │
│ │   Player    │         └─────────────────┘  │ Simulation   │            │
│ │   Coin/1    │              tool pill       │ …            │            │
│ └─────────────┘                              └──────────────┘            │
│  left panel                                      right panel             │
│                                                                          │
│                         VIEWPORT (full bleed)                            │
│                                                                          │
│                    ┌ Perspective │ Orthographic ┐                          │
│                    └──────────────── view bar ─┘                         │
│                                                      [ stats HUD ]       │
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | Position | Visible (edit) |
| ------ | -------- | -------------- |
| **Doc bar** | docked top, 36px | always — game/world tabs, score chip, zoom readout |
| **Tool pill** | float top-center, below doc bar + inset | always — nav shortcuts + **Play** |
| **Left panel** | float top-left | always in edit — Objects \| Assets tabs |
| **Right panel** | float top-right | always in edit — Scene OR Entity inspector |
| **View bar** | float bottom-center | always — perspective toggle (+ future gizmo) |
| **Stats HUD** | float bottom-right | always — telemetry |

**Key topology change from prior artifacts:** remove docked `WorldToolbar` and separate left **icon rail** + right **controls pill**. Left/right **full panels** replace rail+sidebar split. Camera/orbit/input from `ControlsPill` popovers migrate to **right Scene panel sections** and **view bar**.

### Play mode

- **Hide:** left panel, right panel
- **Keep:** doc bar (game switch + score), center tool pill (Stop), view bar, stats HUD
- **Play pill:** `◼ Stop` — muted outline on glass (not destructive red)
- Camera/Input adjustments: view bar + optional compact popover from tool pill camera icon

### Mobile (<768px)

- Doc bar: single active game title + overflow menu for game list
- Left panel → bottom sheet (Objects default)
- Right panel → bottom sheet on selection
- Tool pill → compact center strip (Play + camera icon only)
- Defer polish; ship desktop-first per prior artifacts

## Elevation & Depth

| Layer | Treatment |
| ----- | --------- |
| Doc bar | flat dock, 1px bottom border — only persistent "frame" |
| Tool pill, panels, view bar | glass + blur(20px) + soft shadow |
| Popovers (if retained for camera quick actions) | solid `surface-overlay`, no blur-through |
| Viewport | deepest — no border; grid at 40% opacity |

Inset hierarchy: panels float **above** viewport; tool pill **above** panels (z-index 25).

## Shapes

| Element | Spec |
| ------- | ---- |
| Tool pill | 44px tall, `rounded.pill`, horizontal icon row |
| Panels | `rounded.lg` (14px), not full pill — readable content corners |
| Play button inside pill | 32px tall violet fill, pill radius |
| Tab underline | 2px `primary` on active Objects/Assets |
| Tree rows | 28px min height, `rounded.sm` |
| View bar | 36px pill, segmented control inside |

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **DocBar** | game tabs + score + zoom | active tab, hover | new; absorbs `GameMenubar` game list |
| **ToolPill** | camera shortcut, orbit shortcut, **Play** | edit / play, popover open | replaces `WorldToolbar` + `PlayModeButton` placement |
| **LeftPanel** | tab bar + search + scroll body | Objects / Assets | replaces `WorldRail` + conditional sidebar |
| **ObjectsTab** | hierarchy tree + Add entity | row selected, expanded groups | `EntityList.svelte` restyled |
| **AssetsTab** | mesh/primitive library | pick mode | `AssetsPanel.svelte` |
| **RightPanel** | accordion sections | scene vs entity context | new shell wrapping `EntityAttributes` |
| **SceneInspector** | grid, camera default, sim toggles | no selection | new — scene-level fields |
| **EntityInspector** | component fields | entity selected | `EntityAttributes.svelte` |
| **ViewBar** | persp/ortho segmented + axis stub | orbit mode only | new; partial `OrbitPopover` / `CameraPopover` |
| **WorldStatsHud** | FPS, entities, net | always | `WorldStatsHud.svelte` |
| **SettingsSheet** | input mappings | modal from Scene panel link | `SettingsPanel.svelte` — not rail route |

### Doc bar — game / world switcher

- **Tabs:** one per entry in `GAMES` catalog + "default world" when no `?game=`
- **Active tab:** underline + brighter text; click loads game (`loadGame`)
- **Score chip:** when `score.value > 0`, left of zoom (from Collect game)
- **Zoom readout:** static "100%" v1 (placeholder for future canvas scale)
- **Remove:** separate top-right `GameMenubar` float

### Tool pill — center-top cluster

Horizontal glass pill, centered `top: doc-bar-height + float-inset`.

| Slot | Icon | Action |
| ---- | ---- | ------ |
| Camera | `video` | quick popover: Orbit / Follow, Reset (from `CameraPopover`) |
| Navigation | `orbit` | quick popover: sensitivity sliders (from `OrbitPopover`) |
| **Play** | play/stop | toggle `ui.shellMode` — **violet fill**, rightmost in cluster |

Future: select/move/rotate stubs disabled with tooltip "Coming soon".

### Left panel — Objects | Assets

Fixed width 240px, full height minus doc bar and insets. **No separate icon rail.**

| Tab | Body |
| --- | ---- |
| **Objects** | Search filter + flat/tree entity list grouped under "Scene" root |
| **Assets** | `AssetsPanel` content — primitives + uploaded meshes |

**Search:** filters entity list by id substring; empty state "No matches".

**Add entity:** footer button (existing `AddEntityDialog` trigger).

Settings **removed from left rail** → link in Scene inspector ("Open settings…").

### Right panel — Scene vs Entity

Fixed width 280px. **Always visible in edit mode** (collapse chevron optional v2).

| Context | Header | Sections |
| ------- | ------ | -------- |
| **No selection** | "Scene" | Viewport (bg color read-only v1), Play camera, Grid, Simulation, link to Settings |
| **Entity selected** | short id + type | `EntityAttributes` accordion — Transform, Render, components |

When user selects entity in viewport or tree, right panel switches to Entity inspector without animation flash (crossfade 120ms).

### View bar — bottom center

- Segmented: **Perspective** | **Orthographic** (maps to camera projection stub — Architect may wire or stub)
- Small axis gizmo placeholder (12×12px colored axes) — non-interactive v1
- Orbit popover sliders **move here** as expandable "Navigation" section OR stay in tool pill popover (Architect: pick one; mock shows segmented in bar)

### Play mode behavior

Unchanged semantics from play_mode artifact:

- `P` toggles; Esc exits play (after closing popover)
- Enter play: hide left/right panels, clear selection, snapshot chrome
- Exit play: restore panels + selection snapshot
- Tool pill stays; Play → Stop

## Interaction matrix

| Input | Context | Output |
| ----- | ------- | ------ |
| Click game tab | doc bar | `loadGame(param)` |
| Click **Play** | edit | enter play mode; hide side panels |
| Click **Stop** | play | exit play mode; restore panels |
| `P` key | not in text field | toggle play |
| Objects tab | edit | show entity tree |
| Assets tab | edit | show asset library |
| Click entity row | edit | select entity; right panel → Entity |
| Click empty viewport | edit | deselect; right panel → Scene |
| Search typing | Objects tab | filter list |
| Perspective / Ortho | view bar | set camera projection (stub OK) |
| Camera popover | tool pill | orbit/follow/reset |
| Esc | popover open | close popover |
| Esc | play, no popover | exit play |
| Panel collapse | edit | hide panel until toggled from tool pill "Panels" menu (v2) |

**Motion:** panel show/hide 180ms opacity+translate; play mode crossfade; `prefers-reduced-motion` → instant.

## Accessibility

- **Focus order:** skip-link → doc bar tabs → tool pill → left panel → right panel → view bar → stats
- **Play/Stop:** `aria-pressed`; live region announces mode change
- **Left tabs:** `role="tablist"` / `role="tab"` / `aria-selected`
- **Entity tree:** `role="tree"` / `treeitem`; arrow keys navigate hierarchy
- **View bar segmented control:** `role="tablist"` with roving tabindex
- **Play mode:** Stop reachable via keyboard without hidden panels
- **Contrast:** violet Play text on `#f4f2ff` ≥ 4.5:1; muted text on glass ≥ 3:1 for labels

## Do's and Don'ts

**Do**

- Keep viewport full-bleed under all chrome
- Use violet accent consistently for active + Play (Spline-like cohesion)
- Show Scene inspector when nothing selected (Spline pattern)
- Consolidate game switcher into doc bar tabs
- Carry forward popover **contents** from ControlsPill even if containers move

**Don't**

- Restore docked full-width toolbar
- Keep separate left icon rail + sidebar (Spline uses one left panel)
- Hide right panel entirely when deselected (Scene settings fill that slot)
- Ship transform tools without engine support
- Fork a fourth parallel token palette — migrate `app.css` to these tokens

## Open for Architect

1. **AppShell grid:** drop `grid-template-rows: toolbar` — doc bar is only docked row; viewport is row 2 full bleed.
2. **State:** `ui.leftTab: 'objects' | 'assets'` replaces `railRoute` for sidebar content; `settings` becomes modal/sheet, not rail.
3. **Right panel always open:** change `showAttributes` guard — show when `ui.chrome.inspector` regardless of selection; swap Scene vs Entity content.
4. **ControlsPill fate:** deprecate or reduce to tool-pill popover anchors — confirm no duplicate camera UI.
5. **Orthographic camera:** new `camera.projection` field or stub toggle with toast "Not wired"?
6. **Token migration:** update `app.css` `:root` to violet system — breaking change to green play; intentional.
7. **Phasing:** PR1 layout topology (panels + doc bar); PR2 token pass; PR3 view bar projection; PR4 deprecate WorldRail/ControlsPill files.
8. **1280px budget:** left 240 + right 280 + insets — confirm tool pill doesn't collide on narrow desktop.

## Handoff checklist

- [x] `docs/artifacts/spline_authoring_shell_design.md` (this file)
- [x] `docs/artifacts/spline_authoring_shell_mockup.html`
- [ ] Trellis design issue + `describe` SUMMARY (CLI create failed — queue manually)
