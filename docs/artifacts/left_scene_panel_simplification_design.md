---
version: alpha
name: Left Scene Panel Simplification
description: Design artifact — reduce Scene tab density, tiered accordion IA, 80vh scroll cap on left float panel
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
  border: "#3d3d3d"
  border-focus: "#a3a3a3"
  scroll-fade: "linear-gradient(to bottom, transparent, #252525)"
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
  field-label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
rounded:
  sm: 4px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  float-inset: 16px
  panel-width: 240px
  tab-height: 40px
components:
  left-panel:
    maxHeight: "min(80vh, calc(100dvh - 2 * {spacing.float-inset} - 48px))"
    width: "{spacing.panel-width}"
    background: "{colors.surface-glass}"
  panel-tabs:
    height: "{spacing.tab-height}"
    flexShrink: 0
  panel-scroll:
    overflowY: auto
    flex: 1
    minHeight: 0
  accordion-trigger:
    typography: "{typography.section}"
    padding: "10px 0"
  grid-segment:
    height: 28px
    background: "{colors.surface-raised}"
---

# Design: Left Scene Panel Simplification

**Status:** Design complete (handoff to Architect)  
**Parent:** Proposal pending on graph (Left scene panel simplification — Strategist 2026-06-19)  
**Mock:** [left_scene_panel_simplification_mockup.html](./left_scene_panel_simplification_mockup.html)  
**Inherits:** [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md), [spline_authoring_shell_design.md](./spline_authoring_shell_design.md)

---

## Overview

The **Scene** tab of the left float panel (`LeftPanel` → `SceneInspector`) has grown to **10 accordion sections**, all **open by default**, producing a tall dense scroll surface that fights the viewport-first shell. This design **re-tiers information**, **merges duplicate grid controls**, **removes placeholder noise**, and caps panel height at **~80vh** with an obvious scroll region — without removing any live capability.

**Audience:** builder-engineer authoring worlds in edit mode.

**Tone:** precision instrument panel — fewer headings, clearer tiers, progressive disclosure.

**Out of scope:** Right panel, doc-bar collaboration chrome, Objects/Assets content redesign (only shared scroll/height rules).

## Colors

Reuse AppShell tokens (`--surface`, `--text-muted`, `--border`). Scroll region may show a **bottom fade** (`scroll-fade`) when `scrollHeight > clientHeight` — decorative only, `pointer-events: none`.

## Typography

- **Section headers:** existing mono uppercase 10px (`inspector-trigger`) — unchanged.
- **Grid sub-segment labels:** 11px UI sans, sentence case ("Reference", "On ground").
- **Developer footnote:** 11px muted hint for read-only tables.

## Layout

```
┌─ LeftPanel (max-height: min(80vh, viewport budget)) ─────┐
│ [ Scene | Objects | Assets ]  ← tabs, flex-shrink: 0     │
├──────────────────────────────────────────────────────────┤
│ ▾ scroll body (overflow-y: auto, flex: 1)                │
│   Essentials (open)                                        │
│   Environment (open)                                       │
│   ▸ Play mode                                              │
│   ▸ Grids  → [ Reference | On ground ]                     │
│   ▸ Selection                                              │
│   ▸ Developer                                              │
└──────────────────────────────────────────────────────────┘
```

### Height rule (normative)

Apply on **`.left-panel`** (not only Scene tab body):

```css
max-height: min(80vh, calc(100dvh - var(--float-inset) * 2 - var(--view-controls-height, 48px)));
```

`AppShell` `.panel-shell` continues `max-height: inherit`. Objects/Assets tabs share the same cap; entity list scrolls inside `panel-body`.

### Default accordion state

| Section | Default | Rationale |
| ------- | ------- | --------- |
| Essentials | **open** | Name + background — daily edits |
| Environment | **open** | Sky + shadows — visual context |
| Play mode | closed | Play-test preference, infrequent |
| Grids | closed | Power-user tuning |
| Selection | closed | Toggle + future collab-adjacent fields |
| Developer | closed | Read-only / debug |

Persist open sections in `sessionStorage` key `left-panel:scene-sections` (Architect decision — optional v1).

## Elevation & Depth

Glass panel unchanged (`glass-panel`). Accordion dividers stay low-contrast (`border 20%` mix). No new shadows.

## Shapes

Grid inner **segmented control** uses existing `ToggleGroup` outline variant — full width, 28px height, matches Play camera control.

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **LeftPanel** | tabs + scroll body | Scene / Objects / Assets | `LeftPanel.svelte` — add `max-height` |
| **SceneInspector** | 6 accordion items | multiple open | `SceneInspector.svelte` — restructure |
| **Essentials** | name, background | expanded | merges Scene + Viewport |
| **Environment** | sky enabled → preset/env, shadows | sky fields conditional | merges Sky + Lighting |
| **Play mode** | Follow \| Orbit toggle | single select | was `play-camera` |
| **Grids** | segment + fields | Reference vs On ground | merges `reference-grid` + `ground-grid` |
| **Selection** | selection outline boolean | — | was `selection`; collab stays doc-bar |
| **Developer** | stats HUD; collapsible "Reference" block | Input table, camera defaults | was `advanced` + `simulation` removed |

### Grids merge (interaction)

Inside **Grids** accordion:

1. **Segment:** `Reference` | `On ground` (`ui.sceneGridTab` or local `$state`).
2. **Reference** fields: show, infinite, cell, section, fade, cell color, section color → `ui.chrome.grid`, `ui.grid.*`.
3. **On ground** fields: show, cell, section, cell color, section color + hint → `ui.scene.groundGrid.*`.
4. Shared labels reuse `InspectorField`; segment switch preserves each store independently.

### Removed from tree

| Removed | Disposition |
| ------- | ----------- |
| **Simulation** (disabled gravity) | Omit until engine toggle exists; do not show placeholder |
| **Collaboration** (if re-added) | Doc-bar + status only — not Scene accordion (per shipped peer selection UX) |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Open left panel | edit mode | Panel ≤80vh; tabs visible |
| Scene tab | — | Tiered accordion; Essentials+Environment open |
| Toggle accordion section | open/closed | Content expand/collapse; scroll height updates |
| Grids segment | Reference / On ground | Field group swap; no cross-write between stores |
| Objects tab | — | Search + list scroll inside same 80vh cap |
| Resize viewport shorter | — | Panel shrinks; scroll affordance appears |
| `prefers-reduced-motion` | — | No accordion animation requirement (instant open/close OK) |

## Accessibility

- **Focus order:** tabs → first accordion trigger → fields → next trigger (DOM order).
- **Tabs:** `role="tablist"`, `aria-selected` on active tab (existing).
- **Accordion:** shadcn/bits accordion — triggers are buttons with expanded state.
- **Grids segment:** `ToggleGroup` with `aria-label="Grid type"`.
- **Scroll region:** `panel-body--scroll` gets `tabindex="-1"` only if implementing skip-to-content; otherwise natural scroll via wheel/touch — no keyboard trap.
- **Motion:** respect `prefers-reduced-motion: reduce` for scroll-fade opacity transition (optional).

## Do's and Don'ts

**Do**

- Cap entire left panel at 80vh (min with viewport budget).
- Default collapsed for infrequent sections.
- Merge the two grid sections under one heading with a segment control.
- Keep all existing `ui.*` bindings — relocation only.

**Don't**

- Delete simulation/gravity from engine — only remove dead UI.
- Move collaboration username/room back into Scene tab without product review.
- Expand all sections by default.
- Change Objects/Assets information architecture in this wedge.

## Open for Architect

1. **Persistence:** sessionStorage for open sections — yes/no v1?
2. **Essentials merge:** single accordion vs two nested groups — design recommends **one** "Essentials" with two fields.
3. **Developer block:** single accordion with inner `<details>` for Input/Camera reference vs flat sub-tabs — mock uses `<details>` for less chrome.
4. **Scroll fade:** optional polish AC or defer?
5. **Hotfix dependency:** GroundPlane pick exclusion is separate executor wedge — no IA impact.

## Handoff checklist

- [x] `docs/artifacts/left_scene_panel_simplification_design.md`
- [x] `docs/artifacts/left_scene_panel_simplification_mockup.html`
- [ ] Trellis design issue TRL-D on graph when CLI available
