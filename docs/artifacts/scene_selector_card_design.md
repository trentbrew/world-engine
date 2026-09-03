---
version: alpha
name: scene_selector_card
description: Design for TRL-239/240 — promote SceneSelector to a prominent full-width card above the left pane (scene = the document being edited), with a slim doc-bar crumb kept for collapsed-panel coverage.
source:
  tool: greenfield
  mock: docs/artifacts/scene_selector_card_mockup.html
colors:
  background: "#0c0c0e"
  surface: "#141418"
  text: "#e8e8ec"
  text-muted: "#888894"
  primary: "#e85d4c"
  accent: "#2f80ed"
  destructive: "#ef4444"
  border: "#2a2a32"
typography:
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.04em
  sceneTitle:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 600
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  sceneCard:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    borderRadius: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
    height: 44px
  sceneBadge:
    borderRadius: 999px
    height: 18px
    padding: "0 8px"
    fontSize: 10px
    fontFamily: mono
  docBarCrumb:
    backgroundColor: "{colors.surface}"
    borderRadius: 999px
    height: 32px
---

# Design: Prominent scene selector card

**Status:** Design complete (handoff to Architect)
**Parent:** TRL-239
**Mock:** [scene_selector_card_mockup.html](./scene_selector_card_mockup.html)

---

## Overview

The scene is the **document being edited** — the thing an author opens, renames, and switches between. Today it's a slim pill buried inside the doc-bar breadcrumb (`DocBarBreadcrumb` → `SceneSelector compact`), reading as navigation chrome rather than the working context. This promotes it to a **full-width card pinned at the top of the left pane**, so the workbench reads: *scene card → panel content below*. A minimal doc-bar crumb remains so scene switching is never lost when the left pane is collapsed (sidebars toggled off).

Density: shell-level (fits the existing floating-card chrome), quiet until hovered, no new visual language.

## Colors

Tokens are normative (front matter). The card uses the shell surface (`{colors.surface}`), a `{colors.border}` hairline, and scene text at `{colors.text}`; the 2D/3D badge uses the accent (`#2f80ed` tint) for 2D and the muted/mono treatment for 3D. `prefers-reduced-motion` and dark/light both inherit the existing theme — no new palette.

## Typography

- **Scene title** (`{typography.sceneTitle}`): 13px / 600 — the primary identity of the card.
- **Badge** (`{typography.label}`, mono for the letterspaced `2D`/`3D`): 10px.
- **Chevron / New-scene icon**: 14–16px stroke icons, `--muted-foreground`.

## Layout

The card occupies the full width of the left-pane column (same width as the panel shell), sitting **above** the Room/Instances/Objects tabs. It is **one row** (44px tall), not a block — reads as a title bar, not a hero. Horizontal padding `{spacing.md}`; a trailing `New blank scene` affordance right-aligned. When `sidebarsVisible` is false the card is **hidden** and a **slim doc-bar crumb** (scene name + chevron only, 32px pill) takes over so the switch is still reachable. No viewport inset change — the card lives inside the already-inset left column.

## Elevation & Depth

Same `chrome-float-card glass-panel-shell chrome-opacity-panel` treatment as the side panels (blur + hairline + soft shadow). The card is a sibling surface to the panel below, not a banner.

## Shapes

- Card: `{rounded.md}` (8px).
- Badge: `999px` pill.
- Crumb: `999px` pill (matches existing doc-bar pills).

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **Scene card** | `role=combobox` button: [scene title (truncate)] + [2D/3D badge] + [chevron]; full left-pane width | default, hover, `aria-expanded` open, focus-visible | New wrapper over `SceneSelector` (non-`compact`); mounted above the left panel |
| **New-scene btn** | trailing ghost icon button (plus) | idle, hover, focus-visible | Reuse `SceneSelector` blank-scene action |
| **Doc-bar crumb** | slim pill: [scene title] + [chevron], **no** New | default, hover, open | `SceneSelector compact` (kept, narrowed); gated on `sidebarsVisible === false` |
| **Left panel** | Room/Instances/Objects tabs + list | unchanged | `LeftPanel` (existing) |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Click scene card / chevron | default → open | Opens `SceneSelector` popover (Recent / Scenes / Community / Demos + 2D/3D filter + New blank scene) |
| Pick a scene | open | `loadGame`; card label + badge update; doc-bar crumb updates |
| Click New-scene | idle | Opens blank-scene dialog (2D / 3D) |
| Toggle sidebars off (collapse) | panel hidden | Card hides; **doc-bar crumb persists** (name + chevron) |
| Click doc-bar crumb (collapsed) | — | Re-opens the same `SceneSelector` popover |
| Focus card | focus-visible | `outline: 2px var(--ring)` (2D/3D badge not focusable) |

## Accessibility

- **Focus order:** scene card → New-scene → (panel tabs). Doc-bar crumb is reachable via doc-bar tab order when present.
- **Labels / roles:** card `role=combobox`, `aria-expanded`, `aria-label="Select scene"`; New-scene `aria-label="New blank scene"`; badge is decorative text (`aria-hidden` not required — it's real info; give it `sr`-safe presence via the card label).
- **Motion:** the popover animates ~120ms ease-in-out; transitions are disabled under `prefers-reduced-motion`. `SceneSelector` already uses `transition`/`animate` uniformly — extend, don't add new.

## Do's and Don'ts

**Do**

- Keep the card one row and full-pane-width; let the scene title truncate with ellipsis.
- Reuse the shell chrome + scene popover verbatim.
- Keep a doc-bar crumb whenever the panel is collapsed.

**Don't**

- Don't make it a tall hero block or duplicate the switch in both places when the panel is open.
- Don't invent a new palette or radius; inherit shell tokens.

## Open for Architect

- **Where it mounts:** a `SceneCard` block above `LeftPanel` in the world shell, inside the existing left-column `<aside>`. Confirm the left-panel top offset when the card is present (card height + gap), and that `--main-inset-*` / `viewportGizmoInsetLeft` are unaffected (card is inside the already-inset column).
- **Doc-bar dedup:** render the slim `SceneSelector compact` crumb ONLY when `sidebarsVisible === false`; drop it from the breadcrumb when the panel (and card) is visible, to avoid two scene pills.
- **Interaction reuse:** the card button should drive the same `SceneSelector` popover state (open `Popover.Root`); New-scene reuses `newBlankScene`.
- **needs-e2e:** card visible in edit when sidebars shown; crumb visible + clickable when sidebars collapsed; clicking the card opens the popover.

## Handoff checklist

- [x] `docs/artifacts/scene_selector_card_design.md` (this file)
- [x] `docs/artifacts/scene_selector_card_mockup.html` (self-contained; CSS vars mirror YAML tokens)
- [ ] Paths in design issue `describe` SUMMARY
