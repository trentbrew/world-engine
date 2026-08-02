---
version: alpha
name: Objects Bottom Pane Layout
description: Design artifact for TRL-173 — chrome overlap fix, 4-tab Objects shelf, left category rail, inspector field language
parent: TRL-173
colors:
  background: "oklch(0.145 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.205 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  primary: "oklch(0.922 0 0)"
  border: "oklch(1 0 0 / 10%)"
  viewport: "oklch(0.1 0 0)"
  field-well: "#141414"
  accent-field: "#c9a227"
  chrome-rail-opacity: "90%"
  chrome-doc-opacity: "60%"
  chrome-panel-opacity: "30%"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    textTransform: lowercase
  section:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 600
    letterSpacing: 0.06em
    textTransform: uppercase
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  chrome-edge: 12px
  chrome-float-gap: 6px
  left-panel-width: 320px
  bottom-pane-default: 320px
  bottom-pane-min: 48px
  field-row-height: 28px
  playback-bar-height: 44px
components:
  bottom-pane-shell:
    borderRadius: "{rounded.md}"
    opacityTier: chrome-panel
  bottom-tab-strip:
    position: top
    height: 40px
  category-rail:
    width: "{spacing.left-panel-width}"
    layout: vertical
---

# Design: Objects bottom pane layout + chrome overlap

**Status:** Design complete (handoff to Architect)\
**Parent:** TRL-173\
**Mock:**
[objects_bottom_pane_layout_mockup.html](./objects_bottom_pane_layout_mockup.html)\
**Inherits:**
[floating_chrome_shell_design.md](./floating_chrome_shell_design.md),
[animejs_fields_design.md](./animejs_fields_design.md),
[object_behavior_drawer_design.md](./object_behavior_drawer_design.md)

---

## Overview

Human feedback on the floating chrome shell (padding, opacity tiers, rail
left/bottom). This wedge fixes **content clipping under chrome** and redesigns
the **Objects route bottom shelf** so type authoring scales to four focused tabs
without cramming schedule, clip wiring, events, and catalog browse into two
views.

**Audience:** builder-engineer on `?game=*` → rail **Objects** → select a type →
bottom shelf.

**Emotional tone:** viewport remains hero; bottom shelf is a **glass instrument
tray** — lighter opacity than side panels (30%), with the same float gap as
left/right chrome. Category navigation mirrors the left resource panel width so
the shelf feels aligned with the column above.

**Scope:** `objects` route bottom pane + `AppShell` stacking fix when
`bottomPaneFullWidth`. **Out of scope:** `object` route behavior drawer (keep
2-region layout), rail position preference UI, TRL-142 grid refactor.

---

## Colors

Reuse shipped `app.css` tokens. Opacity tiers (already on shell):

| Surface     | Fill     | Class                    |
| ----------- | -------- | ------------------------ |
| Rail        | 90% card | `chrome-opacity-rail`    |
| Doc bar     | 60% card | `chrome-opacity-doc-bar` |
| Side panels | 30% card | `chrome-opacity-panel`   |
| Bottom pane | 30% card | same as side panels      |

Bottom pane **forms** use opaque `--field-well` on top of glass (inspector
pattern) — fields must not inherit translucent panel fill.

---

## Typography

- Shelf tab labels: 11px semibold UI
- Type title row: 13px semibold + 11px muted catalog subtitle
- Category rail items: 11px mono lowercase
- Field labels: `field-label` mono 11px lowercase per `animejs_fields_design.md`

---

## Layout

### Chrome overlap fix (item 1)

**Problem:** On `objects` route, `bottomPaneFullWidth` spans under left/right
panels, but `.app-bottom-pane` is `z-index: 12` while panels are `15` — shelf
handle, tabs, and resize edge paint **under** side panel glass at the L-corner.

**Decision:** Raise bottom chrome to **`z-index: 18`** when
`.app-bottom-pane.full-width` (above panels 15, below doc-bar 30 and rail 28).
Alternative (trim panel height) rejected — breaks L-frame visual continuity.

Verify breadcrumb + left panel headers remain fully visible at **both** rail
positions (left / bottom).

### Objects route chrome spacing (item 2)

- **Gap above shelf:** `margin-top` or outer wrapper applies
  `--chrome-float-gap` (6px) between viewport bottom and bottom chrome stack —
  same rhythm as gap between side panels and center column.
- **Playback bar** (`ObjectsPlaybackBar`) sits in the gap stack **above** the
  pane shell when Animations tab active; included in `--bottom-chrome-height`.

### Bottom pane anatomy (top → bottom)

```
┌─ resize handle (top edge, when open) ─────────────────────────────────────┐
│ [⌃]  Behaviors │ Schedule │ Clip │ Animations          hint    [/]     │  ← tab strip (TOP)
├──────────────────────────────────────────────────────────────────────────┤
│  TAB BODY (scroll)                                                       │
│  Animations tab:                                                         │
│  ┌─ category rail (320px) ─┬─ main content ─────────────────────────────┐ │
│  │ All                      │ RobotCharacter · Mesh2Motion Human  [search]│ │
│  │ action                   │ ┌────┐ ┌────┐ ┌────┐                     │ │
│  │ combat                   │ │card│ │card│ │card│  …                  │ │
│  │ locomotion               │ └────┘ └────┘ └────┘                     │ │
│  └──────────────────────────┴──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

| Region              | Width / height                                                     | Notes                                                          |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Tab strip           | 100% × ~40px                                                       | Tabs at **top** of shell (not `column-reverse` shelf handle)   |
| Category rail       | `var(--left-panel-width)`                                          | Fixed; matches `ui.leftPanelWidth` via CSS var from `AppShell` |
| Title row           | flex; search `max-width: 48rem` (`max-w-3xl`), `margin-left: auto` | Count badge optional left of search                            |
| Clip grid           | `repeat(auto-fill, minmax(132px, 1fr))`                            | min row height 132px; default pane height shows ≥2 rows        |
| Default open height | **320px** (`ui.bottomHeight`)                                      | Up from 168; animations tab auto-bump retained                 |

### Four-tab content map

| Tab            | id           | Body component                                       | Content                                                            |
| -------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| **Behaviors**  | `behaviors`  | `TypeBehaviorsPanel` (split from `TypeEventsEditor`) | Event cards (Create/Step/Destroy) + `add-action` composer          |
| **Schedule**   | `schedule`   | `TypeSchedulePanel`                                  | `BehaviorScheduleStrip` + `BehaviorAlarmLane` rows                 |
| **Clip**       | `clip`       | `TypeClipPanel`                                      | `add-clip` form (clip + delay on create) + clip-assignment summary |
| **Animations** | `animations` | `TypeAnimationsPanel` (layout refactor)              | Category rail + title/search row + clip card grid                  |

**Playback bar:** visible when `objectsBottomTab === 'animations'` && pane open
&& type selected (unchanged rule, new tab id).

**Collapse:** Chevron + `/` shortcut remain on tab strip left; collapsed height
= `--panel-shelf-height` (48px).

---

## Elevation & Depth

| Layer                  | z-index (objects full-width) |
| ---------------------- | ---------------------------- |
| Doc bar                | 30                           |
| Rail                   | 28                           |
| Bottom pane + playback | **18** (raised)              |
| Side panels            | 15                           |
| Canvas                 | 0                            |

Bottom pane keeps `chrome-float-card` + `chrome-opacity-panel` — rounded
`--radius-md`, float inset from viewport edges per shipped `AppShell`.

---

## Shapes

| Element            | Radius                         |
| ------------------ | ------------------------------ |
| Bottom pane shell  | `--radius-md` (10px)           |
| Category rail item | `--radius-sm` pill or 6px rect |
| Clip cards         | `--radius-sm`                  |
| Field wells        | `--field-control-radius`       |

---

## Components

| Component               | Anatomy                                  | States                       | Maps to codebase                                                   |
| ----------------------- | ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| **BottomPane**          | Top tab strip + body; resize on top edge | collapsed / open; active tab | `BottomPane.svelte` — flip flex to `column` (not `column-reverse`) |
| **ObjectsBottomDrawer** | Tab router                               | 4 tabs                       | `ObjectsBottomDrawer.svelte`                                       |
| **CategoryRail**        | Vertical `role="tablist"`                | active category              | new in `TypeAnimationsPanel` or `ObjectClipCategoryRail.svelte`    |
| **AnimTitleRow**        | title + subtitle + search                | —                            | header region in `TypeAnimationsPanel`                             |
| **Field composer**      | `field-row` grid                         | focus, dirty                 | replace `TypeEventsEditor` `.add-action` / `.add-clip` forms       |

---

## Interaction matrix

| Input                                        | State                | Output                                                                |
| -------------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Tab Behaviors / Schedule / Clip / Animations | any                  | `ui.objectsBottomTab = id`; body swaps; URL unchanged                 |
| Switch to Animations                         | `bottomHeight < 320` | `ui.bottomHeight = 320`                                               |
| Category rail item                           | Animations tab       | filter `filteredClips` (same as today horizontal pills)               |
| Search input                                 | Animations tab       | filter by clip id (debounce none v1)                                  |
| Clip card click                              | Animations tab       | `previewAnimClip`, seek 0, play; durable `setTypeDefault` if editable |
| `/` key                                      | objects route        | toggle `bottomPaneOpen` (unchanged)                                   |
| Resize top edge                              | open                 | `ui.resizeBottomPane` clamp 36–400                                    |
| Collapse chevron                             | any                  | `ui.toggleBottomPane()`                                               |
| Add action submit                            | Behaviors tab        | `pushTriggerAction` (unchanged)                                       |
| Add clip submit                              | Clip tab             | `addClipOnCreate` (lifted from TypeEventsEditor)                      |

**Motion:** tab body crossfade optional 120ms; respect `prefers-reduced-motion`.

---

## Accessibility

- **Focus order:** collapse → tablist (roving) → category rail (when Animations)
  → title row search → clip grid (`role="listbox"`) → form fields
- **Tab strip:** `role="tablist"` on top; `aria-selected` per tab; panel
  `role="tabpanel"` + `aria-labelledby`
- **Category rail:** `role="tablist"` `aria-label="Animation categories"`;
  vertical orientation
- **Search:** `type="search"` + `aria-label="Filter animations"`
- **Live regions:** playback frame count in `ObjectsPlaybackBar`
  (`aria-live="polite"`)
- **Motion:** disable tab/body transitions when `prefers-reduced-motion`

---

## Do's and Don'ts

**Do**

- Lock category rail width to `--left-panel-width` from shell (resizes with left
  panel)
- Put tabs at the **top** of the bottom pane card
- Use `field-row` / `field-well` for all bottom-pane composers
- Raise z-index for full-width bottom shelf only

**Don't**

- Cram schedule strip + events + clip form in one Behaviors tab
- Use horizontal category pills in Animations (move to left rail)
- Place search on its own row below title
- Drop playback bar from Animations tab without replacement

---

## Open for Architect

- **Type union:**
  `ObjectsBottomTab = 'behaviors' | 'schedule' | 'clip' | 'animations'` —
  migrate `WorldShell`, `shellKeyboard`, e2e helpers
- **Component split:** extract `TypeSchedulePanel` / `TypeClipPanel` from
  `TypeEventsEditor` vs flag sections in one file
- **Clip tab vs Animations:** Clip tab = **authoring only** (alarm/create-step
  composer + summary). Animations = **catalog browse + preview** — no duplicate
  clip card grid on Clip tab
- **Nested tablists:** Animations tab has pane tabs + category rail — spec
  horizontal roving for pane tabs, vertical roving for category rail when
  Animations active; `aria-controls` wiring
- **Rail bottom position:** AC must verify full-width shelf tabs remain
  unobstructed when `railPosition === 'bottom'`
- **Default tab** on type select: `behaviors` or last-used per type?
- **bottomPaneFullWidth z-index:** CSS class
  `.app-bottom-pane.full-width { z-index: 18 }` — document in `AppShell` AC
- **E2e:** extend `objects-animations-tab.spec.ts` for 4 tabs + category rail +
  search position
- **Coordination:** sequence `AppShell` edit with TRL-142; extend TRL-159 rather
  than parallel lane

---

## Design verification

- refs: `docs/artifacts/objects_bottom_pane_layout_design.md`,
  `docs/artifacts/objects_bottom_pane_layout_mockup.html`,
  `docs/artifacts/floating_chrome_shell_design.md`,
  `docs/artifacts/animejs_fields_design.md`,
  `docs/artifacts/object_behavior_drawer_design.md` (read)
- interaction matrix: 10 rows, 0 empty cells
- a11y: focus order + tab/category roles + reduced-motion documented
- token parity: YAML ↔ mock `:root` verified (Geist, oklch shell, field-well
  tokens)
- design.md lint: N/A (manual review)
- design critique: 1 round — see design issue describe

---

## Handoff checklist

- [x] `docs/artifacts/objects_bottom_pane_layout_design.md` (this file)
- [x] `docs/artifacts/objects_bottom_pane_layout_mockup.html`
- [ ] Trellis design child issue (CLI create failed session — parent TRL-173)
- [ ] Architect spec child under TRL-173
