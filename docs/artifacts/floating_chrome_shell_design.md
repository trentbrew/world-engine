---
version: alpha
name: Floating Viewport Chrome
description: Design artifact — float left rail pill + sidebar panel over full-bleed viewport; symmetric with attributes glass panel
colors:
  viewport: "#1c1c1c"
  viewport-grid: "#2a2a2a"
  surface: "#252525"
  surface-raised: "#2e2e2e"
  surface-overlay: "#363636"
  surface-glass: "color-mix(in srgb, #363636 72%, transparent)"
  text: "#e4e4e4"
  text-muted: "#949494"
  text-mono: "#b0b0b0"
  primary: "#d4d4d4"
  accent-entity: "#c8c8c8"
  accent-link: "#b4b4b4"
  border: "#3d3d3d"
  border-focus: "#a3a3a3"
  ring: "#a3a3a3"
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
    letterSpacing: 0.06em
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
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  rail-pill-width: 44px
  sidebar-width: 200px
  attributes-width: 260px
  toolbar-height: 40px
  float-inset: 16px
components:
  toolbar:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.border}"
    height: "{spacing.toolbar-height}"
    position: docked
  rail-pill:
    backgroundColor: "{colors.surface-glass}"
    backdropFilter: blur(16px)
    border: "1px solid color-mix(in srgb, {colors.border} 70%, transparent)"
    borderRadius: "{rounded.lg}"
    width: "{spacing.rail-pill-width}"
    boxShadow: "0 4px 24px rgb(0 0 0 / 0.28)"
  sidebar-float:
    backgroundColor: "{colors.surface-glass}"
    backdropFilter: blur(16px)
    border: "1px solid color-mix(in srgb, {colors.border} 70%, transparent)"
    borderRadius: "{rounded.lg}"
    width: "{spacing.sidebar-width}"
    maxHeight: "calc(100% - {spacing.float-inset} * 2 - {spacing.toolbar-height})"
    boxShadow: "0 4px 24px rgb(0 0 0 / 0.28)"
  attributes-float:
    extends: sidebar-float
    width: "{spacing.attributes-width}"
  rail-button:
    size: 36px
    borderRadius: "{rounded.sm}"
    activeBackground: "{colors.surface-raised}"
    activeIndicator: "inset 2px 0 0 {colors.accent-entity}"
---

# Design: Floating Viewport Chrome

**Status:** Design complete (handoff to Architect)  
**Parent:** AppShell evolution (extends [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md))  
**Mock:** [floating_chrome_shell_mockup.html](./floating_chrome_shell_mockup.html)  
**Inherits:** AppShell foundation tokens + Lucide icon rail (implemented)

---

## Overview

Evolve the AppShell from **docked left columns** (rail + sidebar eat grid width) to **full-bleed viewport** with **floating glass chrome** on left and right — matching the attributes panel already floating top-right.

**Audience:** builder-engineer authoring JSON-LD worlds in a 3D viewport-first shell.

**Emotional tone:** canvas is the hero; chrome is precision instrumentation that appears when needed, never permanently shrinking the world.

**Scope:** layout + interaction only. No inspector field rewrite, no new rail affordances.

**Explicit non-goals:** float the toolbar; merge rail + sidebar into one wide panel; mobile bottom-sheet (separate pass).

## Colors

Reuse `app.css` / AppShell foundation tokens. Floating panels use **`surface-glass`** (72% `surface-overlay` + `backdrop-filter: blur(16px)`) — same recipe as `EntityAttributes.svelte` today.

| Token | Floating chrome role |
| ----- | -------------------- |
| `surface-glass` | Rail pill, sidebar, attributes panel fill |
| `border` @ 70% mix | Panel outline (subtle, not dock seam) |
| `accent-entity` | Active rail item, selection inset bar |
| `viewport` | Full-bleed canvas under all floats |

Docked toolbar keeps solid `surface` + bottom `border` — anchors the app.

## Typography

Unchanged from AppShell foundation: DM Sans UI, JetBrains Mono for entity ids and field keys.

## Layout

### Desktop (≥768px)

```
┌──────────────────────────────────────────────────────────────┐
│ TOOLBAR (docked, full width)                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [rail]  [sidebar?]                    [attributes?]          │
│ pill    entities/assets float           float top-right      │
│                                                              │
│              VIEWPORT — 100% width × height                    │
│              (WebGL under all floats)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Region | Position | Width | Visible when |
| ------ | -------- | ----- | ------------ |
| **Toolbar** | docked row 1 | 100% | always |
| **Viewport** | row 2, full grid cell | 100% | always |
| **Rail pill** | `absolute`; top/left = `--float-inset` below toolbar | 44px | always (desktop) |
| **Sidebar float** | `absolute`; left = rail + gap + inset | 200px | `inspectorOpen` |
| **Attributes float** | `absolute`; top/right = inset | 260px | `inspectorOpen` + entity selected path |

**Grid simplification:** `app-body` becomes single column (`1fr`) — no `inspector-open` column template. Toggle inspector = show/hide floats, not reflow.

**Rail ↔ sidebar gap:** 8px (`--spacing-sm`). Sidebar left edge = `float-inset + rail-pill-width + sm`.

**Stacking (z-index):**

| Layer | z-index |
| ----- | ------- |
| Viewport canvas | 0 |
| Toolbar | 10 |
| Rail pill | 18 |
| Sidebar float | 19 |
| Attributes float | 20 |
| Dialog overlay | 40 |
| Sonner | 50 |

**Pointer events:** viewport wrapper `pointer-events: auto` for canvas; float containers use `pointer-events: none` on wrapper, `auto` on panel content (matches current attributes pattern).

### Mobile (<768px)

Defer rail pill to **bottom icon bar** or hide rail (existing `@media` hides rail). Sidebar + attributes become **bottom sheets** (max 50vh) — same as AppShell v1 mobile note. Floating left stack is **desktop-first**; mobile keeps stacked grid fallback.

## Elevation & Depth

**Shift from inset hierarchy → glass overlay hierarchy** for left/right chrome only.

| Surface | Treatment |
| ------- | --------- |
| Toolbar | flat dock, border-bottom only (no shadow) |
| Float panels | glass + `box-shadow: 0 4px 24px rgb(0 0 0 / 0.28)` + 1px inset highlight |
| Rail pill | same glass as sidebar — visually one family |
| Active rail | inset left accent bar (preserve existing `rail-active`) |

Panels **occlude** viewport content — acceptable trade for symmetric hero canvas. Avoid widening floats beyond current widths.

## Shapes

| Element | Radius | Notes |
| ------- | ------ | ----- |
| Rail pill outer | `rounded-lg` (12px) | vertical capsule feel |
| Sidebar / attributes | `rounded-lg` | match attributes panel today |
| Rail buttons | `rounded-sm` (4px) | 36×36 hit target |
| Icons | Lucide 16px (`size-4`) rail, 14px (`size-3.5`) toolbar | already shipped |

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **AppShell** | toolbar row + single viewport cell; floats as children of viewport | default, inspector-open | `src/lib/ui/AppShell.svelte` |
| **Rail pill** | glass column, 4 icon buttons, tooltip right | item default/active/disabled | `WorldRail.svelte` — remove docked border-right |
| **Sidebar float** | glass panel; hosts EntityList or AssetsPanel | entities / assets route | `WorldShell.svelte` sidebar snippet |
| **Attributes float** | unchanged position (top-right) | empty / selected | `EntityAttributes.svelte` |
| **Entity list** | adopt glass shell from attributes (remove solid `surface` dock) | list + add btn | `EntityList.svelte`, `AssetsPanel.svelte` |

### Rail pill vs docked rail

Remove full-height `border-right` rail column. Pill floats with internal padding `8px 0`, gap `4px` between icons. Pill always visible on desktop — mode switching remains one click.

### Sidebar content

When `ui.railRoute === 'entities' | 'assets'` and `world.inspectorOpen`, show sidebar float. When inspector closed, hide sidebar but **keep rail pill** (user can reopen). Route resets to `world` optional — keep current route memory.

## Interaction matrix

| Input | State | Output |
| ----- | ----- | ------ |
| Rail World | any | `railRoute=world`; deselect entity; sidebar hidden if inspector closed |
| Rail Entities | inspector closed | open inspector; `railRoute=entities`; sidebar fades in |
| Rail Entities | inspector open | toggle inspector closed; sidebar hides |
| Rail Assets | inspector closed | open inspector; `railRoute=assets`; sidebar shows AssetsPanel |
| Toolbar Inspector btn | sync | same as Rail Entities; set route entities if was world |
| Sidebar Add entity | — | dialog open (unchanged) |
| Mesh browse | — | `railRoute=assets`; pick mode (unchanged) |
| Esc | pick mode | cancel pick (future AC) |
| Viewport click | floats open | no auto-close (panels persist until toggled) |

**Motion:** sidebar + attributes enter/exit with `opacity` + `translateY(4px)` over 180ms; rail pill static. `prefers-reduced-motion: reduce` → instant show/hide.

## Accessibility

- **Focus order:** skip-link → toolbar → rail pill (roving tabindex) → sidebar (when open) → attributes (when open)
- **Rail:** `aria-label` per icon; toggle items `aria-pressed`; tooltips 400ms delay
- **Float panels:** `role="complementary"` + `aria-label` (Entity list / Assets / Attributes)
- **Motion:** disable float transitions when `prefers-reduced-motion`
- **Contrast:** glass text on blurred dark bg must stay ≥4.5:1 — use solid `text` on `surface-glass`

## Do's and Don'ts

**Do**

- Keep toolbar docked for wayfinding
- Use identical glass recipe on rail pill, sidebar, and attributes
- Preserve Lucide icons + tooltip pattern on rail
- Let viewport stay full width at all breakpoints ≥768px

**Don't**

- Float the toolbar (disorienting for file/status context)
- Merge rail into sidebar header (loses always-visible mode switcher)
- Auto-close floats on viewport click (3D picking conflict)
- Widen floats beyond 200px / 260px without new design pass

## Open for Architect

- **Single PR vs phased:** layout-only `AppShell.svelte` first, then glass-wrap EntityList/AssetsPanel?
- **Route when inspector closes:** hide sidebar only, or reset `railRoute` to `world`?
- **Mobile:** bottom sheet for sidebar in same PR or defer?
- **CSS vars:** add `--float-inset`, `--rail-pill-width`; deprecate grid `--inspector-width` column usage
- **AC:** viewport width unchanged when toggling inspector; no layout shift on canvas resize

## Handoff checklist

- [x] `docs/artifacts/floating_chrome_shell_design.md` (this file)
- [x] `docs/artifacts/floating_chrome_shell_mockup.html`
- [ ] Trellis design issue + `describe` SUMMARY (CLI create failed this session — Strategist sync)
