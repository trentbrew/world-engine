---
version: 1
name: Left Scene Panel Simplification
parent: TRL-48
design: docs/artifacts/left_scene_panel_simplification_design.md
mock: docs/artifacts/left_scene_panel_simplification_mockup.html
status: queue-ready
---

# Spec: Left Scene Panel Simplification

**Design:** [left_scene_panel_simplification_design.md](./left_scene_panel_simplification_design.md)  
**Mock:** [left_scene_panel_simplification_mockup.html](./left_scene_panel_simplification_mockup.html)  
**Trellis:** TRL-48 (Spec)  
**Out of scope:** GroundPlane pick/collaboration hotfix (separate executor wedge); right panel; doc-bar collaboration chrome

---

## Summary

Restructure **`SceneInspector`** from 10 default-open accordions into **6 tiered sections** with progressive disclosure, merge **Reference grid** + **Ground grid** under one **Grids** segment control, remove the disabled **Simulation** placeholder, relocate **Advanced** → **Developer**, and cap **`LeftPanel`** height at **`min(80vh, viewport budget)`** with scroll on tab bodies.

All existing `ui.*` bindings are **relocated only** — no behavior or store shape changes beyond optional local UI state for grid segment.

---

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Accordion persistence | **No** — default open set only; no `sessionStorage` v1 | Reduce scope; design listed as optional |
| Essentials | **Single** accordion: name + background | Design recommendation |
| Developer inner chrome | **`<details>`** "Input & camera reference" wrapping read-only tables/defaults | Mock pattern; drop Advanced sub-tabs |
| Scroll bottom fade | **Defer** v1 | Polish only |
| Grids segment state | **Local** `$state<'reference' \| 'ground'>` in `SceneInspector` | No cross-tab persistence needed |
| Simulation (disabled gravity) | **Remove** from UI tree | No placeholder until engine toggle exists |
| Collaboration fields | **Not** in Scene tab | Doc-bar + status (shipped peer selection UX) |
| Objects/Assets tabs | **Same** 80vh cap + internal scroll | Shared `LeftPanel` shell rule |
| CSS var for height | Reuse `--float-inset`, `--view-controls-height` from `app.css` | Already defined |

---

## Layout & CSS

### LeftPanel max-height (normative)

On **`.left-panel`** in `LeftPanel.svelte`:

```css
max-height: min(
  80vh,
  calc(100dvh - var(--float-inset) * 2 - var(--view-controls-height, 48px))
);
```

- Tabs (`.panel-tabs`) remain `flex-shrink: 0`.
- Scene tab: `.panel-body--scroll` — `flex: 1; min-height: 0; overflow-y: auto`.
- Objects tab: search bar fixed; `.panel-body` scrolls entity list inside remaining height.
- Assets tab: `.panel-body` scrolls panel content.

`AppShell` `.panel-shell` keeps `max-height: inherit` (unchanged).

---

## SceneInspector IA map

| New accordion `value` | Label | Default open | Fields (bindings) |
| --------------------- | ----- | ------------ | ----------------- |
| `essentials` | Essentials | **yes** | `ui.scene.displayName` (name); `ui.scene.background` (background color) |
| `environment` | Environment | **yes** | `ui.scene.sky.enabled`; conditional `ui.scene.sky.preset`, `ui.scene.sky.setEnvironment`; `ui.scene.shadows` |
| `play-mode` | Play mode | no | `ui.playCameraDefault` — Follow \| Orbit `ToggleGroup` |
| `grids` | Grids | no | Segment + fields below |
| `selection` | Selection | no | `ui.chrome.selectionOutline` |
| `developer` | Developer | no | `ui.chrome.statsHud`; `<details>` read-only input mappings + camera defaults |

### Default `openSections`

```ts
let openSections = $state<string[]>(['essentials', 'environment']);
```

Remove old section ids: `scene`, `viewport`, `sky`, `lighting`, `play-camera`, `reference-grid`, `ground-grid`, `simulation`, `advanced`.

### Grids segment

Inside `grids` accordion:

```svelte
let gridTab = $state<'reference' | 'ground'>('reference');
```

| Segment | Visible fields | Bindings |
| ------- | -------------- | -------- |
| **Reference** | show, infinite, cell, section, fade, cell color, section color | `ui.chrome.grid`, `ui.grid.*` |
| **On ground** | show, cell, section, cell color, section color + hint | `ui.scene.groundGrid.*` |

- `ToggleGroup` full width, `variant="outline"`, `size="sm"`, labels **Reference** / **On ground**.
- `aria-label="Grid type"` on group.
- Switching segment **must not** mutate the other store.

### Developer block

- **Stats HUD:** existing `InspectorField` → `ui.chrome.statsHud`.
- **`<details>`** summary: "Input & camera reference".
  - Inside: controller mapping table (`getMappingTable()`), camera defaults dl, current `camera.mode` hint — content from former Advanced tabs.
- Remove `settingsTabs` / `ui.settingsTab` usage from SceneInspector **if** no other consumer; if `SettingsPanel` or `openSceneTab` still uses `settingsTab`, keep field on `ui` but drop Scene accordion sub-tabs.

### Removed UI

- Entire **Simulation** accordion (disabled gravity + hint).
- Standalone **Scene**, **Viewport**, **Sky**, **Lighting**, **Reference grid**, **Ground grid**, **Advanced** accordions.

---

## File touch list

| Action | Path |
| ------ | ---- |
| Extend | `src/lib/ui/LeftPanel.svelte` — max-height CSS |
| Refactor | `src/lib/ui/SceneInspector.svelte` — 6-section IA, grids segment, developer details |
| Verify | `src/lib/ui/ui.svelte.ts` — no required new exports; optional cleanup of unused `settingsTab` routes from Scene only |
| Verify | `src/app.css` — `--view-controls-height` present |

**Do not modify:** `RightPanel`, `DocBar`, `RoomPresenceBar`, entity list behavior (except inheriting scroll cap).

---

## Acceptance criteria (testable)

### Build

- [ ] `pnpm check` passes with zero errors.

### Panel shell

- [ ] `.left-panel` uses `max-height: min(80vh, calc(100dvh - …))` per spec.
- [ ] Scene tab body scrolls vertically when content exceeds cap.
- [ ] Objects tab: search stays visible; entity list scrolls within capped panel.
- [ ] Edit mode: panel visible; play mode: panels hidden (unchanged `AppShell`).

### Scene accordion IA

- [ ] Exactly **6** top-level accordion sections with labels: Essentials, Environment, Play mode, Grids, Selection, Developer.
- [ ] Default open: **Essentials** + **Environment** only.
- [ ] **Simulation** section absent (no disabled gravity row).
- [ ] **Collaboration** section absent from Scene tab.

### Field bindings (no regression)

- [ ] Scene name edits update `ui.scene.displayName`.
- [ ] Background color edits update viewport background.
- [ ] Sky toggle shows/hides preset + environment fields; shadows toggle works.
- [ ] Play mode camera toggle updates `ui.playCameraDefault`.
- [ ] Reference grid fields control `ui.chrome.grid` + `ui.grid.*`.
- [ ] On ground grid fields control `ui.scene.groundGrid.*`.
- [ ] Selection outline toggle controls `ui.chrome.selectionOutline`.
- [ ] Stats HUD toggle controls status bar visibility.

### Grids segment

- [ ] Grids accordion contains Reference \| On ground segment.
- [ ] Segment switch swaps visible field groups without cross-writing stores.

### Developer

- [ ] Developer accordion contains stats HUD + collapsible input/camera reference (read-only content preserved from Advanced).

### Accessibility

- [ ] Accordion triggers remain keyboard focusable (shadcn/bits).
- [ ] Grid segment has accessible name (`aria-label` or visible label association).

---

## Non-goals (v1)

- Scroll bottom fade gradient
- `sessionStorage` for open accordion sections
- Objects/Assets content redesign
- GroundPlane viewport pick exclusion (separate issue)
- Moving collaboration username/room into Scene tab

---

## Handoff checklist

- [x] Spec artifact at `docs/artifacts/left_scene_panel_simplification_spec.md`
- [ ] Trellis spec issue created with AC mirroring sections above
- [ ] Impl child queued for Executor
