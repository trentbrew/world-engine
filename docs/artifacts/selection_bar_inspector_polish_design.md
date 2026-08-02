---
version: alpha
name: selection-bar-inspector-polish
description: >-
  Design artifact for TRL-191 — pane-peer floating selection bar, open-type
  external-link placement, destructive delete, Look&Shaders hierarchy + sticky
  accordion chrome.
source:
  tool: greenfield
  mock: docs/artifacts/selection_bar_inspector_polish_mockup.html
colors:
  background: "#0a0a0a"
  surface: "#141418"
  card: "#141418"
  text: "#e8e8ec"
  text-muted: "#888894"
  primary: "#e8e8ec"
  destructive: "#ef4444"
  destructive-muted: "#9a6a6a"
  border: "#2a2a32"
  accent-field: "#e8a838"
  panel-glass: "#1414184d"
typography:
  body:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  sectionHeader:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 700
    letterSpacing: 0.05em
    textTransform: uppercase
  groupLabel:
    fontFamily: IBM Plex Mono
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.04em
    textTransform: uppercase
  kbd:
    fontFamily: IBM Plex Mono
    fontSize: 10px
    fontWeight: 500
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  selectionBar:
    backgroundColor: "{colors.panel-glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs} {spacing.sm}"
    height: 40px
  accordionTrigger:
    backgroundColor: "{colors.panel-glass}"
    textColor: "{colors.text-muted}"
    typography: sectionHeader
    padding: "{spacing.xs} 0"
  accordionBody:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    padding: "{spacing.md}"
---

# Design: Selection bar chrome + inspector accordion polish

**Status:** Design complete (handoff to Architect)\
**Parent:** [TRL-190](trellis://issue/TRL-190)\
**Design issue:** TRL-191\
**Mock:**
[selection_bar_inspector_polish_mockup.html](./selection_bar_inspector_polish_mockup.html)

---

## Overview

Edit-mode Rooms chrome should read as **one glass family**. The floating
selection bar currently looks like a play-toolbar pill; Trent wants it to **peer
the L/R panes** — same radius, same opacity tier, full width of the main inset.
Also: restore transform kbd chips, Destroy always destructive-red when enabled,
open-type as external-link beside the entity title, stronger sticky accordion
headers without nested accordions.

## Colors

| Role | Token | Use |
| ---- | ----- | --- |
| Pane / bar glass fill | `--chrome-fill-panel` (30%) via `.chrome-opacity-panel`; YAML proxy `{colors.panel-glass}` `#1414184d` | Selection bar + L/R panes + sticky header wash |
| Base card | `--card` / `{colors.card}` (= `{colors.surface}`) | Mix source for glass |
| Pill (forbidden for bar) | `--chrome-pill-bg` | Play toolbar only |
| Destructive enabled | `--destructive` `#ef4444` | Destroy at rest + hover (≥3:1 on dark glass) |
| Destructive disabled | `{colors.destructive-muted}` `#9a6a6a` | Destroy when `!canDelete` — muted, not full red |
| Field accent | existing inspector yellow | Unchanged |

**Normative glass recipe (C1 resolved):**  
`chrome-float-card glass-panel-shell chrome-opacity-panel` · `z-index: 12`  
→ `::before` fill = `color-mix(in srgb, var(--card) var(--chrome-fill-panel), transparent)`.  
YAML `{colors.panel-glass}` is the DESIGN.md-lintable 8-digit hex proxy for that 30% wash — implement with the class stack, not a flat fill.  
Do **not** paint a flat `--surface-glass-panel` (80%) on the selection bar.

## Typography

- **Accordion triggers:** mono uppercase, **font-weight 700**, 11px.
- **Group labels** (Art style / Surface / Fog…): 10px / 500 / quieter muted —
  must not compete with triggers.
- **Kbd chips:** mono 10px, always on float transform items.

## Layout

### Selection bar

Containing block: `WorldViewport` absolute inset (full canvas). Geometry:

```css
.viewport-selection-bar {
  position: absolute;
  top: calc(var(--chrome-top-outer) + var(--chrome-inner-gap));
  left: var(--main-inset-left);
  right: var(--main-inset-right);
  z-index: 12; /* canvas overlays; below side-panel chrome (~15) */
  pointer-events: none;
}
.selection-bar-card {
  pointer-events: auto;
  width: 100%;
  /* classStack: chrome-float-card glass-panel-shell chrome-opacity-panel */
}
```

Inner: flex, space-between — transform cluster left, entity actions right,
divider between when both present. Hide `@media (max-width: 767px)`.

### Right inspector header

Order: **`title` → `ExternalLink` (26×26) → `id badge`**.

### Look & Shaders

**Keep one top-level `Accordion.Item`.** No nested `Accordion.Root`. Flattening
is visual only (stronger triggers, quieter group labels, body indent). Field
membership unchanged.

## Elevation & Depth

Same class stack as L/R panes (see Colors). Sticky triggers use the **same 30%
panel wash** (not opaque `--background`, not 80% `--surface-glass-panel`).

## Shapes

| Surface                   | Radius                                 |
| ------------------------- | -------------------------------------- |
| L/R panes + selection bar | `--radius-md` via `.chrome-float-card` |
| Open-type / action icons  | 26×26                                  |

## Components

| Component         | Anatomy                      | States                          | Maps to                                                                 |
| ----------------- | ---------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Selection bar     | Full-inset glass card        | see matrix                      | `ViewportSelectionBar.svelte`                                           |
| Transform         | Move/Rotate/Scale + Kbd      | active; hidden if !canTransform | `TransformToolbar` float — always Kbd                                   |
| Entity actions    | Copy/Paste/Duplicate/Destroy | disabled per capability         | `EntityEditActions.svelte`                                              |
| Open type         | ExternalLink 26×26           | hidden if !getType              | `RightPanel.svelte`                                                     |
| Accordion trigger | sticky 700 weight            | open/closed                     | shared `.inspector-trigger` in SceneInspector + entity accordion styles |
| Group label       | quiet divider                | static                          | `ShadersSceneFields` `.group-label`                                     |

**CSS owner (C6):** one shared rule set for `.inspector-trigger` /
`.inspector-content` used by SceneInspector and entity inspector accordions.
Sticky `top: 0` relative to each panel’s overflow scrollport (left Room pane /
right inspector body).

## Interaction matrix

| State                                       | Input                 | Output                                                                    |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| Rooms edit + transformable selection        | — (idle)              | Bar visible full-inset; transform+kbd + actions; Destroy red if canDelete |
| Rooms edit + locked / 2d selection          | —                     | Bar visible; actions only (no transform/divider)                          |
| Rooms edit + clipboard, no selection        | —                     | Bar visible; actions only; Paste enabled; Copy/Dup/Destroy disabled       |
| Rooms edit + no selection + empty clipboard | —                     | Bar **hidden**                                                            |
| Play / publish mode                         | —                     | Bar **hidden**                                                            |
| Viewport width &lt; 768px                   | —                     | Bar **hidden** (CSS)                                                      |
| Placement draft active                      | —                     | Transform cluster hidden; actions may remain if selection                 |
| Click Move/Rotate/Scale                     | click / M R S         | `ui.setTransformGizmoMode`; radio selected                                |
| Click Copy / Paste / Duplicate              | click / mod shortcuts | existing clipboard ops; disabled when !can*                               |
| Destroy enabled                             | click / Delete        | destroy confirm path; icon `--destructive` at rest                        |
| Destroy disabled                            | —                     | icon `{colors.destructive-muted}`; not full red; `disabled`               |
| Destroy hover (enabled)                     | hover                 | stays `--destructive` (may brighten slightly)                             |
| Open-type available                         | click                 | `openObjectTypeInObjects(type)`                                           |
| Open-type unavailable (`!getType`)          | —                     | control **omitted** from header                                           |
| Scroll panel, section open                  | scroll                | Trigger sticks to scrollport top                                          |
| Accordion trigger                           | click / Enter / Space | expand/collapse                                                           |
| Prefers-reduced-motion                      | OS                    | No chevron/height animation; sticky remains (layout, not motion)          |

## Accessibility

**Focus order (Rooms edit, selection + transform):**

1. Transform radios (Move→Rotate→Scale)
2. Entity action buttons (Copy→Paste→Duplicate→Destroy)
3. Left pane controls (existing)
4. Right header: title (static) → open-type button → … inspector fields /
   accordion triggers

Sticky headers remain in tab order as normal buttons; when stuck they do not
trap focus.

**Labels:** `Open {type} in Objects`; Destroy `aria-label="Destroy"`. Kbd chips
decorative; shortcuts already in control `aria-label`/`title`.

**Contrast:** enabled Destroy `#ef4444` on 30% glass over dark viewport — target
≥3:1 for icon-only UI. Disabled uses muted mix, not full red.

**Motion:** only chevron/height transitions respect `prefers-reduced-motion`.
Sticky positioning is not animation.

## Open for Architect

1. **Bar chrome AC:** `left/right: var(--main-inset-*)`;
   `top: calc(var(--chrome-top-outer) + var(--chrome-inner-gap))`; class stack
   `chrome-float-card glass-panel-shell chrome-opacity-panel`; `z-index: 12`;
   forbid pill tokens.
2. Float `TransformToolbar` always renders `<Kbd>`.
3. Destroy: enabled → `color: var(--destructive)` at rest; disabled → muted
   destructive, not full red.
4. `RightPanel`: `ExternalLinkIcon` 26×26; order title → link → badge.
5. Shared `.inspector-trigger` / `.inspector-content`: weight 700; sticky bg =
   panel 30% wash; body `padding-left: var(--spacing-md)`.
6. Keep Look & Shaders one top-level item; demote `.group-label` contrast if
   needed.
7. E2E: bar spans inset (bounding box vs pane edges); kbd text present;
   open-type name; Destroy computed color when enabled.

## Do's and Don'ts

**Do** match pane opacity tier; keep Look & Shaders single; Destroy red when
enabled.

**Don't** use `--chrome-pill-bg` / `--rounded-pill` for the bar; nest
accordions; leave open-type after the id badge; use `ListTreeIcon`.
