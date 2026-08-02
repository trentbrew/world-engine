---
version: 1
name: Spline-Inspired Authoring Shell
parent: TRL-28 (proposal — graph queue pending)
design: docs/artifacts/spline_authoring_shell_design.md
mock: docs/artifacts/spline_authoring_shell_mockup.html
supersedes:
  - docs/artifacts/floating_chrome_shell_spec.md
  - docs/artifacts/play_mode_controls_shell_spec.md
status: queue-ready
---

# Spec: Spline-Inspired Authoring Shell

**Parent:** TRL-28 (Proposal: Spline-inspired authoring shell)  
**Design:** [spline_authoring_shell_design.md](./spline_authoring_shell_design.md)  
**Mock:** [spline_authoring_shell_mockup.html](./spline_authoring_shell_mockup.html)

---

## Summary

Restructure the authoring shell to match **Spline spatial logic**: full-bleed viewport, thin **doc bar** (game tabs), **center tool pill** (camera/nav popovers + violet Play), **left panel** (Objects | Assets), **right panel** (Scene when deselected / Entity when selected), **bottom view bar** (projection toggle). Migrate tokens to the violet palette in the design artifact.

**Baseline:** play-mode controls shell is **already implemented** (`shellMode`, `ControlsPill`, `PlayModeButton`, popovers, `SettingsPanel` via rail). This spec is a **layout refactor + token pass**, not a greenfield play-mode build.

**Supersedes** layout sections of `play_mode_controls_shell_spec.md` and `floating_chrome_shell_spec.md`. Retain play-mode **semantics** (enter/exit snapshot, keyboard, camera follow on play).

---

## Architect decisions (closes design open questions)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| AppShell grid | Single docked row: **doc bar** (36px). No `toolbar` snippet. Viewport is row 2 full bleed. | Matches Spline + design mock |
| Panel routing | `ui.leftTab: 'objects' \| 'assets'` replaces `railRoute` for left panel body | One left panel; no icon rail |
| Settings | **Modal/dialog** via `ui.settingsOpen` + existing `settingsTab`; remove `railRoute='settings'` | Settings not a left-rail route |
| Right panel visibility | Always shown in **edit** mode (`shellMode === 'edit'`). No `world.selectedEntity` gate. | Scene inspector fills deselected state |
| Right panel content | `world.selectedEntity ? EntityAttributes : SceneInspector` | Design matrix |
| ControlsPill | **Remove** after migration. Reuse `CameraPopover` / `OrbitPopover` content inside `ToolPill`. | Avoid duplicate camera UI |
| Chrome popover | **Remove** `ChromePopover`. Grid + selection outline → `SceneInspector` toggles bound to `ui.chrome.grid` / `ui.chrome.selectionOutline` | Panels always visible; no sidebar/attributes toggles |
| `ui.chrome.sidebar` / `attributes` | **Deprecate for layout** (stop gating AppShell). Keep in snapshot restore for one release; remove in PR4 cleanup | Left/right panels tied to `shellMode` only |
| Navigation prefs location | Stay in **tool pill** Navigation popover (reuse `OrbitPopover`) | Mock shows popover, not view bar |
| View bar scope | **Projection segmented control** + non-interactive axis gizmo stub (CSS/SVG) | Design mock |
| Orthographic projection | Add `camera.projection: 'perspective' \| 'orthographic'` in `camera.svelte.ts`. **v1 UI-only:** toggle updates state; `WorldScene` continues perspective render; show Sonner toast once per session when ortho selected: "Orthographic view coming soon" | Stub OK per design; avoids blocking on Three.js camera swap |
| Input / gamepad config | **No tool-pill icon.** Link "Open settings…" in `SceneInspector` → `ui.openSettings('input')` opens settings dialog | Design table |
| Transform tools stub | Disabled button in tool pill with tooltip "Coming soon" | Non-goal v1 |
| Token migration | Update `app.css` `:root` to design YAML values (`--primary: #7b6df0`, `--accent-play: #7b6df0`, viewport/grid purple tint, `--doc-bar-height: 36px`, panel widths, `--rounded-lg: 14px`, glass @ 68%) | Single palette; retire green play |
| Play snapshot | Extend snapshot: `leftTab` replaces `railRoute`; drop `railRoute` from snapshot in PR4 | Tab-scoped restore |
| 1280px collision | Tool pill `max-width: calc(100% - left-panel - right-panel - insets)`; panels use design widths 240/280 | Prevent overlap at 1280×800 |
| Mobile | Desktop-first. `<768px`: hide left/right floats (existing pattern); doc bar shows active game title + overflow; tool pill keeps Play + camera only | Defer bottom sheets |
| Phasing | **Four PRs** (below); each passes `pnpm check` + `pnpm build` | Incremental migration off live impl |

---

## State model (`src/lib/ui/ui.svelte.ts`)

### Add / change

```ts
export type LeftTab = 'objects' | 'assets';

export type ChromeToggles = {
  grid: boolean;
  selectionOutline: boolean;
  statsHud: boolean;
  // sidebar, attributes — deprecated; remove PR4
};

class UIState {
  leftTab = $state<LeftTab>('objects');
  settingsOpen = $state(false);
  // remove: railRoute, openControlPopover chrome/camera/orbit/input on ControlsPill
  toolPopover = $state<'camera' | 'navigation' | null>(null); // one at a time

  openSettings(tab: SettingsTab = 'input') {
    this.settingsTab = tab;
    this.settingsOpen = true;
    this.toolPopover = null;
  }

  enterPlay() {
    // snapshot: leftTab, chrome (grid/selection/stats), cameraMode, settingsTab
    // clear selection, close toolPopover, shellMode = play
  }
}
```

### Remove (PR4)

- `RailRoute` type and `railRoute` field
- `ControlPopoverId` `'chrome' | 'input'` usage (delete `ChromePopover`, `InputPopover` from tool pill wiring)
- `openControlPopover` → rename to `toolPopover` scoped to tool pill

---

## Camera module (`src/lib/engine/render/camera.svelte.ts`)

Add:

```ts
projection = $state<'perspective' | 'orthographic'>('perspective');
```

No WorldScene wiring required for v1 AC (toast-only stub). Optional stretch: swap `PerspectiveCamera` fov vs ortho zoom in `WorldScene` — out of scope unless trivial.

---

## CSS variables (`src/app.css`)

Replace / add per design front matter:

```css
--viewport: #0c0c10;
--viewport-grid: #1a1524;
--surface: #131318;
--surface-raised: #1a1a22;
--surface-overlay: #22222c;
--surface-glass: color-mix(in srgb, var(--surface-overlay) 68%, transparent);
--primary: #7b6df0;
--primary-foreground: #f4f2ff;
--primary-muted: color-mix(in srgb, var(--primary) 18%, transparent);
--accent-play: #7b6df0;
--accent-play-foreground: #f4f2ff;
--accent-selection: #5b9fd4;
--border-focus: #7b6df0;
--ring: #7b6df0;
--doc-bar-height: 36px;
--tool-pill-height: 44px;
--left-panel-width: 240px;
--right-panel-width: 280px;
--view-bar-height: 36px;
--float-inset: 12px;
--rounded-sm: 6px;
--rounded-md: 10px;
--rounded-lg: 14px;
```

Remove obsolete layout vars if unused: `--controls-pill-width`, `--rail-pill-width`, `--toolbar-height` → alias `--doc-bar-height` for skip-link positioning.

---

## Layout spec (`AppShell.svelte`)

### Snippet contract (breaking change)

| Remove | Add |
| ------ | --- |
| `toolbar` | `docBar` |
| `rail` | — |
| `controls` | `toolPill` |
| `sidebar` / `entityList` | `leftPanel` |
| `attributes` | `rightPanel` |
| — | `viewBar` (optional snippet, can live inside main) |

### Grid

```svelte
<div class="app-shell" class:playing={ui.shellMode === 'play'}>
  <div class="app-doc-bar">{@render docBar()}</div>
  <div class="app-stage">
    {@render main()}
    {#if ui.shellMode === 'edit'}
      <div class="app-left-panel">{@render leftPanel()}</div>
      <div class="app-right-panel">{@render rightPanel()}</div>
    {/if}
    <div class="app-tool-pill">{@render toolPill()}</div>
    {@render viewBar?.()}
    {@render stats?.()}
  </div>
</div>
```

### Visibility

| Element | Condition |
| ------- | --------- |
| Doc bar | always |
| Left panel | `shellMode === 'edit'` |
| Right panel | `shellMode === 'edit'` |
| Tool pill | always |
| View bar | always |
| Stats HUD | `ui.chrome.statsHud` |

### Positioning (desktop)

| Element | CSS |
| ------- | --- |
| `.app-doc-bar` | grid row 1; height `var(--doc-bar-height)` |
| `.app-stage` | grid row 2; `position: relative`; min-height 0 |
| `.app-left-panel` | `absolute; top: var(--float-inset); left: var(--float-inset); width: var(--left-panel-width); z-index: 20` |
| `.app-right-panel` | `absolute; top: var(--float-inset); right: var(--float-inset); width: var(--right-panel-width); z-index: 20` |
| `.app-tool-pill` | `absolute; top: var(--float-inset); left: 50%; transform: translateX(-50%); z-index: 25` |
| `.app-view-bar` | `absolute; bottom: calc(var(--float-inset) + 40px); left: 50%; transform: translateX(-50%); z-index: 22` |
| Stats | `absolute; bottom: var(--float-inset); right: var(--float-inset); z-index: 17` |

Play mode: left/right panels animate out (180ms opacity + translateY), same as mock.

---

## Component map

| File | Action |
| ---- | ------ |
| `DocBar.svelte` | **New** — `GAMES` tabs, `loadGame`, score chip, "100%" placeholder |
| `ToolPill.svelte` | **New** — camera + navigation popovers + disabled select stub + embed Play (violet pill styling) |
| `LeftPanel.svelte` | **New** — Objects \| Assets tabs, search (objects), hosts `EntityList` / `AssetsPanel` |
| `RightPanel.svelte` | **New** — header + `SceneInspector` or `EntityAttributes` |
| `SceneInspector.svelte` | **New** — grid toggle, play camera default (segmented), simulation stub, "Open settings…" link |
| `ViewBar.svelte` | **New** — perspective \| orthographic + gizmo stub |
| `EntityList.svelte` | Restyle tree rows (`primary-muted` selected); add search filter prop or internal filter |
| `PlayModeButton.svelte` | Restyle: 32px height, pill radius; or inline into ToolPill and delete file |
| `AppShell.svelte` | New grid + floats per above |
| `WorldShell.svelte` | Wire new snippets; settings in `Dialog`/`Sheet`; remove old imports |
| `ui.svelte.ts` | `leftTab`, `settingsOpen`, `toolPopover`; migrate enter/exit snapshot |
| `camera.svelte.ts` | `projection` field |
| `ComponentFieldInput.svelte` | Asset pick → `ui.leftTab = 'assets'` |
| `AssetsPanel.svelte` | After pick → `ui.leftTab = 'objects'` |
| **Delete PR4** | `WorldToolbar.svelte`, `WorldRail.svelte`, `ControlsPill.svelte`, `GameMenubar.svelte`, `ChromePopover.svelte`, `InputPopover.svelte` |

Reuse without deletion: `CameraPopover.svelte`, `OrbitPopover.svelte` (import into ToolPill).

---

## DocBar behavior

- Tabs: `GAMES` entries; label = `{param}.jsonld` or `world.jsonld` for default (`param` undefined → Sandbox uses `world.jsonld`)
- Active tab: `currentGameParam()` match; underline `border-bottom: 2px solid var(--primary)`
- Click tab → `loadGame(entry.param)` (full reload, existing behavior)
- Score: `{#if score.value > 0}` chip before zoom readout
- Zoom: static `<span>100%</span>` (no interaction v1)

---

## Left panel behavior

| Tab | Body | Footer |
| --- | ---- | ------ |
| Objects | Search input + `EntityList` (filtered) | Add entity button |
| Assets | `AssetsPanel` | hidden |

- Tab switch: `ui.leftTab = 'objects' | 'assets'`
- Search: client-side filter on entity id substring; empty → "No matches"
- Click viewport background (edit): `world.select(null)` → right panel shows Scene

---

## Right panel behavior

| `world.selectedEntity` | Header | Body |
| ---------------------- | ------ | ---- |
| null | "Scene" | `SceneInspector` |
| set | short id (mono) | `EntityAttributes` |

Crossfade 120ms on context switch (`prefers-reduced-motion`: instant).

### SceneInspector sections (v1)

1. **Viewport** — read-only background `#0c0c10` (or live `--viewport` CSS var)
2. **Play camera** — segmented Follow / Orbit → sets default for `enterPlay()` only (store in `ui.playCameraDefault: 'follow' | 'orbit'`, default `follow`)
3. **Grid** — toggle → `ui.chrome.grid` (wire to grid visibility if `WorldScene` grid component exists; else UI-only)
4. **Simulation** — Gravity toggle UI-only v1 (label + toggle, no engine wire)
5. **Settings** — button "Open settings…" → `ui.openSettings('input')`

---

## Tool pill behavior

Horizontal glass pill, icons left-to-right:

1. **Camera** — toggles `toolPopover` camera; hosts `CameraPopover`
2. **Navigation** — toggles navigation; hosts `OrbitPopover`; disabled when `camera.mode !== 'orbit'` with tooltip
3. **Divider**
4. **Select** — disabled, tooltip "Coming soon"
5. **Play** — violet fill edit / muted stop play; calls existing `ui.togglePlay()`

One popover open at a time. Click outside closes. Esc closes popover before exiting play (existing `shellKeyboard` behavior).

Play mode: Camera + Navigation enabled; Select disabled.

---

## View bar behavior

- Segmented **Perspective** | **Orthographic** bound to `camera.projection`
- On ortho select: set projection + Sonner toast (once per session flag ok)
- Axis gizmo: decorative 28×28 SVG/CSS, `aria-hidden="true"`

---

## Settings dialog

- Move `SettingsPanel` from sidebar float to shadcn **Dialog** or **Sheet** controlled by `ui.settingsOpen`
- `ui.openSettings(tab)` sets tab + opens dialog
- Close on Esc / overlay click
- Remove all `railRoute === 'settings'` branches

---

## Keyboard (unchanged)

| Key | Action |
| --- | ------ |
| `P` | toggle play (not in form field) |
| `Esc` | close tool popover → else exit play |
| Arrow keys | entity list navigation (existing) |

Update skip-link target: `#entity-list` remains; position under doc bar.

---

## Accessibility

- Doc bar tabs: `role="tablist"` / `role="tab"` / `aria-selected`
- Left panel tabs: same pattern
- Tool pill Play: `aria-pressed`
- `#world-status` live region: keep `ui.modeMessage` announcements
- View bar segmented: `role="tablist"`
- Focus order: skip-link → doc tabs → tool pill → left panel → right panel → view bar → stats

---

## Implementation phases

### PR1 — Layout topology (MVP visual)

- New `AppShell` grid + float positions
- `DocBar`, `LeftPanel`, `RightPanel`, `ToolPill`, `ViewBar` (stub projection)
- `WorldShell` wiring; delete usage of `WorldToolbar`, `WorldRail`, `ControlsPill`, `GameMenubar`
- `ui.leftTab`; settings dialog shell
- Play mode hides left/right panels

### PR2 — Scene inspector + state cleanup

- `SceneInspector` with grid/selection/play-camera-default
- `EntityList` search + selected row styling
- Migrate asset pick routes to `leftTab`
- Settings dialog fully wired

### PR3 — Token pass

- `app.css` violet palette per design
- `PlayModeButton` / tool pill violet styling
- Glass panels @ 68% blur 20px

### PR4 — Deprecation cleanup

- Delete deprecated components/files
- Remove `railRoute`, `chrome.sidebar`, `chrome.attributes`, `ControlsPill` types
- Update snapshot to `leftTab`-only

---

## Acceptance criteria

### Global (every PR)

1. **`pnpm check`** — 0 errors  
2. **`pnpm build`** — succeeds  

### PR1 — Topology

3. **No** docked `WorldToolbar`, **no** `WorldRail` icon pill, **no** floating `GameMenubar`, **no** `ControlsPill` visible in UI  
4. Doc bar shows game tabs from `GAMES`; active tab matches `?game=`; click switches game  
5. Left panel visible in edit with **Objects | Assets** tabs; Objects shows entity list  
6. Right panel visible in edit **without** entity selection — shows Scene header  
7. Selecting entity switches right panel to Entity inspector  
8. Tool pill centered top; Play toggles edit/play; side panels hide in play mode  
9. View bar visible bottom-center with Perspective | Orthographic segments  
10. Play enter/exit restores `leftTab` + chrome toggles + camera mode (snapshot)  

### PR2 — Scene + settings

11. Scene inspector: grid toggle updates `ui.chrome.grid`; selection outline toggle updates `ui.chrome.selectionOutline`  
12. "Open settings…" opens settings dialog on Input tab  
13. Objects tab search filters entity list; empty state "No matches"  
14. Asset field pick switches to Assets tab (`leftTab = 'assets'`)  
15. Click empty viewport deselects → Scene inspector  

### PR3 — Tokens

16. `:root` tokens match design YAML (violet primary/play, purple grid, doc-bar-height 36px)  
17. Play button uses violet fill in edit mode (not green `#86efac`)  
18. Selected tree row uses `--primary-muted` background  

### PR4 — Cleanup

19. Deleted files: `WorldToolbar`, `WorldRail`, `ControlsPill`, `GameMenubar`, `ChromePopover`, `InputPopover`  
20. No references to `railRoute` in `src/`  
21. `pnpm check` + build green after deletion  

### Regression

22. Camera / Navigation popovers in tool pill retain PR2 play-mode behavior (orbit prefs, reset/focus)  
23. `P` / Esc keyboard contract unchanged  
24. Entity add dialog, multiplayer session, stats HUD still functional  
25. Side-by-side desktop 1280×800 matches [mock](./spline_authoring_shell_mockup.html) spatial regions (doc bar, center pill, left/right panels, view bar)  

---

## Verification script (manual QA)

1. Open `?game=collect` at 1280×800  
2. Confirm doc bar tabs; Collect active; score chip if coins collected  
3. Left: Objects list; switch Assets → primitive grid  
4. Right: Scene when nothing selected; select player → Transform fields  
5. Center pill: camera popover orbit/follow; navigation sliders  
6. Play → panels hide; Stop restores  
7. View bar → Orthographic shows toast  
8. Scene → Open settings → mapping table visible  
9. Compare to [spline_authoring_shell_mockup.html](./spline_authoring_shell_mockup.html)  

---

## Out of scope

- Orthographic camera render wiring (UI stub only v1)  
- Transform gizmo tools (move/rotate/scale)  
- Mobile bottom sheets  
- Panel collapse chevrons (v2)  
- Zoom readout interaction  
- e2e tests (none in repo)  
- Editable controller remapping  

---

## Handoff checklist

- [x] `docs/artifacts/spline_authoring_shell_spec.md` (this file)
- [ ] Trellis spec issue TRL-29 + impl child (CLI sync)
- [ ] Executor: PR1 → PR2 → PR3 → PR4
