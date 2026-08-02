---
version: alpha
name: Peer Presence Cursors
description: Design artifact for TRL-43 — multiplayer pointer overlays on the 3D viewport (edit mode)
colors:
  viewport: "#0e0e0e"
  viewport-grid: "#1a1a1a"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  surface-overlay: "#242424"
  text: "#e8e8e8"
  text-muted: "#8a8a8a"
  border: "#333333"
  border-focus: "#737373"
  peer-blue: "#0f62fe"
  peer-pink: "#ee5396"
  peer-green: "#42be65"
  peer-orange: "#ff832b"
  peer-purple: "#a56eff"
  peer-teal: "#08bdba"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  cursor-label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
  status:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  cursor-label: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  float-inset: 12px
  cursor-label-offset-x: 16px
  cursor-label-offset-y: 12px
motion:
  remote-cursor: "left 60ms linear, top 60ms linear"
  self-cursor: none
components:
  peer-presence-layer:
    position: absolute
    inset: 0
    zIndex: 1
    pointerEvents: none
    overflow: hidden
  peer-cursor:
    position: absolute
    transform: "translate(-2px, -2px)"
    pointerEvents: none
    willChange: "left, top"
  peer-cursor-svg:
    size: 20px
    dropShadow: "0 1px 1px rgb(0 0 0 / 0.6)"
  peer-cursor-label:
    position: absolute
    left: "{spacing.cursor-label-offset-x}"
    top: "{spacing.cursor-label-offset-y}"
    padding: "1px 6px"
    borderRadius: "{rounded.cursor-label}"
    color: "#ffffff"
    whiteSpace: nowrap
  collaboration-section:
    extends: scene-inspector-section
    title: Collaboration
peer-colors:
  - "{colors.peer-blue}"
  - "{colors.peer-pink}"
  - "{colors.peer-green}"
  - "{colors.peer-orange}"
  - "{colors.peer-purple}"
  - "{colors.peer-teal}"
---

# Design: Peer Presence Cursors

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-42 (Proposal: Peer presence cursors in viewport)  
**Mock:** [peer_presence_cursors_mockup.html](./peer_presence_cursors_mockup.html)  
**Reference:** `trellis-node/examples/universal-presence/svelte` (cursor UX, not transport)  
**Inherits:** [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md) tokens from `src/app.css`

---

## Overview

When two or more browser tabs share a multiplayer room, each editor should **see where others are pointing** in the 3D viewport — colored pointer glyph + short name pill, Figma-style.

**Audience:** builder-engineers co-editing a world in edit mode (`ui.shellMode === 'edit'`).

**Emotional tone:** lightweight social awareness — "someone else is here" — without turning the viewport into a chat UI or blocking orbit/pan.

**Scope:** 2D normalized overlay on `WorldViewport` (not 3D ground-raycast cursors). Edit mode only; play mode uses player avatars.

**Explicit non-goals (v1):** text caret presence, chat, Trellis durable presence, 3D world-space cursors, hiding the OS pointer, play-mode overlays.

## Colors

| Token | Role |
| ----- | ---- |
| `peer-*` palette (6) | Deterministic peer color from `clientId` hash — same peer, same color every session |
| `viewport` | Overlay sits over canvas; cursors must read on dark grid + scene |
| Label fill | Peer color at full opacity; text always `#fff` |
| SVG stroke | `white` 1px outline on pointer path (reference demo) for contrast on any background |

Peer colors reuse the universal-presence demo palette — proven on dark surfaces, distinct at a glance.

## Typography

| Level | Use |
| ----- | --- |
| `cursor-label` (11px/500) | Peer name pill beside pointer |
| `status` (11px mono) | StatusBar peer count (existing — no change required v1) |

Label text: `{shortName}` for peers; `{shortName} (you)` for self.

**Short name derivation (UX, Architect encodes):** last 4 chars of `clientId` prefixed with role hint, e.g. `Host a3f2` / `Peer 9b1c`, or browser-style `Tab · 397` if display name is assigned at join.

## Layout

### Viewport stack (bottom → top)

```
viewport-wrap (relative, receives bubbled pointer events)
├── viewport-canvas (z-index 0) — Threlte Canvas, orbit target
├── peer-presence-layer (z-index 1, pointer-events: none) — cursor glyphs
└── viewport-view-controls (z-index 1, pointer-events: none on wrapper) — ViewControls / gizmo well
```

**Critical:** Do **not** place a pointer-events capture sheet over the canvas — orbit/pan/zoom must keep working. Pointer `move` / `leave` listeners attach to **`viewport-wrap`**; events bubble from canvas.

### Cursor positioning

- Normalized `{ x, y }` ∈ [0, 1] relative to **`viewport-wrap` bounding rect** (not window).
- Render: `left: calc(x * 100%)`, `top: calc(y * 100%)`.
- `OFFSCREEN = -1` for either axis → hide that peer's cursor entirely.
- Clamp in publisher: `x,y ∈ [0, 1]` while on-surface.

### Z-order among peers

Later joiners render above earlier (DOM order). Self cursor renders **last** (always on top) when visible.

## Elevation & Depth

Cursors are **non-glass** flat overlays — no panel chrome. Drop shadow on SVG only (`filter: drop-shadow(...)`). Labels are flat color pills, no border (matches reference demo).

Must not overlap/conflict with ViewControls bottom strip — cursors may pass over gizmo area visually; gizmo remains interactive via canvas hit target below.

## Shapes

| Element | Size |
| ------- | ---- |
| Pointer SVG | 20×20 viewBox, path from universal-presence demo |
| Label pill | auto width, 4px radius, 1px×6px padding |
| Hot spot | translate(-2px, -2px) on cursor root (tip alignment) |

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **PeerPresenceLayer** | Full-bleed absolute container; `{#each peers}` → PeerCursor | hidden (play / disconnected / toggle off / solo); active | **New** `src/lib/ui/PeerPresenceLayer.svelte` |
| **PeerCursor** | SVG pointer + `.label` span | self / remote; visible / offscreen; stale (removed on timeout) | **New** `src/lib/ui/PeerCursor.svelte` |
| **Collaboration section** | Section title + Switch row + optional hint | ≥2 peers / solo / disconnected | **Extend** `SceneInspector.svelte` |
| **Chrome toggle** | `ui.chrome.peerCursors: boolean` | default `true` | **Extend** `ui.svelte.ts` `ChromeToggles` |
| **Viewport host** | Mount layer, wrap listeners | edit mode gate | **Extend** `WorldViewport.svelte` |

## Interaction matrix

| Input | Condition | Output |
| ----- | --------- | ------ |
| `pointermove` on `viewport-wrap` | edit + connected + toggle on | Publish normalized `{x,y}` ~20 Hz (throttled) |
| `pointerleave` on `viewport-wrap` | same | Publish `{x:-1,y:-1}` (OFFSCREEN) |
| Peer `presence` message | x,y ≥ 0 | Show PeerCursor at position; remote uses 60ms CSS transition |
| Peer `presence` message | x or y = -1 | Hide cursor |
| Peer disconnect / timeout | existing `PEER_TIMEOUT_MS` | Remove cursor from layer |
| Toggle off in Scene Inspector | — | Hide all cursors; stop publishing |
| Enter play mode | — | Layer unmounted / hidden; no publish |
| Solo (peerCount === 1) | toggle on | Show **self** cursor only (reference demo behavior) |
| Orbit / pan / zoom | — | Cursors stay viewport-fixed (2D overlay); no world lock |

## Accessibility

- **Focus order:** Toggle is the only focusable new control (Scene Inspector Collaboration section). Cursor overlays are `aria-hidden="true"` decorative.
- **Labels:** Switch: `aria-label="Show peer cursors in viewport"`. Hint text when solo: `"Open another tab on the same room to see collaborators"`.
- **Motion:** Remote cursors use 60ms linear transition. `@media (prefers-reduced-motion: reduce)` → `transition: none` on `.peer-cursor:not(.self)`.
- **Live region:** No cursor position announcements (would be noisy). Existing StatusBar peer count remains sufficient.
- **Contrast:** White stroke on pointer + white label text on saturated peer color — verify WCAG for label pills in impl.

## Do's and Don'ts

**Do**

- Bubble pointer events from canvas — never block Three.js interactivity.
- Show self cursor with `(you)` suffix when enabled.
- Snap peer color from stable hash of `clientId`.
- Hide entire layer in play mode.

**Don't**

- Raycast cursors onto the ground plane in v1.
- Use `cursor: none` on the viewport in v1 (keep OS pointer for orbit affordance).
- Put peer cursors in 3D scene graph.
- Add a second transport UI — piggyback existing session (Architect choice A).

## Open for Architect

1. **NetMessage shape:** `{ t: 'presence'; id: string; x: number; y: number; name?: string; color?: string }` vs separate cursor map in session state.
2. **Publish rate:** 20 Hz cap aligned with `#publish` loop vs dedicated timer.
3. **Name/color assignment:** Host generates palette slot at join vs client proposes color (design: server/host assigns from palette by sorted `clientId` for determinism).
4. **Solo behavior:** Confirm self-only cursor when `peerCount === 1` (design recommends yes — matches reference).
5. **Default toggle:** `peerCursors: true` always vs auto-off when solo.

## Handoff checklist

- [x] `docs/artifacts/peer_presence_cursors_design.md` (this file, DESIGN.md format)
- [x] `docs/artifacts/peer_presence_cursors_mockup.html` (self-contained; CSS vars mirror YAML tokens)
- [ ] Architect encodes AC in TRL-44 spec issue
- [ ] Paths recorded on TRL-43 describe SUMMARY
