---
version: alpha
name: Play Mode & Dedicated Controls Shell
description: Design artifact — persistent Play/Preview CTA, dedicated affordances for chrome toggles, camera, orbit navigation, and controller config; decouple from toolbar and content rail
colors:
  viewport: "#0e0e0e"
  viewport-grid: "#1a1a1a"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  surface-overlay: "#242424"
  surface-glass: "color-mix(in srgb, #242424 42%, transparent)"
  text: "#e4e4e4"
  text-muted: "#949494"
  text-mono: "#b0b0b0"
  primary: "#e8e8e8"
  primary-foreground: "#0e0e0e"
  accent-play: "#86efac"
  accent-play-foreground: "#0a1a0f"
  accent-edit: "#c8c8c8"
  accent-entity: "#c8c8c8"
  accent-link: "#b4b4b4"
  success: "#86efac"
  destructive: "#ef4444"
  border: "#2a2a2a"
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
  controls-pill-width: 44px
  sidebar-width: 200px
  attributes-width: 260px
  popover-width: 240px
  toolbar-height: 40px
  float-inset: 16px
components:
  toolbar:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.border}"
    height: "{spacing.toolbar-height}"
    position: docked
  play-button:
    backgroundColor: "{colors.accent-play}"
    color: "{colors.accent-play-foreground}"
    borderRadius: "{rounded.sm}"
    height: 28px
    minWidth: 88px
    fontWeight: 600
  play-button-active:
    backgroundColor: "{colors.surface-overlay}"
    color: "{colors.text}"
    border: "1px solid {colors.border}"
  controls-pill:
    backgroundColor: "{colors.surface-glass}"
    backdropFilter: blur(16px)
    border: "1px solid color-mix(in srgb, {colors.border} 55%, transparent)"
    borderRadius: "{rounded.lg}"
    width: "{spacing.controls-pill-width}"
  control-popover:
    backgroundColor: "{colors.surface-overlay}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.md}"
    width: "{spacing.popover-width}"
    boxShadow: "0 8px 32px rgb(0 0 0 / 0.45)"
  rail-pill:
    extends: controls-pill
    width: "{spacing.rail-pill-width}"
  stats-hud:
    backgroundColor: "{colors.surface-glass}"
    backdropFilter: blur(16px)
    borderRadius: "{rounded.lg}"
---

# Design: Play Mode & Dedicated Controls Shell

**Status:** Design complete (handoff to Architect)  
**Parent:** Floating chrome evolution + authoring UX (extends [floating_chrome_shell_design.md](./floating_chrome_shell_design.md))  
**Mock:** [play_mode_controls_shell_mockup.html](./play_mode_controls_shell_mockup.html)  
**Inherits:** `app.css` tokens (dark viewport, 42% glass), left content rail, bottom-right stats HUD

---

## Overview

Today **camera**, **inspector**, and future **input** controls share the docked toolbar and bleed into the **content rail** (World vs Entities ambiguity). Builders need a clear mental model:

| Layer | Purpose | Examples |
| ----- | ------- | -------- |
| **Mode** | Edit the world vs experience it | Play / Preview |
| **Content** | What you're editing | World, Entities, Assets, Settings |
| **Viewport controls** | How you see & navigate the canvas | Camera, Orbit, Chrome toggles, Input |

**Play / Preview** is the **primary persistent CTA** — top-right in the docked toolbar, always visible. It switches global shell mode; it is not buried in a rail icon or mixed with file metadata.

**Dedicated affordances** — a **right-side controls pill** (mirror of the left content rail) hosts four icon triggers. Each opens a **scoped popover** for one concern. No multi-purpose toolbar buttons.

**Audience:** builder-engineer authoring JSON-LD worlds; needs fast edit ↔ play loop without losing spatial context.

**Emotional tone:** canvas remains hero; controls feel like instrument clusters, not app chrome clutter.

**Scope:** shell layout, interaction model, popover anatomy, play-mode visibility rules. No engine rewrite of camera/gamepad internals in this pass — surface existing state + stub Settings fields where config UI is not yet wired.

**Non-goals:** float the toolbar; redesign inspector fields; multiplayer lobby UI; mobile play-mode polish (defer bottom-sheet controls).

## Colors

Extends current dark palette. New tokens:

| Token | Role |
| ----- | ---- |
| `accent-play` | Play CTA fill (green — "go live in viewport") |
| `accent-play-foreground` | Play label + icon on green |
| `accent-edit` | Edit-mode subtle highlights |
| `surface-glass` @ 42% | Left rail, right controls pill, stats HUD (already shipped) |

Play button is the **only saturated accent** in the shell — draws the eye to mode switch. Control popovers use solid `surface-overlay` for readable forms.

## Typography

Unchanged: DM Sans UI, uppercase 11px section labels in popovers, JetBrains Mono for mapping keys and file title.

## Layout

### Desktop (≥768px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ world.jsonld                                      [ ▶ Play ]  ← toolbar │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ [content]                                    [controls]    [attributes] │
│  rail                                           pill         (edit)     │
│  World                                          🎥                      │
│  Entities                                       🔄                      │
│  Assets                                         ⊞                       │
│  Settings                                       🎮                      │
│                                                                         │
│                    VIEWPORT (full bleed)                                │
│                                                                         │
│                                              [ stats HUD ]              │
└─────────────────────────────────────────────────────────────────────────┘
```

| Region | Position | Visible |
| ------ | -------- | ------- |
| **Toolbar** | docked row 1 | always — title left, **Play** right |
| **Content rail** | float top-left | **Edit mode only** |
| **Controls pill** | float top-right, below toolbar + inset | always (popover content mode-aware) |
| **Attributes float** | float top-right, left of controls pill | Edit + inspector + selection |
| **Sidebar float** | float top-left, after content rail | Edit + content route ≠ world |
| **Stats HUD** | float bottom-right | always (telemetry, not configuration) |

**Controls pill placement:** `top: toolbar-height + float-inset`, `right: float-inset`. Attributes panel sits to its left with 8px gap when open.

**Z-index stack** (additions):

| Layer | z-index |
| ----- | ------- |
| Stats HUD | 17 |
| Content rail | 18 |
| Controls pill | 21 |
| Control popovers | 22 |
| Attributes | 20 |
| Dialog | 40 |

### Mobile (<768px)

- Play stays in toolbar top-right.
- Controls pill → **horizontal strip** above stats HUD (4 icons, 36px targets).
- Content rail hidden (existing); routes via toolbar overflow or bottom sheet (defer detail).

## Elevation & Depth

- Toolbar: flat dock, no shadow.
- Rails/pills: glass per [floating_chrome_shell_design.md](./floating_chrome_shell_design.md).
- Popovers: opaque `surface-overlay` + shadow — forms need contrast, not blur-through.
- Active control icon: lighter glass fill (no inset border — matches rail refresh).

## Shapes

| Element | Size / radius |
| ------- | ------------- |
| Play button | 28px tall, min 88px wide, `rounded-sm` |
| Control / rail icons | 36×36, `rounded-sm` |
| Popovers | 240px wide, `rounded-md`, 12px internal padding |
| Section labels in popovers | uppercase 11px, 8px bottom margin |

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **WorldToolbar** | title only + Play CTA | edit / playing | `WorldToolbar.svelte` — remove camera + inspector buttons |
| **PlayModeButton** | icon + label; `▶ Play` / `◼ Stop` | default, hover, playing, focus | new `PlayModeButton.svelte` |
| **ContentRail** | World, Entities, Assets, Settings | route active | `WorldRail.svelte` — no behavior toggles |
| **ControlsPill** | 4 stacked icon buttons | popover open (one at a time) | new `ControlsPill.svelte` |
| **ChromePopover** | panel toggles | inspector, attributes, grid, gizmos | new popover snippet |
| **CameraPopover** | mode + actions | orbit / follow, reset, focus selection | wraps `camera.svelte.ts` |
| **OrbitPopover** | navigation prefs | sensitivity, invert Y, zoom speed | new prefs in `ui` or `camera` state (stub sliders OK) |
| **InputPopover** | device status + deadzone + link | connected / none | wraps `gamepad.svelte.ts`; deep link Settings |
| **Settings route** | full mapping table | future | rail Settings → sheet (stub in v1) |
| **WorldStatsHud** | telemetry strip | always | `WorldStatsHud.svelte` (unchanged role) |

### Play / Preview button (primary CTA)

- **Location:** toolbar far right, 16px from edge.
- **Edit mode label:** `▶ Play` — green fill (`accent-play`).
- **Play mode label:** `◼ Stop` — muted outline (stop is destructive-adjacent but not red — avoid panic).
- **Keyboard:** `P` toggles (when not typing in input).
- **Behavior on enter Play:**
  - Set `ui.shellMode = 'play'`.
  - Hide content rail, sidebar, attributes (animate out 180ms).
  - Clear selection / close pick mode.
  - Force camera `follow` if local player exists, else stay `orbit`.
  - Enable player input integration (existing systems).
- **Behavior on exit Play:**
  - Set `ui.shellMode = 'edit'`.
  - Restore prior `railRoute` and inspector visibility (remember in `ui` snapshot).
  - Camera returns to prior mode (orbit default).

### Content rail (left) — routes only

Fix World vs Entities confusion from prior session:

| Route | Action | Sidebar |
| ----- | ------ | ------- |
| **World** | `railRoute=world`; deselect | hidden |
| **Entities** | `railRoute=entities`; open inspector if closed | EntityList |
| **Assets** | `railRoute=assets`; open inspector if closed | AssetsPanel |
| **Settings** | `railRoute=settings`; open settings sheet | Settings panel (new stub) |

**Remove** inspector toggle from toolbar. **Remove** `toggleInspector()` from Entities click — Entities **opens** list; closing list = click World or Esc on empty chrome (Architect AC).

### Controls pill (right) — dedicated affordances

Four icons, top to bottom. **One popover open at a time**; click same icon closes; click outside closes.

| Icon | Lucide | Popover title | Contents |
| ---- | ------ | ------------- | -------- |
| Chrome | `layout-panel-left` | Panels | Toggles: Entity list, Attributes, Grid overlay, Selection outline (checkboxes) |
| Camera | `video` or `crosshair` | Camera | Segmented: Orbit / Follow; actions: Reset view, Focus selection; read-only: active mode |
| Orbit | `orbit` | Navigation | Sliders: Orbit speed, Zoom speed; toggle: Invert Y; button: Reset defaults |
| Input | `gamepad-2` | Input | Connection status; deadzone slider; "Configure mappings…" → Settings route |

**Edit vs Play in popovers:**

- **Play mode:** Camera + Input popovers remain useful; Chrome popover hidden or disabled (no panels); Orbit popover available if camera is orbit.
- Controls pill **stays visible** during play so user can adjust camera/input without stopping — but chrome toggles are suppressed.

### Settings route (controller mappings)

Rail **Settings** opens a sidebar/sheet with tabs:

1. **Input** — full button/axis mapping table (read-only v1 showing current hardcoded map from `gamepad.svelte.ts`)
2. **Camera** — defaults for edit vs play mode
3. **Shell** — reduced motion, stats HUD visibility

Input popover **"Configure mappings…"** jumps to Settings → Input tab.

## Interaction matrix

| Input | Context | Output |
| ----- | ------- | ------ |
| Click **Play** | edit | enter play mode; hide authoring chrome |
| Click **Stop** | play | exit play mode; restore chrome snapshot |
| `P` key | not in text field | toggle play mode |
| Content rail **World** | edit | hide sidebar; clear selection |
| Content rail **Entities** | edit | show EntityList; inspector open |
| Content rail **Assets** | edit | show AssetsPanel |
| Content rail **Settings** | edit | show Settings sheet |
| Controls **Chrome** | edit | toggle popover; checkboxes sync panel visibility |
| Controls **Camera** | any | set orbit/follow; reset/focus actions |
| Controls **Orbit** | any | adjust prefs (localStorage persist optional) |
| Controls **Input** | any | deadzone tweak; link to Settings |
| Stats HUD click | — | no action (telemetry only) |
| Esc | popover open | close popover |
| Esc | play mode | exit play mode (optional AC — confirm with product) |

**Motion:** popovers fade+scale 120ms; play mode chrome hide uses existing 180ms float transition. `prefers-reduced-motion` → instant.

## Accessibility

- **Focus order:** skip-link → toolbar (title, Play) → content rail (edit) → controls pill → open popover → sidebar → attributes → stats (inert).
- **Play button:** `aria-pressed` when playing; label switches Play/Stop; live region announces mode change.
- **Controls pill:** `aria-label="Viewport controls"`; each icon `aria-expanded` + `aria-controls` pointing to popover id.
- **Popovers:** focus trap while open; return focus to trigger on close.
- **Play mode:** ensure Stop is reachable via keyboard without hunting hidden rails.
- **Contrast:** Play green on `#0a1a0f` text ≥4.5:1; glass icons use `text` not muted.

## Do's and Don'ts

**Do**

- Keep Play as the only primary filled CTA in the shell
- Mirror left content rail with right controls pill (spatial symmetry)
- Scope each popover to one mental model (camera ≠ orbit ≠ chrome ≠ input)
- Persist edit-mode chrome snapshot across play sessions in tab
- Keep stats HUD as read-only telemetry separate from config popovers

**Don't**

- Put camera, inspector, or gamepad toggles in the docked toolbar
- Use content rail icons for behavior toggles (Entities ≠ inspector toggle)
- Auto-enter play on load
- Hide Stop button during play (user must always have exit)
- Mix orbit sensitivity into camera mode popover (keep navigation separate)

## Open for Architect

1. **State model:** `ui.shellMode: 'edit' | 'play'` + `ui.chromeSnapshot` for restore — where persisted?
2. **World vs Entities:** adopt table above (Entities opens list, no toggle) — breaking change to `WorldRail.svelte` + remove toolbar Inspector btn.
3. **Orbit prefs:** new `camera.orbitPrefs` module vs extend `camera.svelte.ts` — which owns sliders?
4. **Settings stub:** empty mapping table OK for v1, or ship read-only from `readPad()` indices?
5. **Play mode Esc:** exit play or close popover first? Recommend popover first, then play.
6. **Attributes position:** when controls pill + attributes both open, attributes left of pill — confirm width budget on 1280px.
7. **Phasing:** PR1 Play + toolbar cleanup; PR2 Controls pill + popovers; PR3 Settings route?

## Handoff checklist

- [x] `docs/artifacts/play_mode_controls_shell_design.md` (this file)
- [x] `docs/artifacts/play_mode_controls_shell_mockup.html`
- [ ] Trellis design issue + `describe` SUMMARY (CLI unavailable this session)
