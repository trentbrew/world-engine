---
version: alpha
name: Editor shell — docked bottom pane
description: Design artifact — retire floating palette card; bottom pane as flush grid sibling sharing side-panel glass; route-swappable action surface
source:
  tool: human
  mock: docs/artifacts/editor_shell_cards_mockup.html
colors:
  background: oklch(0.145 0 0)
  foreground: oklch(0.985 0 0)
  card: oklch(0.205 0 0)
  muted-foreground: oklch(0.708 0 0)
  primary: oklch(0.922 0 0)
  border: oklch(1 0 0 / 10%)
  viewport: oklch(0.1 0 0)
  surface-glass-panel: "color-mix(in srgb, var(--surface-glass) 22%, transparent)"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 600
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  sm: 8px
  md: 12px
components:
  panel-shell:
    class: glass-panel-shell
    variant: glass-flush
    background: "{colors.surface-glass-panel}"
    borderRadius: 0
  bottom-pane:
    extends: panel-shell
    position: grid-row bottom
    borderTop: "1px solid color-mix(in srgb, {colors.border} 28%, transparent)"
---

# Design: Editor shell — docked bottom pane

**Status:** Design revised (handoff to Architect)\
**Parent:** [editor_shell_refactor_spec.md](./editor_shell_refactor_spec.md) ·
human pivot (Jul 2026)\
**Mock:** [editor_shell_cards_mockup.html](./editor_shell_cards_mockup.html)\
**Supersedes:** card-chrome proposal in same mock (toggle compares old vs new)

---

## Overview

**Direction pivot.** The prior mock floated doc bar + side panels as cards to
match the palette. Human feedback inverts that: keep **left, right, and doc bar
flush/docked** (as today's `glass-flush` panels). **Demote the palette from a
floating card** to a **docked bottom pane** — same width as the viewport column,
flush against the inner edges of the side panels, **no bottom/side inset, no
rounded corners**.

Treat the bottom region as a **generic action pane** (`BottomPane`), not a
Scene-only widget. The active **rail route** swaps its content:

| Route                   | Bottom pane content                                    |
| ----------------------- | ------------------------------------------------------ |
| **scene**               | Asset palette (drag-to-place) — today's `ScenePalette` |
| **object**              | Behavior drawer (clip schedule + event lanes)          |
| assets / graph / config | stub or hidden (later)                                 |

**Visual unity:** bottom pane uses the **identical shell** as left/right panels:
`glass-panel-shell` + `surface-glass-panel` fill — not the heavier `glass-panel`
card recipe (stronger border, radius, drop shadow).

**Audience:** builder-engineer in Edit mode.

**Emotional tone:** chrome is a **frame** around the viewport (inset hierarchy
by containment), not floating islands. One continuous glass band at the bottom,
part of the same instrument panel family as the sidebars.

## Colors

| Token                 | Chrome role                                             |
| --------------------- | ------------------------------------------------------- |
| `surface-glass-panel` | Left, right, doc bar, **bottom pane** fill (`::before`) |
| `border` @ 28% mix    | Seam between panels (top border on bottom pane)         |
| `viewport`            | Canvas center cell only                                 |

**Do not** use `glass-panel` (floating card) on the bottom pane — that was the
mismatch.

## Typography

Unchanged: Geist UI 13px, Geist Mono for labels/ids.

## Layout

### Framed grid (aligns with shell refactor spec)

```
grid-template-columns: [left] var(--left) [canvas] 1fr [right] var(--right)
grid-template-rows:    [top] var(--doc-bar) [body] 1fr [bottom] var(--bottom)
```

Desktop Edit mode:

```
┌─ Doc bar (flush top, full width) ─────────────────────────────┐
├─ Left panel ─┬──── Viewport (inset canvas) ────┬─ Right panel ─┤
│  glass-flush │                                 │  glass-flush  │
│              │                                 │               │
│              ├──── Bottom pane (flush) ────────┤               │
│              │  route: Palette | Behavior      │               │
└──────────────┴─────────────────────────────────┴───────────────┘
```

| Region           | Placement                                            | Visual                                                                     |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| **Doc bar**      | row `top`, spans all columns                         | flush top, `glass-panel-shell`                                             |
| **Left / right** | columns; span rows `body` + `bottom` OR only `body`* | `glass-flush`, full height to window bottom                                |
| **Viewport**     | cell `body` center                                   | recessed inset (separate spec)                                             |
| **Bottom pane**  | row `bottom`, **center column only**                 | flush L/R with panel inner edges; **border-radius: 0**; **no float inset** |

\*Architect: side panels can span full height beside the bottom pane (L-frame)
**or** end above the bottom row with bottom pane spanning viewport only — mock
uses **L-frame** (side panels full height; bottom pane only under viewport).
Both read "flush with side panels."

### Bottom pane sizing

- **Collapsed:** handle strip only (~36px) — label reflects route ("Palette" /
  "Behavior")
- **Expanded:** `ui.bottomHeight` (default ~200px), resizable via top edge drag
- **Toggle:** `/` when scene route (palette); route-specific shortcut for
  behavior later

### Retire floating palette positioning

Remove from `ScenePalette.svelte`:

- `position: fixed`
- `bottom/left/right` inset calculations
- `border-radius: var(--radius-lg)`
- `box-shadow` card drop shadow
- `glass-panel` class

Replace with: slot content inside `AppShell` `bottom` snippet, shell styled like
`.panel-shell`.

## Elevation & Depth

**Containment over elevation.** All docked chrome shares one glass depth — no
card shadows between panel family members. Depth comes from the **viewport
recess** in the center, not from floating palette.

| Surface                        | Treatment                                   |
| ------------------------------ | ------------------------------------------- |
| Side panels + bottom + doc bar | `glass-panel-shell` / `surface-glass-panel` |
| Bottom pane top edge           | 1px border seam (matches panel dividers)    |
| Floating card palette          | **removed**                                 |

## Shapes

| Element                           | Radius                                    |
| --------------------------------- | ----------------------------------------- |
| Doc bar, left, right, bottom pane | **0** (flush)                             |
| Inner chips, asset cards, pills   | `--radius-sm` / `--radius-md` (unchanged) |

## Components

| Component        | Anatomy                                                        | States                                  | Maps to codebase                                                           |
| ---------------- | -------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| **BottomPane**   | shell wrapper + route slot + collapse handle + resize top edge | collapsed / expanded; per-route content | new `BottomPane.svelte`; `AppShell` `bottom` slot                          |
| **ScenePalette** | content only (pills, strip, legend) — no positioning shell     | open/closed                             | `ScenePalette.svelte` → strip shell styles                                 |
| **BehaviorPane** | clip schedule + event lanes (Object route)                     | Phase D                                 | [object_behavior_drawer_mockup.html](./object_behavior_drawer_mockup.html) |
| **AppShell**     | grid row `bottom`; hosts `BottomPane`                          | edit / play collapse                    | `AppShell.svelte`                                                          |
| **WorldShell**   | `{#if route}…{/if}` inside bottom slot                         | scene / object / …                      | `WorldShell.svelte`                                                        |

### Rename guidance (Architect)

- **Shell:** `BottomPane.svelte` (generic)
- **Scene content:** keep `ScenePalette.svelte` or rename
  `ScenePaletteContent.svelte`
- **State:** `ui.paletteOpen` → `ui.bottomPaneOpen` (or derive from
  `bottomHeight > collapsed`)

## Interaction matrix

| Input             | State       | Output                                                      |
| ----------------- | ----------- | ----------------------------------------------------------- |
| `/`               | scene route | toggle bottom pane expand/collapse                          |
| Rail → scene      | any         | bottom slot = palette content; preserve open state          |
| Rail → object     | any         | bottom slot = behavior content; preserve height             |
| Drag top edge     | expanded    | resize `bottomHeight`                                       |
| Panel resize      | edit        | bottom pane width tracks center column automatically (grid) |
| Enter Play        | any         | bottom row collapses to `0` (grid)                          |
| `~` hide sidebars | edit        | bottom pane stays viewport-width; side columns `0`          |

## Accessibility

- **Landmark:** bottom pane `role="region"` + `aria-label` per route ("Scene
  palette" / "Object behavior")
- **Handle:** `aria-expanded` on collapse control
- **Focus order:** doc bar → left → viewport → right → bottom handle → bottom
  content
- **Motion:** grid collapse on Play respects `prefers-reduced-motion`

## Do's and Don'ts

**Do**

- Share **exact** `glass-panel-shell` + `surface-glass-panel` on left, right,
  bottom
- Model bottom as a **first-class grid slot** swappable by `railRoute`
- Keep inner asset cards/pills rounded — only the **outer shell** is flush
- Align with [editor_shell_refactor_spec](./editor_shell_refactor_spec.md) Phase
  C grid

**Don't**

- Float the bottom pane with `--float-inset` or `--radius-lg`
- Use `glass-panel` (card) styling on the bottom shell
- Hard-code bottom as Scene-only — wire through `BottomPane` + route
- Give bottom a different background opacity than side panels

## Open for Architect

- **Side panel row span:** full-height L-frame vs panels ending above bottom
  row?
- **State rename:** `paletteOpen` → `bottomPaneOpen` now or with rail router
  Phase B?
- **Resize:** share `PanelResizeHandle` on bottom top edge?
- **Collapsed height:** single token `--bottom-pane-collapsed`?
- **Phase:** bundle with AppShell grid + `bottom` slot (Phase A/C) before Object
  behavior content?

## Handoff checklist

- [x] `docs/artifacts/editor_shell_cards_design.md` (revised)
- [x] `docs/artifacts/editor_shell_cards_mockup.html` (updated compare mock)
- [ ] Trellis design issue sync (optional)
