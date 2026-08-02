# Proposal — Debug Console (floating dock)

**Status:** shipped · **Labels:** `shipped`  
**Design:** [debug_console_design.md](../artifacts/debug_console_design.md) · [mockup](../artifacts/debug_console_mockup.html) · [spec](../artifacts/debug_console_spec.md)
**Parent wedge:** UI chrome / play-mode developer tools  
**Triggered by:** user request after unified app-chrome shell (doc bar + bordered viewport)

---

## Problem

Play mode currently splits developer feedback across three surfaces:

| Surface | Location | Content |
|--------|----------|---------|
| `StatusBar` | Footer inside app chrome | entities, tick, peers, gamepad, projection |
| `InputHud` | Bottom-left float over canvas | WASD / stick viz |
| Browser devtools | External | JS logs, network, etc. |

The footer status bar fights the unified chrome model (header in frame, viewport in middle). Builders debugging multiplayer, input, and sim state need a **single dock** that feels native to the shell — not a thin strip and a separate HUD.

---

## Goal

Replace the play-mode footer status bar with a **bottom-right debug console**: a compact, tabbed panel that aggregates realtime diagnostics.

### v1 tabs (ship together)

| Tab | Source | Shows |
|-----|--------|-------|
| **Input** | `InputHud` content | stick, WASD, magnitude, keyboard/gamepad source |
| **Stats** | `StatusBar` content | entity count, tick, peers, host/viewer, transport, camera projection, zoom placeholder |
| **Sync** | `session` + `durableSession` | relay/local, peer count, host election, durable live/offline, room id |
| **Logs** | new `debugLog` store | ring buffer of `console.log/warn/error` (last ~200 lines), monospace scroll |

### UX principles

- **Position:** bottom-right inside viewport, same float language as side panels (`--float-inset`, glass/card surface).
- **Default:** collapsed **pill** showing active tab label + one live metric (e.g. `tick 4908`); click expands panel.
- **Tabs:** horizontal tab bar at top of panel (match inspector tab pattern).
- **Chrome:** `bg-card`, border `var(--border)`, `rounded-lg` — not full-width footer.
- **Visibility:** gated by existing `ui.chrome.statsHud` toggle (Scene settings + Settings panel); rename label to **Developer HUD** in settings copy (follow-up OK).
- **Modes:** visible in **play and edit** when toggle on (edit: no input tab activity unless play sim running — show idle state).
- **Remove:** `app-status-slot` footer from `AppShell`; remove bottom-left `InputHud` float from `WorldViewport`.

### Non-goals (v1)

- Log filtering levels UI beyond clear button
- Persisting dock size/position across sessions
- Network packet inspector
- Embedding full browser devtools

---

## Technical sketch (for Architect)

```
src/lib/ui/debug/
  DebugConsole.svelte      # shell: collapsed pill + expanded panel + tabs
  DebugConsoleTab.svelte   # shared tab chrome (optional)
  tabs/
    DebugInputTab.svelte   # port InputHud innards
    DebugStatsTab.svelte   # port StatusBar innards
    DebugSyncTab.svelte    # session/durable readout
    DebugLogsTab.svelte    # scrollable log list
  debugLog.svelte.ts       # console intercept + ring buffer
```

- Mount `DebugConsole` in `WorldViewport` (or `AppShell` viewport layer) when `ui.chrome.statsHud`.
- `AppShell`: drop `statusBar` snippet + `app-status-slot`; `WorldShell` stops passing `StatusBar` to shell.
- `debugLog` installs on client mount; restore original `console.*` on destroy; cap buffer size.

---

## Acceptance criteria (testable)

1. Play mode: no full-width footer bar; app chrome is header + viewport only.
2. Bottom-right dock appears when Developer HUD enabled; collapses/expands.
3. Four tabs render; Input tab shows live stick/keys in play; Stats shows tick/entities; Sync shows peer/transport; Logs captures new console output.
4. Toggle off hides dock entirely.
5. `pnpm check` passes; no regression to edit panels or doc bar.

---

## Dependencies

- Unified app chrome (`AppShell` `app-chrome`) — **done**
- `InputHud`, `StatusBar` — migrate, don't duplicate long-term

---

## Open questions (Designer)

1. Collapsed pill: show tab icon only vs icon + metric?
2. Expanded default size: ~320×240 vs resizable?
3. Logs tab: auto-scroll lock toggle?
4. Should dock sit **above** view controls (ortho/persp gizmo) or below them?

---

## Recommendation

**Ship as next UI chrome wedge** before design-system unification — small surface area, high debug value for MP playtesting.

**Effort:** M (1–2 days impl after design+spec)
