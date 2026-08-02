---
version: 2
name: Editor shell — overlay chrome + GameMaker navigation
status: active
labels: spec, ui, shell, editor, inset-hierarchy, gamemaker, needs-e2e
related: gamemaker_navigation_spec.md, object_context_spec.md, AppShell.svelte, WorldShell.svelte
---

# Spec: Editor shell refactor — full-bleed canvas + world navigation

**Goal.** Full-bleed WebGL canvas with floating glass chrome (doc bar, side panels, bottom dock).
World-level navigation follows **GameMaker parity**: Assets → Objects → Rooms in the bottom dock;
room workbench tabs (Room / Instances / Settings) at the top of the left pane.

See [[gamemaker_navigation_spec]] for the IA detail.

---

## Current architecture (2026-07)

### Layer model (`AppShell.svelte`)

```
z-index 0  — app-canvas-layer (full-bleed WebGL, all routes)
z-index 10 — app-chrome (doc bar, panels, bottom dock — pointer-events none on wrapper)
```

Canvas does **not** shrink when panels open; chrome floats above the viewport.

### Navigation tiers

| Tier | Where | What it switches |
| ---- | ----- | ---------------- |
| **Bottom dock** | `BottomDock.svelte` | World routes: Graph · Assets · Objects · Rooms + Chat |
| **Room pane tabs** | `LeftPanel.svelte` header | Room · Instances · Settings (Rooms route only) |
| **Instance editor** | `railRoute === 'object'` | Isolated character stage — **not** a bottom-dock item |

**Scope (Game tier):** bottom-dock routes are **game-global** (span all rooms); only **Rooms**
selects the active room. Room pane tabs are scoped to that room. This is the UI face of the
Game/Room data model — see [[game_project_tier_collections_spec]].

### Route → layout

| `railRoute` | Left | Canvas | Right | Bottom |
| ----------- | ---- | ------ | ----- | ------ |
| `rooms` | `LeftPanel` | `WorldViewport` | `RightPanel` | — |
| `objects` | `ObjectsResourcePanel` | stub | stub | — |
| `assets` | `AssetsPanel` | stub | stub | — |
| `graph` / `config` | stub | stub | stub | — |
| `object` | `ObjectClipLibrary` | `ObjectStageViewport` | `ObjectPlaybackInspector` | `ObjectBehaviorDrawer` |

### Doc bar

`DocBar.svelte` — world title, Edit/Play toggle, presence. **No** scene picker (moved to
LeftPanel → Room tab via embedded `SceneSelector`).

---

## State (`ui.svelte.ts`)

```ts
type WorldRoute = 'rooms' | 'objects' | 'assets' | 'graph' | 'config';
type RailRoute = WorldRoute | 'object';
type RoomsPaneTab = 'room' | 'instances' | 'settings';

railRoute = $state<RailRoute>('rooms');
roomsPaneTab = $state<RoomsPaneTab>('instances');
objectTarget = $state<string | null>(null);
bottomPaneOpen / bottomPaneHeight  // Object behavior drawer
```

Key APIs: `setRoute()`, `setRoomsPaneTab()`, `editObject()`, `exitObject()`.

Deprecated aliases: `leftTab`, `setLeftTab`, `LeftTab` → use `roomsPaneTab` / `RoomsPaneTab`.

---

## Component map

| File | Role |
| ---- | ---- |
| `AppShell.svelte` | Two-layer shell; bottom dock slot; panel resize |
| `WorldShell.svelte` | Route switching; mounts `RoomChat` in edit mode |
| `BottomDock.svelte` | World nav + chat toggle |
| `LeftPanel.svelte` | Room pane tabs + embedded scene picker |
| `ObjectsResourcePanel.svelte` | World object types list (stub → full editor later) |
| `RoomChat.svelte` | `showFab` prop — dock toggle in edit, FAB in play |

`Rail.svelte` — **superseded** by bottom dock; kept as reference, not mounted.

---

## Phased delivery status

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| **A · Grid / overlay shell** | Full-bleed canvas + floating chrome | **done** |
| **B · World routing** | Bottom dock + `railRoute` switching | **done** |
| **C · Placement** | Left → Assets drag-to-place (no bottom palette) | **done** |
| **D · Object context** | Instance editor stage + behavior drawer | **done** |
| **E · Play collapse** | Grid collapse to full-bleed + HUD | pending |
| **F · GM navigation** | Scene→Rooms rename; pane tabs in left header | **done** |

---

## Planned (Game tier)

- **Collections** route — game-global data records; `WorldRoute` gains `'collections'`; adds a
  route→layout row `collections | CollectionsPanel | record table | record inspector | —`.
  See [[game_project_tier_collections_spec]].
- **Graph** route — game-global record + `ref`-edge view (currently a stub).
- **Objects** resource editor and **Collections** share one game-global `EntityType` backend
  (`defineType`) — build the type-definition path once (see [[object_context_spec]]).
- **Objects route v1 (2026-07):** Rooms inspector is instance-only (field values). Object type
  composition (add/remove capabilities, defaults) lives in **Objects** left list + right
  `ObjectTypeEditor`. Rooms JSON tab remains escape hatch for instance structure.

## Out of scope (later)

- Full object-resource editor (events on types) — `ObjectsResourcePanel` is a stub
- Config route implementation
- Per-context saved panel layouts

---

## E2E (`needs-e2e`)

| Phase | Issue | Spec file(s) |
| ----- | ----- | ------------ |
| A · Grid / inset | TRL-142 | `e2e/edit-mode-pixel.spec.ts`, `e2e/smoke.spec.ts` |
| B · Rail / tabs | TRL-143 | `e2e/workbench-ui.spec.ts` |
| C · Palette | TRL-144 | `e2e/scene-palette.spec.ts` |
| D · Object context | TRL-145 | `e2e/object-context.spec.ts`, `e2e/animated-npc-demo.spec.ts` |
| E · Play collapse | TRL-146 | `e2e/play-edit-boundary.spec.ts`, `e2e/smoke.spec.ts` |

Regression bundle (Reviewer runs scoped AC per impl issue):

```bash
pnpm check
pnpm test:e2e e2e/workbench-ui.spec.ts
pnpm test:e2e e2e/smoke.spec.ts
pnpm test:e2e e2e/play-edit-boundary.spec.ts
```

---

## Acceptance criteria (graph issues TRL-142–146)

Machine-checkable entries use `trellis issue ac --test "…"`. Behavioral rows stay prose on the issue.

**TRL-142:** `pnpm check`; grid + inset behavioral AC; `pnpm test:e2e e2e/edit-mode-pixel.spec.ts`; `pnpm test:e2e e2e/smoke.spec.ts`

**TRL-143:** `pnpm check`; rail + in-panel tab behavioral AC; `pnpm test:e2e e2e/workbench-ui.spec.ts`

**TRL-145:** see [[object_context_spec]] AC block

**TRL-146:** `pnpm check`; play collapse behavioral AC; `pnpm test:e2e e2e/play-edit-boundary.spec.ts`; `pnpm test:e2e e2e/smoke.spec.ts`

---

## References

- [[gamemaker_navigation_spec]] — IA and GameMaker mapping
- [[object_context_spec]] — instance editor (Phase D)
- `src/lib/ui/AppShell.svelte`, `WorldShell.svelte`, `ui.svelte.ts`
