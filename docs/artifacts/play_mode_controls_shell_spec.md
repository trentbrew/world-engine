---
version: 1
name: Play Mode & Dedicated Controls Shell
parent: play-mode-controls-shell (design)
design: docs/artifacts/play_mode_controls_shell_design.md
mock: docs/artifacts/play_mode_controls_shell_mockup.html
status: queue-ready
---

# Spec: Play Mode & Dedicated Controls Shell

**Parent:** Floating chrome evolution (post–floating_chrome_shell)  
**Design:** [play_mode_controls_shell_design.md](./play_mode_controls_shell_design.md)  
**Mock:** [play_mode_controls_shell_mockup.html](./play_mode_controls_shell_mockup.html)

---

## Summary

Introduce **Edit ↔ Play** as a first-class shell mode with a persistent **Play** CTA in the docked toolbar. Remove camera and inspector toggles from the toolbar. Add a **right-side controls pill** (mirror of left content rail) with four scoped popovers: Panels, Camera, Navigation, Input. Fix **content rail** semantics (World vs Entities). Add **Settings** sidebar stub. Reposition **attributes** left of the controls pill.

Play mode hides authoring chrome (content rail, sidebar, attributes) while keeping controls pill + stats HUD + Stop accessible.

---

## Architect decisions (closes design open questions)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Shell mode state | `ui.shellMode: 'edit' \| 'play'` in `ui.svelte.ts` | Ephemeral UI concern; not world graph |
| Chrome snapshot | `ui.enterPlay()` / `ui.exitPlay()` capture & restore `railRoute`, `chrome` toggles, `camera.mode` in memory only (no localStorage) | Tab-scoped restore; avoid fighting `sessionStorage` inspector pref |
| Panel visibility | New `ui.chrome` object replaces ad-hoc `world.inspectorOpen` for layout | Single source for Panels popover + AppShell visibility |
| `world.inspectorOpen` | **Deprecate for layout** — keep field temporarily as derived getter `sidebarVisible \|\| attributesVisible` OR remove after migration | Avoid dual toggles; Executor removes toolbar/rail `toggleInspector()` calls |
| Orbit prefs | Extend `camera.svelte.ts` → `orbitPrefs` runes (`rotateSpeed`, `zoomSpeed`, `invertY`); wire to `WorldScene.svelte` `OrbitControls` props | Camera module already owns orbit vs follow |
| Deadzone | Export `DEADZONE` from `gamepad.svelte.ts` as mutable `gamepad.deadzone` (default 0.14) | Input popover slider; no remapping engine yet |
| Settings v1 | Read-only mapping table from `readPad()` indices (document in UI) | Ship affordance; editable mappings deferred |
| Esc during play | **Popover first**, second Esc exits play (when no popover open) | Matches design recommendation |
| Attributes vs controls | Attributes `right: calc(float-inset + controls-pill-width + sm)`; controls pill at `right: float-inset` | 1280px budget: 260 + 8 + 44 + 16×2 = 344px right margin — acceptable |
| Popover primitive | Install shadcn-svelte **Popover** (`pnpm dlx shadcn-svelte@latest add popover`) | Focus trap, a11y, positioning; no dialog misuse |
| Phasing | **Three impl PRs** recommended (below); each PR must pass `pnpm check` + `pnpm build` | Reduces review surface; PR1 shippable alone |

---

## State model (`src/lib/ui/ui.svelte.ts`)

```ts
export type ShellMode = 'edit' | 'play';
export type SettingsTab = 'input' | 'camera' | 'shell';

export type ChromeToggles = {
  sidebar: boolean;      // entity list / assets panel
  attributes: boolean;
  grid: boolean;         // v1: UI toggle only; wire grid visibility if trivial
  selectionOutline: boolean;
};

export type ChromeSnapshot = {
  railRoute: RailRoute;
  chrome: ChromeToggles;
  cameraMode: 'orbit' | 'follow';
  settingsTab?: SettingsTab;
};

class UIState {
  shellMode = $state<ShellMode>('edit');
  railRoute = $state<RailRoute>('world');
  chrome = $state<ChromeToggles>({
    sidebar: true,
    attributes: true,
    grid: true,
    selectionOutline: true,
  });
  settingsTab = $state<SettingsTab>('input');
  openControlPopover = $state<'chrome' | 'camera' | 'orbit' | 'input' | null>(null);
  assetPickTarget = $state<AssetPickTarget | null>(null);
  addEntityOpen = $state(false);
  #playSnapshot: ChromeSnapshot | null = null;

  enterPlay() { /* capture snapshot; set shellMode play; apply play side-effects */ }
  exitPlay() { /* restore snapshot; set shellMode edit */ }
  openSettings(tab: SettingsTab = 'input') {
    this.railRoute = 'settings';
    this.settingsTab = tab;
    this.chrome.sidebar = true;
  }
}
```

### Play enter side-effects (called from `enterPlay()`)

1. Snapshot current `railRoute`, `chrome`, `camera.mode`.
2. Set `shellMode = 'play'`.
3. Clear `assetPickTarget`; `world.select(null)`.
4. Close any open control popover.
5. If `world.localPlayerId` → `camera.mode = 'follow'`, else leave current mode.

### Play exit side-effects (`exitPlay()`)

1. Restore snapshot (rail, chrome, camera mode).
2. Set `shellMode = 'edit'`.
3. Clear `#playSnapshot`.

---

## Camera module (`src/lib/engine/render/camera.svelte.ts`)

Add:

```ts
type OrbitPrefs = {
  rotateSpeed: number;  // default 0.7 — matches WorldScene today
  zoomSpeed: number;    // default 1.2
  invertY: boolean;     // default false
};

class CameraState {
  mode = $state<'orbit' | 'follow'>('orbit');
  orbitPrefs = $state<OrbitPrefs>({ rotateSpeed: 0.7, zoomSpeed: 1.2, invertY: false });
  #playModeSnapshot: 'orbit' | 'follow' | null = null;

  setMode(mode: 'orbit' | 'follow') { this.mode = mode; }
  resetOrbitDefaults() { /* reset orbitPrefs to defaults */ }
  resetView() { /* emit event or callback — see below */ }
  focusSelection() { /* emit event — see below */ }
}
```

**Reset view / Focus selection:** Use a lightweight event bus or `$state` tick in `camera.svelte.ts` (e.g. `viewCommand: { kind: 'reset' | 'focus'; seq: number }`) consumed by `WorldScene.svelte` / `FollowCamera.svelte` to reset OrbitControls target or refit to `world.selectedEntity` bounds. No three.js types in `ui/`.

**WorldScene wiring:** Bind `OrbitControls` `rotateSpeed`, `zoomSpeed` from `camera.orbitPrefs`. `invertY` → set `rotateSpeed` sign or use OrbitControls `reverseOrbit` if available in threlte extras; if not, document as no-op with disabled toggle until supported.

---

## Gamepad module (`src/lib/engine/player/gamepad.svelte.ts`)

- Export mutable `deadzone = $state(0.14)` (replace `const DEADZONE`).
- Add `getMappingTable(): { control: string; source: string }[]` returning read-only rows for Settings / Input popover, e.g.:
  - Left stick X → move X (axis 0)
  - Left stick Y → move Z (axis 1)
  - D-pad 12–15 → move

---

## CSS variables (`src/app.css`)

Add to `:root`:

```css
--accent-play: #86efac;
--accent-play-foreground: #0a1a0f;
--controls-pill-width: 44px;
--popover-width: 240px;
```

---

## Layout spec (`AppShell.svelte`)

### New snippet

```svelte
controls?: Snippet;  /* ControlsPill wrapper */
```

### Visibility rules (replace current `world.inspectorOpen` gates)

| Element | Condition |
| ------- | --------- |
| Content rail float | `ui.shellMode === 'edit'` |
| Sidebar float | `ui.shellMode === 'edit' && ui.chrome.sidebar && ui.railRoute !== 'world'` |
| Attributes float | `ui.shellMode === 'edit' && ui.chrome.attributes && world.selectedEntity` |
| Controls float | always |
| Stats HUD | always |
| Selection outline (scene) | `ui.chrome.selectionOutline && ui.shellMode === 'edit'` |

### Positioning updates

| Element | CSS |
| ------- | --- |
| `.app-controls-float` | `absolute; top: var(--float-inset); right: var(--float-inset); z-index: 21` |
| `.app-attributes-float` | `right: calc(var(--float-inset) + var(--controls-pill-width) + var(--spacing-sm)); z-index: 20` |
| Control popovers | open from pill; `z-index: 22`; positioned left of pill (`side="left"` in Popover) |

### Play mode class

```svelte
<div class="app-shell" class:playing={ui.shellMode === 'play'}>
```

Optional: `.app-shell.playing .app-rail-float { opacity: 0; pointer-events: none }` via existing transition pattern.

### Sidebar label

Extend `sidebarLabel` derived:

| `ui.railRoute` | `aria-label` |
| -------------- | ------------ |
| `entities` | Entity list |
| `assets` | Asset library |
| `settings` | Settings |

---

## Component map

| File | Action |
| ---- | ------ |
| `ui.svelte.ts` | Add shell mode, chrome toggles, play enter/exit, settings tab |
| `WorldToolbar.svelte` | Title + `PlayModeButton` only — **remove** camera + inspector buttons |
| `PlayModeButton.svelte` | **New** — Play/Stop, `aria-pressed`, green accent, calls `ui.enterPlay` / `ui.exitPlay` |
| `ControlsPill.svelte` | **New** — 4 triggers + popover panels |
| `ChromePopover.svelte` | **New** — checkboxes bound to `ui.chrome.*` |
| `CameraPopover.svelte` | **New** — segmented orbit/follow, reset/focus buttons |
| `OrbitPopover.svelte` | **New** — sliders + invert + reset defaults |
| `InputPopover.svelte` | **New** — status, deadzone slider, link to settings |
| `SettingsPanel.svelte` | **New** — tabs Input / Camera / Shell; read-only mapping table on Input tab |
| `WorldRail.svelte` | Fix route actions; enable Settings; remove `toggleInspector` from Entities |
| `WorldShell.svelte` | Wire `controls` snippet; sidebar branches settings; keyboard `P` + Esc handler |
| `AppShell.svelte` | Controls float; visibility rules; attributes reposition |
| `WorldScene.svelte` | Bind orbit prefs; listen for view commands; gate SelectionOutline on `ui.chrome.selectionOutline` |
| `world.svelte.ts` | Remove or deprecate `toggleInspector` / `inspectorOpen` for layout (keep sessionStorage migration note in PR description) |
| `ComponentFieldInput.svelte` | Asset pick: use `ui.openSettings` / route assets — not `toggleInspector` |

---

## Content rail behavior (breaking change)

| Route | On click |
| ----- | -------- |
| **World** | `railRoute='world'`; `world.select(null)`; clear pick target |
| **Entities** | `railRoute='entities'`; `ui.chrome.sidebar=true` (idempotent — **no toggle**) |
| **Assets** | `railRoute='assets'`; `ui.chrome.sidebar=true` |
| **Settings** | `railRoute='settings'`; `ui.chrome.sidebar=true`; default tab `input` |

**Pressed state:**

| Item | `aria-pressed` when |
| ---- | ------------------- |
| World | `railRoute === 'world'` |
| Entities | `railRoute === 'entities'` |
| Assets | `railRoute === 'assets'` |
| Settings | `railRoute === 'settings'` |

Remove `world.inspectorOpen` from pressed logic.

---

## Controls pill popovers

One open at a time: setting `ui.openControlPopover` closes previous.

| Popover | Play mode | Contents |
| ------- | --------- | -------- |
| Chrome (`layout-panel-left`) | **Hidden/disabled** | Checkboxes: sidebar, attributes, grid, selection outline |
| Camera (`crosshair` or `video`) | Enabled | Segmented orbit/follow; Reset view; Focus selection |
| Orbit (`orbit`) | Enabled if `camera.mode === 'orbit'` else disabled with tooltip | rotate/zoom sliders, invert Y, reset defaults |
| Input (`gamepad-2`) | Enabled | Connection label; deadzone slider; button → `ui.openSettings('input')` |

Install Popover via shadcn-svelte. Popover content uses solid `var(--surface-overlay)` (not glass).

---

## Keyboard & Esc (`WorldShell.svelte` or dedicated `shellKeyboard.ts`)

| Key | When | Action |
| --- | ---- | ------ |
| `P` | not in input/textarea/dialog | toggle play |
| `Escape` | popover open | close popover |
| `Escape` | play mode, no popover | `ui.exitPlay()` |
| `Escape` | edit mode, no popover | no change (defer pick-cancel) |

Use `{#if}` guard or `document.activeElement` check for form fields.

---

## Accessibility

- `#world-status` live region: announce "Play mode" / "Edit mode" on transition (extend existing `role="status"` div or PlayModeButton aria-live).
- Controls pill: `nav[aria-label="Viewport controls"]`.
- Each trigger: `aria-expanded`, `aria-controls="{id}"`.
- Play button: `aria-pressed={ui.shellMode === 'play'}`; label "Play" / "Stop".
- Popover: focus trap (shadcn Popover); restore focus to trigger on close.
- Chrome popover disabled in play: `aria-disabled="true"` + tooltip "Unavailable during play".

---

## Implementation phases

### PR1 — Play mode + toolbar + rail fix (MVP)

- State: `shellMode`, snapshot, enter/exit
- `PlayModeButton`, slim toolbar
- AppShell visibility gated on `shellMode`
- WorldRail route fix (no inspector toggle)
- Remove inspector/camera from toolbar
- Keyboard `P` + Esc exit play
- CSS tokens for play accent

### PR2 — Controls pill + popovers

- shadcn Popover install
- `ControlsPill` + four popovers
- `ui.chrome` toggles wired to AppShell + SelectionOutline
- Attributes repositioned left of pill
- Camera orbit prefs + WorldScene bind
- Reset view / focus selection commands

### PR3 — Settings route + input depth

- `SettingsPanel.svelte` with tabs
- Read-only mapping table
- Input popover deadzone → `gamepad.deadzone`
- `WorldShell` sidebar settings branch
- Shell tab: stats HUD visibility toggle (optional hide via CSS class)

---

## Acceptance criteria

### Global (every PR)

1. **`pnpm check`** — 0 errors  
2. **`pnpm build`** — succeeds  

### PR1

3. Toolbar shows **only** `world.jsonld` title + **Play** button (no Camera, no Inspector)  
4. **Play** enters play mode: content rail, sidebar, attributes hidden; **Stop** restores prior route + panels  
5. Play sets camera to **follow** when `world.localPlayerId` is set; otherwise unchanged  
6. **`P`** toggles play when focus not in form control  
7. **`Escape`** exits play when no popover open (PR1: no popovers yet — Esc always exits play)  
8. Rail **Entities** opens entity list without toggling closed on second click  
9. Rail **World** hides sidebar and clears selection  
10. Play button: green in edit, muted outline in play; `aria-pressed` correct  

### PR2

11. Controls pill visible top-right (desktop); 4 icons match mock order: Panels, Camera, Navigation, Input  
12. Only one popover open at a time; click-outside closes  
13. **Panels** checkboxes show/hide sidebar and attributes independently  
14. **Camera** segmented control sets `camera.mode`; Reset and Focus invoke view commands  
15. **Navigation** sliders update OrbitControls speeds live  
16. **Chrome** popover disabled/hidden during play mode  
17. Attributes panel positioned left of controls pill (8px gap)  
18. `prefers-reduced-motion: reduce` disables popover enter animation (instant show)  

### PR3

19. Rail **Settings** opens Settings panel in sidebar float  
20. Input tab shows read-only mapping rows matching gamepad axis/button indices  
21. Input popover "Configure mappings…" navigates to Settings → Input tab  
22. Deadzone slider updates `gamepad.deadzone` and affects `gamepadAxis()`  
23. Stats HUD remains bottom-right, non-interactive  

### Regression

24. Entity selection, add-entity dialog, asset pick from mesh field still work in edit mode  
25. Mobile (`<768px`): Play in toolbar works; no regression to stacked inspector layout  
26. Viewport width unchanged when toggling panels (floating overlay model preserved)  

---

## Verification script (manual QA)

1. Open default world at 1280×800  
2. Confirm toolbar: title + Play only  
3. Click Entities → sidebar appears; click again → **stays open**  
4. Click World → sidebar hides  
5. Click Play → rail/sidebar/attributes hide; Stop visible; move with WASD/gamepad if player exists  
6. Press Stop → prior panels restore  
7. Open controls pill → each popover matches mock  
8. Toggle Panels → sidebar/attributes independent  
9. Settings → read-only mapping visible  
10. Side-by-side: [play_mode_controls_shell_mockup.html](./play_mode_controls_shell_mockup.html)

---

## Out of scope

- Editable controller remapping (persist to graph/localStorage)  
- Mobile controls horizontal strip (defer)  
- Grid overlay rendering (toggle may be UI-only until grid component exists)  
- Multiplayer lobby / room UI  
- e2e test suite (none exists — manual QA script above)  
- Auto-enter play on load  

---

## Handoff checklist

- [x] `docs/artifacts/play_mode_controls_shell_spec.md` (this file)
- [ ] Trellis spec issue + impl child (CLI sync)
- [ ] Executor: PR1 → PR2 → PR3
