---
version: alpha
name: Rooms Objects Placement — Place Types Catalog
description: Design artifact for TRL-162 / TRL-160 — Rooms left pane Objects tab as GameMaker-style placeable type catalog (not raw assets)
source:
  tool: greenfield
  mock: docs/artifacts/rooms_objects_placement_mockup.html
colors:
  background: "#0c0c0e"
  surface: "#141418"
  surface-raised: "#1a1a20"
  text: "#e8e8ec"
  text-muted: "#888894"
  primary: "#e85d4c"
  accent-entity: "#5b9fd4"
  accent-placement: "#5b9fd4"
  accent-placement-muted: "color-mix(in srgb, #5b9fd4 22%, transparent)"
  accent-placement-border: "color-mix(in srgb, #5b9fd4 55%, #a3a3a3)"
  ghost-wireframe: "#5b9fd4"
  ghost-fill: "color-mix(in srgb, #5b9fd4 18%, #1c1c1c)"
  cell-highlight: "color-mix(in srgb, #5b9fd4 20%, transparent)"
  cell-highlight-border: "color-mix(in srgb, #5b9fd4 65%, transparent)"
  border: "#2a2a32"
  border-focus: "#a3a3a3"
  surface-glass: "color-mix(in srgb, #1a1a20 72%, transparent)"
typography:
  body:
    fontFamily: Geist, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Geist, system-ui, sans-serif
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.02em
  section:
    fontFamily: Geist Mono, ui-monospace, monospace
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.04em
    textTransform: uppercase
  placement-hint:
    fontFamily: Geist, system-ui, sans-serif
    fontSize: 11px
    fontWeight: 400
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  panel-width: 320px
  tile-gap: 6px
  rail-width: 56px
  float-inset: 12px
components:
  rooms-tablist:
    tabs: ["Room", "Instances", "Objects"]
    activeBorder: "{colors.primary}"
  objects-catalog:
    layout: "subtitle + search + 2-col type grid"
    gridColumns: 2
    gap: "{spacing.tile-gap}"
    subtitle: "Place types into this room"
  type-tile:
    minHeight: 72px
    padding: 6px
    border: "1px solid color-mix(in srgb, {colors.border} 55%, transparent)"
    background: "color-mix(in srgb, {colors.background} 35%, transparent)"
    thumbHeight: 40px
  type-tile-armed:
    border: "1px solid {colors.accent-placement-border}"
    background: "{colors.accent-placement-muted}"
  play-hint:
    position: under-search
    role: status
    copy: "Exit play to place objects."
  placement-banner:
    position: viewport-top-center
    typography: "{typography.placement-hint}"
    background: "{colors.surface-glass}"
  empty-state-filtered:
    copy: "No types match “{query}”."
    cta: "Clear search"
  empty-state-zero:
    copy: "No placeable types in this world."
    cta: "Open Objects rail"
    note: "Rare — builtins with Transform normally remain after soft-hide."
---

# Design: Rooms Objects Placement — Place Types Catalog

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-160 (Proposal: Rooms Objects tab — place types, not raw assets)  
**Design issue:** TRL-162  
**Mock:** [rooms_objects_placement_mockup.html](./rooms_objects_placement_mockup.html)  
**Inherits:** [asset_placement_design.md](./asset_placement_design.md) (ghost / banner / snap), [game_maker_workbench_ui_design.md](./game_maker_workbench_ui_design.md) (rail vs Rooms), AppShell tokens (`app.css`)

---

## Overview

Rooms today place **raw meshes** and open an **Add entity** create dialog. That inverts the GameMaker loop. This wedge makes **Rooms → Objects** the placeable **object-type catalog**: pick a type, arm a ghost, click the ground, spawn an instance.

**Audience:** builder-engineer in **edit mode**, Rooms rail route.

**Tone:** palette → canvas. The Objects tab is a **placement palette**, not a type editor (that stays on rail Objects) and not a mesh library (that stays on rail Assets).

**Locked IA (do not reopen):**

| Surface | Owns |
| ------- | ---- |
| Rooms left tabs | **Room \| Instances \| Objects** only |
| Rooms → Objects | Place types into the room |
| Rail Objects | Define / edit types |
| Rail Assets | Assign meshes to type fields |
| Rail Settings | Settings (not a Rooms tab) |

---

## Colors

Reuse AppShell + asset-placement accents. Placement chrome stays **entity-blue** (`accent-placement`), not primary coral — coral is for active Rooms tab underline and primary CTAs.

| Role | Token | Usage |
| ---- | ----- | ----- |
| Active Rooms tab | `primary` underline | Room / Instances / Objects |
| Armed type tile | `accent-placement-muted` + border | Selected for placement |
| Ghost / cell / banner | same as TRL-55 placement | Continuity with existing ghost session |

---

## Typography

- **Tab labels:** 11px medium UI sans (existing `LeftPanel` tabs).
- **Search placeholder:** 12px muted (“Search object types…”).
- **Type tile name:** 11px medium; badge mono 9–10px (“built-in” / “custom”).
- **Placement banner:** 11px UI sans — “Click to place · Esc to cancel”.
- **Empty state body:** 12px muted; CTA outline button 11px.

---

## Layout

### Rooms left pane (normative)

```
┌─ Room editor ─────────────────────────────┐
│ [ Room ] [ Instances ] [ Objects ]         │  ← 3 tabs only
├───────────────────────────────────────────┤
│ 🔍 Search object types…                   │  ← Objects tab only
├───────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐                 │
│ │  thumb   │ │  thumb   │  2-col grid     │
│ │ Prop     │ │ Character│                 │
│ └──────────┘ └──────────┘                 │
│ …                                         │
└───────────────────────────────────────────┘
```

**Removed from Rooms:** Assets tab, Settings tab. Do not leave stubs or “coming soon” tabs.

### Objects tab anatomy (`RoomObjectsPanel`)

1. **Subtitle** — one line under tabs / above search: “Place types into this room.” Disambiguates from rail Objects (“define types”).
2. **Search** — filters catalog by display name (case-insensitive).
3. **Play hint** — when `play` mode: persistent `role="status"` strip under search (“Exit play to place objects.”); tiles disabled. Not toast-only.
4. **Type grid** — 2 columns (panel ~320px). Optional list toggle **out of scope** v1 — grid only.
5. **Type tile** — preview thumb (from type default `SkinnedMesh.mesh` → `Render.mesh` → `Sprite`; fallback solid box) + name + built-in/custom chip. Toggle buttons with `aria-pressed` (not listbox/option).
6. **Empty / filtered-empty** — see Empty states.

### Viewport (armed)

Identical contract to [asset_placement_design.md](./asset_placement_design.md): top-center banner, ground ghost, optional grid cell highlight. Ghost mesh resolves from the **type’s default mesh**, not a raw asset URL chosen in Rooms.

### Add object entry points

| Entry | Current | Target |
| ----- | ------- | ------ |
| Instances footer | “Add entity” → `AddEntityDialog` | **Add object** → `ui.setRoomsPaneTab('objects')` (+ focus search) |
| Viewport context menu | “Add entity” | **Add object** → same |
| `AddEntityDialog` | mounted | **Gated off** (flag); do not hard-delete until e2e migrated |

After opening Objects from Add object: do **not** auto-arm a type — author picks from the catalog.

---

## Elevation & Depth

- Type tiles: same card elevation as Assets grid tiles / `AssetItem`.
- Armed tile: placement accent wash (not selection primary).
- Ghost / cell / banner: inherit TRL-55 elevation rules.

---

## Shapes

Radii from AppShell (`--radius-sm` / `--radius-md`). Tile corners `rounded.sm`. No new shape language.

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **Rooms tablist** | 3 tabs | active / idle / focus | `LeftPanel.svelte` `TABS` |
| **RoomObjectsPanel** | subtitle + search + play-hint + type grid + empty | idle, searching, empty, filtered-empty, play-disabled | **New** `RoomObjectsPanel.svelte` |
| **TypeTile** | `button` toggle: thumb + name + badge | idle, hover, focus, **armed** (`aria-pressed`), disabled (play) | New; density from Assets tiles |
| **PlayHint** | status strip under search | hidden / visible in play | Part of `RoomObjectsPanel` |
| **PlacementBanner / Ghost / Cell** | existing placement chrome | hidden / active | `placementSession` + viewport overlays |
| **Add object footer** | full-width outline button | idle | `EntityList.svelte` footer |
| **AssetsPanel / AddEntityDialog** | unchanged code | **unmounted / gated** from Rooms | Flag off per AGENTS.md |

**Not this panel:** `ObjectsResourcePanel` (rail type editor). Different job, different chrome.

---

## What types appear

**Source:** `listObjectTypes()` (already excludes collections).

**Include:** types whose schema includes **`Transform`** (spatial placeables).

**Exclude from catalog (soft-hide):**

| Type | Why |
| ---- | --- |
| `GroundPlane` | Room infrastructure, not an object to stamp |
| `AmbientLight` / `DirectionalLight` | Lighting setup; not GameMaker “objects” |

**Include explicitly:** `Prop`, `SpriteProp`, `SpawnPoint`, `Character` / `CharacterFemale`, `Player`, and all custom object types with `Transform`.

**Player note:** placing `Player` creates another player-typed instance (useful for spawn testing). Do not special-case hide unless Architect finds a hard ownership conflict — document in Open for Architect.

**Thumb resolution order:** type defaults `SkinnedMesh.mesh` → `Render.mesh` → `Sprite` atlas/frame → solid box proxy tinted muted.

---

## Empty states

| Condition | UI |
| --------- | -- |
| **Filtered empty** (search matches nothing) | Centered: “No types match “{query}”.” + text button **Clear search** (clears input, restores grid). No rail CTA. |
| **True zero catalog** (no types pass Transform + soft-hide — rare with builtins) | “No placeable types in this world.” + outline **Open Objects rail** → `ui.setRoute('objects')` |
| Play mode | Tiles `disabled`; persistent **PlayHint** under search (not toast-only) |

**Do not** use “Define objects on the Objects rail…” as the primary empty for a stock world — builtins with `Transform` remain after soft-hiding GroundPlane/lights. Optional secondary hint when the catalog is *only* builtins is out of scope.

---

## Interaction matrix

| Input | States / precondition | Output |
| ----- | --------------------- | ------ |
| Click Rooms → Objects | edit mode, Rooms route | Show `RoomObjectsPanel`; clear prior mesh-only Rooms Assets path |
| Type in search | Objects tab | Filter tiles by name |
| Search hides armed tile | armed + filter | **Keep** draft / banner / ghost; filtering does not clear arm |
| **Click** type tile | edit, not play | Arm `PlacementDraft` `{ kind: 'type', typeName, label }`; tile `aria-pressed=true`; banner shown |
| **Drag** type tile → viewport | edit, not play | Same draft via `placementDrag` / drop; enter tracking. **Normative for this wedge** — overrides TRL-55 “Don’t use HTML DnD as primary” (Rooms Objects drag MIME path is intentional) |
| Click second type while armed | armed | Replace draft; previous tile disarms |
| Pointer move over viewport | armed / tracking | Ghost follows ground raycast; snap per existing grid rules |
| Primary click ground | tracking | `spawnFromType(typeName, { position, autoSuffix })`; select instance; clear draft; toast “Placed {Type}” |
| Pointer down + drag >4px on viewport | tracking | Orbit/pan wins; **do not commit** on pointerup (same threshold as `viewportPick` / TRL-55) |
| Click outside viewport / panel | armed | **Stay armed** until Esc, commit, replace, play, or rail leave |
| Switch Rooms tab Room ↔ Instances ↔ Objects | armed | **Stay armed** (palette can leave Objects while ghost tracks) |
| Leave Rooms rail route | armed | **Cancel** placement |
| Enter play mode | any | **Cancel** placement; show PlayHint; disable tiles |
| Esc | armed / tracking | Cancel; clear ghost; announce “Placement cancelled” |
| Instances footer **Add object** | Instances tab | Switch to Objects tab; focus search; dialog stays closed |
| Viewport context **Add object** | edit | Same as footer |
| Filtered empty → **Clear search** | filtered-empty | Clear query; restore grid |
| Open rail Assets | any | Unchanged mesh library / pick-to-field |
| Attempt Rooms Assets / Settings tab | — | **Tabs do not exist** |

### Placement state machine

```
idle ──(click|drag type)──► armed ──(pointer in viewport)──► tracking
  ▲                            │                                │
  │                            └── Esc / rail-leave / play ─────┤
  └──────── Esc / commit / play / rail-leave ◄──(ground click)──┘
```

**Normative:** Reuse TRL-55 pointer session semantics (orbit threshold, outside-click stays armed). Drag is first-class for Rooms Objects (proposal-locked); click-to-arm remains required for discoverability.

### Post-commit

- Auto-select spawned entity.
- Stay on **Objects** tab (palette stays open for multi-place). Optional: hold Shift to keep armed after commit — **stretch**, not v1.

---

## Accessibility

- **Focus order:** Rooms tabs → Objects search → type tiles (DOM order) → Add object (when on Instances). Viewport not focus-trapped.
- **Labels:** tiles `aria-label="Place {Type} in room"`; armed `aria-pressed="true"` on toggle buttons (grid of toggles — **not** `listbox`/`option`/`aria-selected`).
- **Banner / PlayHint:** `role="status"` `aria-live="polite"`.
- **Esc:** cancels placement; live region “Placement cancelled”.
- **Motion:** `prefers-reduced-motion` — no pulse on armed border / cell; snap remains instant.
- **Keyboard stretch (not AC):** Enter commits at last ghost position — document only.

---

## Do's and Don'ts

**Do**

- Treat Rooms → Objects as a **placement palette** (GameMaker room editor).
- Show subtitle “Place types into this room” so rail Objects ≠ Rooms Objects.
- Reuse asset-placement ghost, banner, snap, Esc cancel, orbit threshold, outside-click-stays-armed.
- Prefer label **Add object** everywhere the old “Add entity” meant “create something in the room”.
- Flag-off AssetsPanel / AddEntityDialog mounts; keep files for e2e migration.

**Don't**

- Put Assets or Settings back in the Rooms tablist.
- Mount `ObjectsResourcePanel` inside Rooms (that’s rail editing).
- Require typing `@id` / suffix in a dialog to place.
- Place raw GLB URLs from Rooms without a type.
- Hard-delete `AssetsPanel` / `AddEntityDialog` in this wedge.
- Use “define objects on the rail” as the stock-world empty (builtins exist).

---

## Open for Architect

1. **`PlacementDraft` union:** encode `kind: 'type' | 'mesh'`; Rooms UI only creates `type` drafts; mesh path remains for any non-Rooms callers until retired.
2. **`spawnFromType` options:** `{ position, suffix? }` with auto suffix via `nextPasteId` family when omitted.
3. **Soft-hide list:** confirm GroundPlane + lights excluded; whether `Player` stays visible (design default: **yes**).
4. **Ghost for skinned types:** use default mesh URL; bbox wireframe until load (same as model ghost).
5. **Coordination:** do not collide with TRL-159 Objects bottom pane lane on shared shell files — sequence LeftPanel edits if both land.
6. **E2E:** rewrite `assets-placement` → Objects placement; assert no Rooms Assets/Settings tabs; gate AddEntityDialog.

---

## Design research

| Ref | Takeaway |
| --- | -------- |
| `docs/artifacts/asset_placement_design.md` + mockup | Ghost, banner, snap, armed tile language — **reuse**, swap source from mesh → type |
| `docs/artifacts/game_maker_workbench_ui_design.md` | Rail = resources; Rooms drawer = scene — Objects tab is place, not define |
| `src/lib/ui/LeftPanel.svelte` | Current 4 tabs → collapse to 3; replace Assets mount |
| `src/lib/ui/ObjectsResourcePanel.svelte` | Contrast: list + “New” for **editing**; Rooms panel must not copy that chrome |
| `src/lib/ui/EntityList.svelte` footer | “Add entity” → “Add object” → Objects tab |
| `listObjectTypes()` | Catalog source; filter Transform; soft-hide infra types |

---

## Handoff checklist

- [x] `docs/artifacts/rooms_objects_placement_design.md` (this file)
- [x] `docs/artifacts/rooms_objects_placement_mockup.html`
- [x] Paths in TRL-162 `describe` SUMMARY
- [x] Design critique round + verification before Architect HANDOFF
