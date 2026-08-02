---
version: alpha
name: Debug Console — floating dock
description: Design artifact for UI-DEBUGCONSOLE — tabbed bottom-right developer HUD replacing footer status bar and input HUD
colors:
  background: "oklch(0.145 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.205 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  primary: "oklch(0.922 0 0)"
  border: "oklch(1 0 0 / 10%)"
  ring: "oklch(0.556 0 0)"
  viewport: "oklch(0.1 0 0)"
  success: "oklch(0.696 0.17 162.48)"
  destructive: "oklch(0.704 0.191 22.216)"
  log-warn: "oklch(0.75 0.12 85)"
typography:
  body:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: 600
    letterSpacing: 0.06em
  mono:
    fontFamily: Geist Mono
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  float-inset: 12px
components:
  debugConsoleCollapsed:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    borderRadius: "{rounded.pill}"
    height: 32px
    minWidth: 120px
    padding: "0 10px 0 8px"
  debugConsoleExpanded:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    borderRadius: "{rounded.lg}"
    width: 300px
    height: 220px
  debugConsoleTab:
    fontSize: 11px
    fontWeight: 500
    padding: "8px 10px"
    activeIndicator: "{colors.primary}"
---

# Design: Debug Console (floating dock)

**Status:** Design complete (handoff to Architect)  
**Parent:** UI-DEBUGCONSOLE ([debug-console.md](../backlog/debug-console.md))  
**Mock:** [debug_console_mockup.html](./debug_console_mockup.html)

---

## Overview

Consolidate play-mode diagnostics into a **single bottom-right dock** inside the viewport. The dock replaces the full-width footer `StatusBar` and the bottom-left `InputHud`, aligning with the unified app-chrome model (header inside border; viewport fills middle; **no footer strip**).

**Posture:** utilitarian, monospace-friendly, low visual weight when collapsed. Builders and multiplayer testers get at-a-glance tick/peers/input without opening browser devtools.

**Density:** compact — smaller than side panels; expanded footprint **300×220px** fixed in v1.

**Toggle:** existing `ui.chrome.statsHud` (settings copy → **Developer HUD** in impl).

---

## Colors

| Role | Token | Usage |
|------|-------|-------|
| Panel surface | `{colors.card}` | Collapsed pill + expanded shell |
| Body text | `{colors.foreground}` | Active values, pressed keys |
| Muted | `{colors.muted-foreground}` | Labels, idle keys, log timestamps |
| Border | `{colors.border}` | Panel outline, stick well, key caps |
| Tab active | `{colors.primary}` | Bottom border on active tab (match `panel-tab`) |
| Log warn | `{colors.log-warn}` | `console.warn` lines |
| Log error | `{colors.destructive}` | `console.error` lines |
| Sync live | `{colors.success}` | "live" / connected badges |

Inherit shadcn neutral dark from `app.css`; do not introduce a third token vocabulary.

---

## Typography

- **UI:** Geist 11–12px for tabs, labels, stat rows.
- **Mono:** Geist Mono 10px for tick, room id, log lines, magnitude.
- **Section labels:** 10px uppercase, `letter-spacing: 0.06em`, muted (match `InputHud` `.hud-label`).

---

## Layout

### Placement

```
viewport (relative)
├── view-controls (center bottom, z-index 1)     ← unchanged
├── debug-console (bottom-right, z-index 6)      ← NEW
└── play-exit (top-right, z-index 5)               ← keep; may remove later
```

- **Anchor:** `right: var(--float-inset)`; `bottom: calc(var(--float-inset) + var(--view-controls-height) + var(--spacing-sm))` — sits **above** the ortho/persp gizmo row with 8px gap.
- **Edit mode:** same position when Developer HUD on (input tab shows idle state).
- **Play mode:** no footer `app-status-slot`; chrome = header + viewport only.

### Collapsed pill (default on first show)

| Zone | Content |
|------|---------|
| Leading | 14px tab icon (active tab) |
| Body | `{tabLabel}` muted · **`{liveMetric}`** foreground |
| Trailing | chevron-up 14px (expand affordance) |

**Live metric per tab (collapsed):**

| Tab | Metric |
|-----|--------|
| Input | `0.42` magnitude or `keyboard` / `gamepad` |
| Stats | `tick {n}` |
| Sync | `{n} peers` or `offline` |
| Logs | `{n} new` (count since last expand) or latest line truncated |

**Decision:** icon + metric (not icon-only) — scannable without expanding.

### Expanded panel

```
┌─────────────────────────────────────┐
│ Input │ Stats │ Sync │ Logs    [ − ] │  ← tab bar + collapse
├─────────────────────────────────────┤
│                                     │
│  (tab body — scroll if overflow)    │
│                                     │
└─────────────────────────────────────┘
```

- **Size:** 300×220px fixed; not resizable v1.
- **Collapse:** `−` icon button top-right of tab row (or chevron-down); returns to pill preserving active tab.
- **Pointer events:** panel is interactive (logs scroll, clear btn); collapsed pill clickable.

---

## Elevation & Depth

- **Surface:** solid `{colors.card}` (not glass) — matches side panels / doc bar.
- **Border:** 1px `{colors.border}`; optional inset ring `color-mix(border 40%)` like `app-chrome`.
- **Shadow:** `0 8px 24px rgb(0 0 0 / 0.28)` on expanded only.
- **No** full-width footer separator — dock floats over viewport.

---

## Shapes

- Collapsed: `{rounded.pill}`.
- Expanded: `{rounded.lg}` (14px) — match app chrome corners.
- Tab bar: underline active indicator 2px (reuse `.panel-tab` pattern from `RightPanel.svelte`).
- Input stick well: 52px circle (slightly smaller than current 58px to fit panel).

---

## Components

| Component | Anatomy | States | Maps to codebase |
|-----------|---------|--------|------------------|
| `DebugConsole` | pill OR expanded shell; owns `expanded` + `activeTab` local state | collapsed, expanded; hidden when `!statsHud` | **new** `src/lib/ui/debug/DebugConsole.svelte` |
| `DebugConsolePill` | icon + label + metric + chevron | hover, focus, per-tab metric | child of DebugConsole |
| `DebugConsoleTabs` | 4 equal tabs + collapse btn | active tab | mirror `RightPanel` `.panel-tabs` |
| `DebugInputTab` | header (source badge), stick well, WASD grid, mag bar | idle (edit), live (play), gamepad/keyboard | port from `InputHud.svelte` |
| `DebugStatsTab` | two-column stat grid | play + edit | port from `StatusBar.svelte` |
| `DebugSyncTab` | labeled rows: transport, role, room, peers, durable | connected / solo / offline | session + durableSession |
| `DebugLogsTab` | toolbar (pin scroll, clear) + mono scroll list | empty, streaming, pinned | **new** `debugLog.svelte.ts` |
| `debugLog` store | ring buffer ~200 entries `{level, text, ts}` | — | install console intercept client-side |

**Removals (Executor):**

- `AppShell` `statusBar` snippet + `app-status-slot`
- `WorldViewport` `.viewport-input-hud` + `InputHud` import
- `WorldShell` `<StatusBar />` pass-through
- Deprecate/delete `StatusBar.svelte`, `InputHud.svelte` after port

---

## Interaction matrix

| Input | States | Output |
|-------|--------|--------|
| Click collapsed pill | any tab active | expand panel; metric freeze until next collapse |
| Click `−` / chevron | expanded | collapse to pill |
| Tab click | expanded | switch body; update pill icon + metric |
| `statsHud` toggle off | — | unmount dock |
| Logs **Clear** | logs tab | empty buffer |
| Logs **Pin** toggle | logs tab | disable/enable auto-scroll on new lines |
| Play → Edit | sim stopped | Input tab → idle copy: "Start play to stream input" |
| Keyboard | pill focused | Enter/Space expand; Escape collapse |

**Logs pin default:** auto-scroll **on**; pin icon filled when locked to bottom.

---

## Accessibility

- **Role:** expanded region `role="region"` `aria-label="Developer HUD"`.
- **Collapsed:** `aria-expanded="false"`; button `aria-label="Developer HUD, Stats, tick 4908, expand"`.
- **Tabs:** `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`.
- **Logs:** `aria-live="polite"` on tail when auto-scroll on (throttle 500ms).
- **Focus order:** pill → expand → tab list → tab panel → collapse.
- **Motion:** `prefers-reduced-motion` — instant expand/collapse, no slide animation.

---

## Do's and Don'ts

**Do**

- Reuse `.panel-tab` visual pattern for tab bar consistency.
- Keep dock above view-controls vertical stack.
- Preserve all current StatusBar + InputHud data fields in v1 tabs.
- Gate entire dock behind `statsHud` / Developer HUD toggle.

**Don't**

- Reintroduce full-width footer bar.
- Use glass blur on dock (card solid only).
- Resize handles or drag-reposition in v1.
- Block view-controls hit targets (center bottom stays clear).

---

## Open for Architect

1. **State persistence:** `expanded` + `activeTab` — session-only (no localStorage v1). Confirm in spec.
2. **Console intercept:** patch `console.log/warn/error` only; pass-through to native; cap 200 lines; SSR no-op.
3. **Logs "new" badge:** count lines appended while collapsed; reset on expand.
4. **Settings rename:** `statsHud` → display string "Developer HUD" only (field name can stay).
5. **PlayModeExitButton:** redundant with header Play tab — spec optional removal v1 or v1.1.
6. **Mobile:** hide dock `<768px` (match InputHud mobile hide) unless human wants otherwise.

---

## Handoff checklist

- [x] `docs/artifacts/debug_console_design.md` (this file)
- [x] `docs/artifacts/debug_console_mockup.html`
- [x] `docs/artifacts/debug_console_spec.md`
- [ ] Executor impl + Reviewer PASS
