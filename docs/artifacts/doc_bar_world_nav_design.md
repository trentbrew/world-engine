---
version: alpha
name: Doc bar world navigation
description: Design artifact — retire bottom dock; lift world routes into bracketed doc bar; bottom pane actions-only
source:
  tool: human
  mock: docs/artifacts/doc_bar_world_nav_mockup.html
colors:
  background: oklch(0.145 0 0)
  foreground: oklch(0.985 0 0)
  card: oklch(0.205 0 0)
  muted-foreground: oklch(0.708 0 0)
  primary: oklch(0.922 0 0)
  primary-foreground: oklch(0.205 0 0)
  border: oklch(1 0 0 / 10%)
  viewport: oklch(0.1 0 0)
  accent-entity: oklch(0.72 0.12 250)
  destructive: oklch(0.577 0.245 27.325)
  surface-glass-panel: "color-mix(in srgb, var(--card) 80%, transparent)"
  chrome-pill-bg: "color-mix(in srgb, var(--card) 90%, transparent)"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
  route-label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.02em
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 10px
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  chrome-edge: 12px
  sm: 8px
  md: 12px
components:
  doc-bar:
    height: 48px
    background: "{colors.surface-glass-panel}"
    layout: "title | world-routes | mode-pill | presence-chat"
  world-route-tabs:
    variant: underline-active
    activeIndicator: "2px bottom border {colors.accent-entity}"
    hover: "foreground @ 6% mix"
  shell-mode-pill:
    extends: ShellModeTabs
    background: "{colors.chrome-pill-bg}"
  chat-toggle:
    position: doc-bar-end
    panelAnchor: below-doc-bar-right
---

# Design: Doc bar world navigation

**Status:** Design complete (handoff to Architect)  
**Parent:** shell-nav pivot (Jul 2026) · supersedes bottom-dock placement in [gamemaker_navigation_spec.md](./gamemaker_navigation_spec.md) § Bottom dock layout  
**Mock:** [doc_bar_world_nav_mockup.html](./doc_bar_world_nav_mockup.html)  
**Related:** [editor_shell_cards_design.md](./editor_shell_cards_design.md), [gamemaker_navigation_spec.md](./gamemaker_navigation_spec.md)

---

## Overview

**Problem.** World navigation (Graph, Assets, Objects, Collections, Rooms, Chat) lives in a
dedicated bottom dock (`BottomDock.svelte`) while the doc bar (`DocBar.svelte`) has unused
horizontal space. Two chrome bands compete for attention and the dock consumes
`--bottom-dock-height` (~52px + gap) of vertical viewport.

**Direction.** **Nav up, actions down.** Lift world routes into a **bracketed doc bar**;
retire the bottom dock entirely. The bottom pane (`BottomPane`) remains for **contextual
actions only** (asset palette, behavior drawer) — not navigation.

**Emotional tone.** One continuous top instrument strip: document identity → project
sections → edit/play mode → session/social. Canvas breathes taller; navigation sits where
the eye already goes for mode switching.

**Audience.** Builder-engineer in Edit mode; Play mode collapses to title + score + presence.

---

## Colors

| Token | Role |
| ----- | ---- |
| `surface-glass-panel` | Doc bar, side panels, bottom pane fill |
| `chrome-pill-bg` | Edit/Play mode pill background |
| `accent-entity` | Active world route underline + subtle hover fill |
| `muted-foreground` | Inactive route labels |
| `primary` / `primary-foreground` | Active Edit/Play tab |
| `destructive` | Chat unread badge |

Active route uses **underline indicator**, not full pill fill — avoids visual competition
with the Edit/Play pill.

---

## Typography

| Element | Spec |
| ------- | ---- |
| World title | 13px / 600, ellipsis |
| Route labels | 11px / 600, `letter-spacing: 0.02em` |
| Route labels (compact) | hidden below 900px — icon + tooltip only |
| Mode tabs | 12px / 500 (unchanged `ShellModeTabs`) |

---

## Layout

### Bracketed doc bar anatomy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [World title]  Graph · Assets · Objects · Collections · Rooms   (Edit|Play)  👥 💬 │
└────────────────────────────────────────────────────────────────────────────────┘
     doc-start          world-route-group (flex)              mode-pill    doc-end
```

| Zone | CSS class | Content | Flex |
| ---- | --------- | ------- | ---- |
| **Start** | `.doc-bar-start` | `currentGame().title` | `1 1 0`, min-width 0 |
| **Routes** | `.doc-bar-routes` | `WorldRouteTabs` | `0 1 auto`, centered in remaining space |
| **Mode** | `.doc-bar-mode` | `ShellModeTabs` | `0 0 auto` |
| **End** | `.doc-bar-end` | `RoomPresenceBar` + Chat toggle | `1 1 0`, justify end |

**Graph placement (decided):** leading item in the route group — dev/power-user affordance
without a separate dock edge. GameMaker core (Assets → Objects → Collections → Rooms) stays
contiguous after it.

### Shell grid change

Remove `app-bottom-dock` row from `AppShell.svelte`. Update insets:

| Token | Before | After |
| ----- | ------ | ----- |
| `--bottom-dock-height` | 52px | **0** (retire `BOTTOM_DOCK_HEIGHT`) |
| `--chrome-bottom-outer` | dock band + gap | bottom-pane only (when open) |
| `--viewport-bottom-inset` | includes dock | pane + float inset only |

Doc bar height may increase to **48px** chrome (from ~48px today with float card) — net
viewport gain is still ~58px (dock + gap).

### Bottom pane (unchanged role)

| Route | Bottom pane |
| ----- | ----------- |
| `rooms` | Asset palette (collapsed shelf default) |
| `object` | `ObjectBehaviorDrawer` |
| `assets`, `objects`, `collections`, `graph` | hidden / zero height |
| Play mode | hidden (FAB chat in viewport) |

### Play mode doc bar

```
[World title]                              (Edit | Play)     ★ score   👥
```

World routes hidden. Chat FAB returns to viewport corner (existing `RoomChat` play behavior).

---

## Elevation & Depth

Doc bar remains `glass-panel-shell` float card (matches current `AppShell`). No new elevation
tier — routes are inline content inside the existing card, not a nested float.

Chat panel when open: dropdown below doc bar end, `z-index: 40`, same glass recipe as
`RoomChat` drawer today.

---

## Shapes

| Element | Radius / size |
| ------- | ------------- |
| Route hit target | min 44×36px, `border-radius: 8px` |
| Active underline | 2px, `border-radius: 0` |
| Mode pill | `rounded-pill` (existing) |
| Chat unread badge | 14px circle |

Icons: 16px stroke 1.75 (compact top bar vs 18px dock).

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **WorldRouteTabs** | `nav[aria-label=World navigation]` → horizontal `button` per route | default, hover, active (`aria-current=true`), focus-visible | **New** — extract from `BottomDock.svelte` |
| **DocBar** | 4-zone flex row | edit (full), play (collapsed) | `DocBar.svelte` — add routes slot |
| **ShellModeTabs** | pill tablist | edit, play | unchanged |
| **ChatToggle** | icon button + optional unread badge | closed, open (`aria-expanded`), unread | extract chat btn from `BottomDock` |
| **BottomPane** | contextual actions | route-scoped | unchanged |
| **BottomDock** | — | **retired** | delete `BottomDock.svelte`, remove `AppShell` footer |

### World route order

```ts
['graph', 'assets', 'objects', 'collections', 'rooms']
```

Labels: Graph, Assets, Objects, Collections, Rooms. `ui.setRoute(id)` unchanged.

### Active route resolution

Preserve existing logic from `BottomDock.svelte`:

```ts
activeRoute = railRoute === 'rooms' && roomsPaneTab === 'assets' ? 'assets' : railRoute
```

(`object` instance editor is not a world route tab — entered via dblclick / `editObject()`.)

---

## Interaction matrix

| Input | Context | Output |
| ----- | ------- | ------ |
| Click route tab | Edit mode | `ui.setRoute(id)`; left/canvas/right swap per route table |
| Click Graph | Edit | stub canvas (unchanged) |
| Click Collections | Edit | `CollectionsPanel` + `CollectionTable` |
| Click Rooms | Edit | `LeftPanel` + `WorldViewport` + `RightPanel` |
| Click Edit / Play | any | `ui.enterPlay()` / `ui.exitPlay()` |
| Click Chat | Edit | `roomChat.setOpen(!open)`; panel anchors below doc bar right |
| `Escape` | chat open | close chat |
| Window `< 900px` | Edit | route labels hidden; icons + tooltips |
| Window `< 900px` | Edit | overflow `⋯` if routes don't fit (Phase 2 — mock shows icon-only) |
| Play mode | — | routes hidden; chat FAB in viewport |

### Keyboard (Architect to wire)

| Shortcut | Action |
| -------- | ------ |
| `Cmd+1…5` | Routes graph…rooms (optional, match GM asset browser muscle memory) |
| Existing | Edit/Play shortcuts unchanged |

---

## Accessibility

**Focus order (Edit mode):** World title (skip if non-interactive) → route tabs L→R → Edit →
Play → presence avatars → Share → Chat → (chat panel when open).

**Labels:**
- `nav[aria-label="World navigation"]` on route group
- Each route: `aria-label={label}`, `aria-current="true"` when active
- Chat: `aria-expanded`, `aria-controls="room-chat-panel"`

**Motion:** route underline + hover transitions 120ms; respect `prefers-reduced-motion`.

**Contrast:** active route uses foreground text + accent underline (not color-only).

---

## Do's and Don'ts

**Do**

- Keep world routes and room pane tabs visually distinct (underline tabs in doc bar vs
  border-bottom tabs in left panel).
- Hide world routes in Play mode.
- Reclaim dock height from viewport insets immediately on ship.
- Reuse `BottomDock` button styling adapted for horizontal inline layout.

**Don't**

- Put room pane tabs (Room / Instances / Settings) in the doc bar.
- Use full pill fill for active route (fights Edit/Play pill).
- Keep a dead bottom dock stub "for later."
- Move bottom pane content into the doc bar.

---

## Open for Architect

1. **Component split:** `WorldRouteTabs.svelte` + `ChatDocBarButton.svelte` vs single
   `DocBarNav.svelte` — prefer two files mirroring current dock structure.
2. **Doc bar layout:** switch from absolute-centered `ShellModeTabs` to true 4-zone flex
   (mode pill no longer `position: absolute`) — simplifies route insertion.
3. **Chat anchor:** update `RoomChat` positioning when `showFab={false}` to anchor from
   doc bar end (`top: var(--chrome-top-outer)`).
4. **CSS cleanup:** remove `--bottom-dock-height`, `BOTTOM_DOCK_HEIGHT`, `app-bottom-dock`
   styles; update `ui.viewportBottomInset` helper.
5. **Spec drift:** amend `gamemaker_navigation_spec.md` § "World routes → Bottom dock" to
   "World routes → Doc bar."
6. **E2e:** update selectors from `nav[aria-label="World navigation"]` in bottom dock to
   doc bar (role/label unchanged).
7. **Phase 2 (non-blocking):** overflow menu for `<900px` if icon-only still overflows.

---

## Handoff checklist

- [x] `docs/artifacts/doc_bar_world_nav_design.md` (this file)
- [x] `docs/artifacts/doc_bar_world_nav_mockup.html` (self-contained; toggle routes + play)
- [ ] Architect spec issue with AC from "Open for Architect"
- [ ] Update `gamemaker_navigation_spec.md` location table
