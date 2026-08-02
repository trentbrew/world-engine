---
version: 1
name: Debug Console — floating dock
parent: UI-DEBUGCONSOLE
design: docs/artifacts/debug_console_design.md
mock: docs/artifacts/debug_console_mockup.html
status: queue-ready
labels: spec, needs-e2e
---

# Spec: Debug Console (floating dock)

**Parent:** UI-DEBUGCONSOLE (proposal) · design artifact  
**Design:** [debug_console_design.md](./debug_console_design.md)  
**Mock:** [debug_console_mockup.html](./debug_console_mockup.html)  
**Proposal:** [debug-console.md](../backlog/debug-console.md)

---

## Summary

Replace the play-mode **footer status bar** and **bottom-left input HUD** with a single **bottom-right Developer HUD** (`DebugConsole`): collapsed pill by default, expandable 300×220 tabbed panel (Input · Stats · Sync · Logs). Gated by `ui.chrome.statsHud` (display label **Developer HUD**). Visible in **edit and play** when enabled. Chrome remains **header + viewport only** — no footer strip.

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Mount point | `WorldViewport.svelte` — absolute float inside `.viewport-wrap` | Same layer as view-controls; design placement |
| Visibility | `ui.chrome.statsHud === true` in **edit and play** | Design: edit shows idle input state |
| Default state | `expanded = false`, `activeTab = 'stats'` | Session-only; no localStorage |
| Tab persistence | Preserve `activeTab` across collapse/expand in session | Design interaction matrix |
| Footer removal | Remove `statusBar` snippet from `AppShell` entirely | Unified chrome — no `app-status-slot` |
| Legacy files | **Delete** `StatusBar.svelte`, `InputHud.svelte` after port | No duplicate surfaces |
| `PlayModeExitButton` | **Keep** v1 | Out of scope; header Play tab is sufficient but removal is v1.1 |
| Console intercept | `console.log` / `warn` / `error` only; forward to native; cap **200** lines | Design open question |
| SSR / server | `debugLog.install()` no-op when `!browser` | Avoid hydration issues |
| Log install site | `WorldShell.svelte` `onMount` → `debugLog.install()`; `onDestroy` → `debugLog.uninstall()` | Single client lifecycle |
| Logs "new" count | Increment while **collapsed**; reset to 0 on **expand** | Design pill metric for Logs tab |
| Pin scroll default | **On** (auto-scroll tail); toggle disables scroll-into-view | Design |
| Mobile | `display: none` at `max-width: 767px` on `.debug-console` | Match prior InputHud |
| Settings copy | Label **Developer HUD** in `SettingsPanel` + `SceneInspector`; field stays `statsHud` | Design |
| Toaster offset | Update `+layout.svelte` Toaster `offset` if it referenced `--status-bar-height` for play footer — use `--float-inset` only | Footer gone |
| Tab icons (pill) | Lucide: `Gamepad2` Input, `Activity` Stats, `Radio` Sync, `Terminal` Logs | Match shell icon style |
| z-index | `6` on `.debug-console` (above view-controls `1`, below modals) | Design stack |

---

## Types

```ts
// src/lib/ui/debug/types.ts (or inline in debugLog.svelte.ts)
export type DebugConsoleTab = 'input' | 'stats' | 'sync' | 'logs';

export type DebugLogLevel = 'log' | 'warn' | 'error';

export type DebugLogEntry = {
  id: number;
  level: DebugLogLevel;
  text: string;
  ts: number; // Date.now()
};
```

---

## `debugLog.svelte.ts`

```ts
const MAX_LINES = 200;

class DebugLogState {
  entries = $state<DebugLogEntry[]>([]);
  newSinceCollapse = $state(0);
  pinScroll = $state(true);
  #nextId = 0;
  #original: Partial<Pick<Console, 'log' | 'warn' | 'error'>> | null = null;

  install(): void;   // patch console, browser only
  uninstall(): void; // restore originals
  clear(): void;
  markSeen(): void;  // newSinceCollapse = 0 (on expand)
  append(level, args: unknown[]): void; // stringify args safely
}

export const debugLog = new DebugLogState();
```

**Stringify rules:** `JSON.stringify` for objects with fallback; join multiple args with space; truncate single line to **500** chars.

**Playwright note:** intercept must not break app logging; always call `#original` after append.

---

## Component tree

```
WorldViewport.svelte
└── {#if ui.chrome.statsHud}
      DebugConsole.svelte
      ├── [collapsed] button.debug-pill
      └── [expanded] .debug-panel
            ├── .panel-tabs (role=tablist)
            │     ├── tab × 4
            │     └── collapse btn
            └── .panel-body
                  ├── DebugInputTab.svelte
                  ├── DebugStatsTab.svelte
                  ├── DebugSyncTab.svelte
                  └── DebugLogsTab.svelte
```

### `DebugConsole.svelte`

**Local state:**

```ts
let expanded = $state(false);
let activeTab = $state<DebugConsoleTab>('stats');
```

**Collapsed pill content:**

| Tab | Icon | Metric |
| --- | ---- | ------ |
| input | Gamepad2 | `{magnitude.toFixed(2)}` in play with input; else `idle` |
| stats | Activity | `tick {scheduler.tick}` |
| sync | Radio | `{session.peerCount} peers` or `offline` if `!session.connected` |
| logs | Terminal | `{debugLog.newSinceCollapse} new` if collapsed & >0; else truncate latest line 24 chars |

**`aria-label` (collapsed):** `Developer HUD, {Tab}, {metric}, expand`

**Expand:** click pill → `expanded = true`; `debugLog.markSeen()`

**Collapse:** `−` button → `expanded = false`

**Keyboard:** pill — Enter/Space expand; expanded — Escape collapse (viewport-level or on console root)

**CSS (normative from design):**

```css
.debug-console {
  position: absolute;
  right: var(--float-inset);
  bottom: calc(var(--float-inset) + var(--view-controls-height) + var(--spacing-sm));
  z-index: 6;
}
.debug-pill { height: 32px; border-radius: var(--rounded-pill); background: var(--card); border: 2px solid var(--card); ... }
.debug-panel { width: 300px; height: 220px; border-radius: var(--rounded-lg); background: var(--card); box-shadow: 0 8px 24px rgb(0 0 0 / 0.28); }
```

Reuse `.panel-tabs` / `.panel-tab` class names and styles from `RightPanel.svelte` (copy scoped rules or extract shared snippet — prefer **duplicate minimal rules** in `DebugConsole.svelte` to avoid scope refactor v1).

---

## Tab content (field parity)

### `DebugInputTab` ← `InputHud.svelte`

| Field | Source |
| ----- | ------ |
| Stick dot position | `input.axis()` via `scheduler.tick` |
| WASD pressed | `input.anyPressed(...)` |
| Magnitude | `hypot(axis.x, axis.z)` clamped 0–1 |
| Source badge | `gamepad` if connected && axis non-zero else `keyboard` |
| Idle (edit or `shellMode !== 'play'`) | Muted message: `Start play to stream input` — hide stick animation |

Stick well: **52px** diameter (design).

### `DebugStatsTab` ← `StatusBar.svelte`

Two-column grid, all fields from current footer:

- entity count (`world.selectableEntities.length`)
- tick (`scheduler.tick`)
- peers + host/viewer + transport (when `session.connected`)
- durable line (when `durableSession.mode === 'trellis'`)
- gamepad label / no controller
- projection (`Ortho` / `Persp`)
- zoom placeholder `100%`

### `DebugSyncTab`

| Row | Value |
| --- | ----- |
| Room | `collab.roomAlias` |
| Room id | `collab.roomId` (mono) |
| Transport | `session.transportKind` |
| Role | `host` / `viewer` |
| Peers | `session.peerCount` |
| Durable | `live` / `offline` / `static` (hidden row if mode static) |
| Client id | `session.clientId` last 8 (mono, optional v1) |

### `DebugLogsTab`

- Toolbar: **Pin scroll** toggle (`debugLog.pinScroll`), **Clear** button
- Scrollable `.log-lines` — `font-mono` 10px
- Line classes: `.warn`, `.err` by level
- Timestamp: `HH:MM:SS` local from `ts`
- `aria-live="polite"` on container when `pinScroll` (append only)

---

## File changes (Executor checklist)

| Action | Path |
| ------ | ---- |
| **Add** | `src/lib/ui/debug/debugLog.svelte.ts` |
| **Add** | `src/lib/ui/debug/DebugConsole.svelte` |
| **Add** | `src/lib/ui/debug/DebugInputTab.svelte` |
| **Add** | `src/lib/ui/debug/DebugStatsTab.svelte` |
| **Add** | `src/lib/ui/debug/DebugSyncTab.svelte` |
| **Add** | `src/lib/ui/debug/DebugLogsTab.svelte` |
| **Add** | `src/lib/ui/debug/index.ts` (barrel export `DebugConsole`) |
| **Edit** | `src/lib/scene/WorldViewport.svelte` — mount `DebugConsole`; remove `InputHud` block |
| **Edit** | `src/lib/ui/AppShell.svelte` — remove `statusBar` prop, `showStatus`, `app-status-slot`, `:has(.app-status-slot)` panel calc |
| **Edit** | `src/lib/ui/WorldShell.svelte` — remove `StatusBar` import/snippet; `debugLog.install()` lifecycle |
| **Edit** | `src/lib/ui/SettingsPanel.svelte` — label → Developer HUD |
| **Edit** | `src/lib/ui/SceneInspector.svelte` — label → Developer HUD |
| **Edit** | `src/routes/+layout.svelte` — Toaster offset if needed |
| **Delete** | `src/lib/ui/StatusBar.svelte` |
| **Delete** | `src/lib/ui/InputHud.svelte` |

**Do not change:** `ui.chrome.statsHud` field name in `ui.svelte.ts` or `sceneDocument.ts`.

---

## Acceptance criteria

### Build

- [ ] `pnpm check` passes with zero errors.

### Chrome / layout

- [ ] `AppShell` has **no** footer status slot; `app-chrome` = doc bar + viewport body only.
- [ ] `DebugConsole` renders bottom-right above view-controls when `statsHud` on (desktop).
- [ ] Dock **hidden** at viewport width ≤767px.
- [ ] Dock **hidden** when `statsHud` off.

### Collapsed / expanded

- [ ] Default: collapsed pill visible with Stats tab metric (`tick N`).
- [ ] Click pill → expanded 300×220 panel; collapse restores pill with same active tab.
- [ ] Tab switch updates pill icon + metric.

### Tab parity

- [ ] **Input** tab shows live stick/keys in play mode; idle copy in edit.
- [ ] **Stats** tab shows all former `StatusBar` fields.
- [ ] **Sync** tab shows room, transport, peers, durable when applicable.
- [ ] **Logs** tab captures `console.log/warn/error` after load; Clear empties; Pin toggles auto-scroll.

### Logs store

- [ ] Buffer caps at 200 entries (FIFO evict).
- [ ] `newSinceCollapse` increments on append while collapsed; resets on expand.
- [ ] `debugLog.uninstall()` restores native console on teardown.

### Settings

- [ ] Settings + Scene inspector show **Developer HUD** label (not "stats HUD").

### E2E

- [ ] `pnpm test:e2e e2e/smoke.spec.ts` passes (existing suite).
- [ ] Add `e2e/debug-console.spec.ts` (or extend smoke):
  - Enable Developer HUD if default off path exists
  - Enter play → pill visible `aria-label` contains `Developer HUD`
  - Expand → tablist with Input, Stats, Sync, Logs
  - Logs tab shows at least one line after `console.log` from page `evaluate`

### A11y

- [ ] Collapsed: `aria-expanded` false/true; tabs use `role=tablist/tab/tabpanel`.
- [ ] `prefers-reduced-motion`: no expand animation (instant toggle).

---

## Out of scope (v1.1+)

- Resizable / draggable dock
- Log level filter UI
- Remove `PlayModeExitButton`
- Persist expanded state in localStorage
- Network packet inspector

---

## Verification commands

```bash
pnpm check
pnpm test:e2e e2e/smoke.spec.ts
pnpm test:e2e e2e/debug-console.spec.ts   # after Executor adds
```

---

## Handoff to Executor

Implement in order:

1. `debugLog.svelte.ts` + WorldShell install
2. Tab components (port Input/Stats first)
3. `DebugConsole.svelte` shell
4. WorldViewport mount
5. AppShell / WorldShell cleanup + file deletes
6. Settings labels
7. E2E spec

Reference mock: open `docs/artifacts/debug_console_mockup.html` for visual QA.
