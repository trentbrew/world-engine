---
version: 2
name: Asset Placement — Shapes + Scene Ghost Drop
parent: TRL-63
design: docs/artifacts/asset_placement_design.md
mock: docs/artifacts/asset_placement_mockup.html
status: queue-ready
baseline: PR #1 co-located impl (partial — see Gap analysis)
---

# Spec: Asset Placement — Shapes + Scene Ghost Drop

**Design:** [asset_placement_design.md](./asset_placement_design.md)  
**Mock:** [asset_placement_mockup.html](./asset_placement_mockup.html)  
**Trellis:** TRL-63 (Proposal) → TRL-65 (Spec)  
**Out of scope (v1):** rotation while placing; textures/audio placement; durable entity-create (follow-up wedge); left-tab auto-switch after spawn

> **v2 note:** Partial implementation landed co-located with TRL-56 (PR #1). Executor Phase 2 closes gaps below; do not rip out working placement session.

---

## Summary

Add a **Shapes** catalog to the Assets tab and a **placement session** (pointer + optional HTML5 tile drag) that spawns `Prop` entities on the ground plane with a live ghost preview, optional grid snap + cell highlight, and unified behavior for primitives and models. Coordinated through `ui.placementDraft` and scene-side raycasting.

---

## Gap analysis (architect — TRL-63, 2026-06-27)

Baseline in tree: `shapes.ts`, `placementSession.ts`, `PlacementGhost`, `GridCellHighlight`, `PlacementBanner`, `AssetsPanel` Shapes section, `world.createProp`, mode guards, model ghost timeout.

| Area | Status | Remaining |
| ---- | ------ | --------- |
| Shapes catalog + accordion | **DONE** | — |
| Pointer session + snap + commit | **DONE** | Click-without-move fails (no `placementPosition` until `pointermove`) |
| Model placement + `createProp` | **DONE** | — |
| Mode guards (pick/play/Esc/drag≥4px) | **DONE** | Model tiles lack visual `disabled` in play (functional guard OK) |
| Ghost wireframe + glTF timeout | **DONE** | Color hardcoded `#5b9fd4` vs `--accent-entity` token |
| Grid cell highlight | **PARTIAL** | Missing dashed border; hardcoded fill |
| HTML5 panel→viewport drag | **DONE (expanded)** | Promoted to v1 — see decision below |
| `pnpm check` | **VERIFY** | Must pass on integration branch |

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| HTML5 drag Assets→viewport | **In scope v1** (was out-of-scope in v1 draft) | Already implemented (`placementDrag.ts`, tile `draggable`); banner copy references drag; removing is churn |
| Ghost/highlight color | **`--accent-entity` via CSS** — read at runtime or shared constant from `app.css` token | Spec + design alignment; drop hardcoded `#5b9fd4` |
| Click commit without prior move | **Raycast on `pointerdown`** — call `updateFromHit` before `pointerup` commit check | AC: click-to-place must work on first click |
| Primitive Y on floor | **Rest Y from mesh bounds** — position entity so bbox bottom sits at `y=0` using per-primitive half-heights from `MeshView` geometry (box 0.5, sphere 0.5, capsule ~0.57) | Visual consistency; avoids floating/sunken shapes |
| Model Y on floor | **`Render.anchor: 'bottom'`** at snapped X/Z, `y=0` | Matches existing `world.jsonld` barrel pattern |
| Grid off placement | **0.1 m quantize** on X/Z; no cell highlight | Design recommendation; avoids jitter |
| Grid on placement | Snap to `ui.grid.cellSize`; show cell highlight | Design normative |
| Durable persist on spawn | **Defer** — v1 RAM-only via `world.spawn` (same tier as paste today) | `DurablePatch` / `applyPatchToGraph` only supports field updates + scene-settings entity create; full graph node insert is separate wedge |
| Placement vs pick mode | Pick mode wins — tile click applies field, **does not** arm placement | Design matrix |
| Orbit conflict | Reuse **`DRAG_THRESHOLD_PX = 4`** from `viewportPick.ts`; no commit if pointer moved ≥ threshold between down/up | Existing viewport gesture contract |
| Concurrent armed tile | Single `placementDraft`; new tile click replaces | Design §5 |
| glTF ghost timeout | **3 s** → box wireframe proxy | Bounded async load |
| Entity id | `entity:prop/<slug>` with `nextPasteId` collision suffix | Reuse clipboard id helper |

---

## Data model

### `PlacementDraft` (new type in `ui.svelte.ts` or `placementSession.ts`)

```ts
type PlacementDraft = {
  mesh: string; // primitive:* or glTF URL
  anchor?: 'origin' | 'bottom'; // default origin for primitives, bottom for models
  label: string; // toast + aria ("Box", "barrel.glb")
  source: 'shape' | 'model';
};
```

### `ui` additions (`src/lib/ui/ui.svelte.ts`)

```ts
placementDraft = $state<PlacementDraft | null>(null);
placementPosition = $state<[number, number, number] | null>(null); // snapped world pos, updated while tracking
```

Clear both on cancel, commit, and `ui.enterPlay()`.

### Static shapes catalog (`src/lib/assets/shapes.ts` — new)

| id | label | mesh | thumb kind |
| -- | ----- | ---- | ---------- |
| box | Box | `primitive:box` | box |
| sphere | Sphere | `primitive:sphere` | sphere |
| capsule | Capsule | `primitive:capsule` | capsule |

---

## Placement session (`src/lib/scene/placementSession.ts`)

### State machine

| State | Condition | Transitions |
| ----- | --------- | ----------- |
| `idle` | `placementDraft === null` | tile click → `armed` |
| `armed` | draft set, pointer not over viewport | Esc → `idle`; pointer enters viewport canvas → `tracking` |
| `tracking` | draft set, pointer over viewport | move → update position; Esc → `idle`; primary click (no drag) → commit → `idle` |

### Raycast

- Target: existing ground pick plane in `WorldScene.svelte` (`y ≈ 0`, 50×50) **or** mathematical XZ plane at `y=0` via Threlte interactivity / manual raycast in `useThrelte`.
- Output world `[x, y, z]` before snap.

### Snap helpers

```ts
function snapPosition(hit: [number, number, number], gridOn: boolean, cellSize: number): [number, number, number]
```

- `gridOn === true` (`ui.chrome.grid`): `x = round(x/cellSize)*cellSize`, same for `z`.
- `gridOn === false`: quantize X/Z to **0.1** m; leave Y from rest helper.

### Rest Y helper

```ts
function restPositionForDraft(draft: PlacementDraft, snappedXZ: [number, number]): [number, number, number]
```

- **Models** (`anchor: 'bottom'`): `[x, 0, z]`.
- **Primitives**: `[x, restY(mesh), z]` where `restY` = half-height from MeshView geometry constants (document inline next to MeshView capsule args).

### Commit (`world.createProp` — new method on `WorldRuntime`)

```ts
createProp(opts: { mesh: string; anchor?: MeshAnchor; position: [number, number, number]; label?: string }): Entity | null
```

1. Build id: `nextPasteId('entity:prop/<slug>', existingIds)` — slug from shape id or basename of model URL.
2. Entity: `{ id, type: 'Prop', components: { Transform: { position }, Render: { mesh, anchor?, color: '#d4d4d4' } }, raw: {} }`.
3. `world.spawn(entity)`; `world.select(id)`; toast success.
4. Return entity.

**No durable write v1** — document in code comment referencing follow-up.

### Global listeners (module or `PlacementSession.svelte`)

- `window keydown`: `Escape` → cancel if draft active and `ui.shellMode === 'edit'`.
- Viewport pointer: registered on ground mesh or canvas wrapper — move updates position; pointerup with drag guard commits.
- `ui.enterPlay()`: cancel draft (extend existing method in `ui.svelte.ts`).

---

## UI — Assets tab

### Section order (normative)

1. **Shapes** — new, default open, no `+` action  
2. Models  
3. Textures  
4. Audio  

Implement in `AssetsPanel.svelte` before `ASSET_KIND_ORDER` loop.

### Shapes section

- `InspectorAccordion title="Shapes"` (no actions snippet).
- 3-column grid of shape tiles (reuse grid gap/card styling from `AssetItem` grid).
- Each tile: `button` with thumb + label; `aria-label="Place {label} on scene"`.
- **Armed** when `ui.placementDraft?.mesh === shape.mesh` — border/background per design tokens (`accent-entity` mixes).

### Model tiles

- In **edit mode**, when **not** pick mode: primary click on model **arms placement** (not pick/copy).
- When **pick mode**: existing `selectAsset` behavior unchanged.
- When pick mode inactive and user clicks without placement intent on list item — arm placement (design: same as shapes). *Copy-on-click without pick mode is removed for models in edit mode* — replaced by placement arm; secondary affordance for copy deferred.

**Clarification for Executor:** When `!picking && shellMode === 'edit'`, model/shape click → `startPlacement(draft)`. When `picking`, click → `selectAsset`. When `!picking && shellMode === 'edit'` is false, no placement.

### Disabled states

Shape/model placement disabled when: `ui.shellMode === 'play'`, `uploadingKind !== null`, or pick mode (shapes only disabled for placement — models use pick flow).

---

## Scene components

| File | Responsibility |
| ---- | -------------- |
| `src/lib/scene/PlacementGhost.svelte` | Renders draft mesh at `ui.placementPosition`; wireframe primitive; glTF with bbox fallback |
| `src/lib/scene/GridCellHighlight.svelte` | 1×1 plane at snapped cell; visible when grid on + tracking; `y=0.025`, `renderOrder` > grid |
| `src/lib/scene/PlacementBanner.svelte` | Viewport top-center hint; mount in `WorldViewport.svelte` |
| `src/lib/scene/placementSession.ts` | Raycast, snap, start/cancel/commit API |
| `src/lib/scene/WorldScene.svelte` | Mount ghost + highlight; wire ground plane pointer handlers for placement |

### Ghost material

Match `MeshView.svelte` peer ghost: `MeshBasicMaterial`, wireframe, `opacity: 0.72`, `depthWrite: false`, color `--accent-entity`.

### Grid cell highlight

- Size: `ui.grid.cellSize`
- Fill/border: CSS token equivalents (`color-mix(in srgb, var(--accent-entity) 20%, transparent)` fill, dashed border)

---

## File touch list

| Action | Path |
| ------ | ---- |
| New | `src/lib/assets/shapes.ts` |
| New | `src/lib/scene/placementSession.ts` |
| New | `src/lib/scene/PlacementGhost.svelte` |
| New | `src/lib/scene/GridCellHighlight.svelte` |
| New | `src/lib/scene/PlacementBanner.svelte` |
| Extend | `src/lib/ui/ui.svelte.ts` — `placementDraft`, `placementPosition`, cancel on play |
| Extend | `src/lib/ui/AssetsPanel.svelte` — Shapes section, placement arm handlers |
| Extend | `src/lib/ui/AssetItem.svelte` — optional `armed` prop + styling |
| Extend | `src/lib/engine/runtime/world.svelte.ts` — `createProp()` |
| Extend | `src/lib/scene/WorldScene.svelte` — ghost, highlight, placement pointer hooks |
| Extend | `src/lib/scene/WorldViewport.svelte` — `PlacementBanner` |

**Do not modify:** texture/audio pick flows; `AddEntityDialog`; durable graph layer (v1).

---

## Phase plan

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| **1** | Shapes catalog, placement session, ghost, spawn, mode guards | **Landed** (PR #1 baseline) |
| **2** | Gap close: click-without-move, token styling, a11y, verify AC | **Executor** (TRL-65) |

---

## Acceptance criteria (testable)

### Build

- [ ] `pnpm check` passes with zero errors.

### Shapes catalog

- [ ] Assets tab shows **Shapes** accordion **above** Models.
- [ ] Shapes contains Box, Sphere, Capsule in a **3-column** grid.
- [ ] Shapes section has **no** upload `+` button.
- [ ] Shapes accordion default **open** on load.

### Placement session — primitives

- [ ] In edit mode, click Box → tile shows armed state; viewport banner visible.
- [ ] Moving pointer over viewport shows wireframe box ghost at snapped position.
- [ ] With reference grid **on**, ghost snaps to `ui.grid.cellSize` and cell highlight visible.
- [ ] With reference grid **off**, ghost uses 0.1 m X/Z quantize; **no** cell highlight.
- [ ] Click viewport (without orbit drag) spawns `Prop` with `Render.mesh: primitive:box`, entity selected, toast shown.
- [ ] Click viewport **without prior pointermove** still commits (raycast position on `pointerdown`).
- [ ] **Esc** cancels placement; ghost/highlight/banner cleared.
- [ ] HTML5 drag from shape/model tile to viewport drop spawns Prop (v1 accepted expansion).

### Placement session — models

- [ ] Click model tile (edit, not pick mode) arms placement with `anchor: bottom`.
- [ ] Ghost shows bbox wireframe until glTF loads (or box fallback after timeout).
- [ ] Commit spawns Prop with model URL; feet on floor at snapped X/Z.

### Mode guards

- [ ] Asset **pick mode** active: shape/model click applies field — **no** placement arm.
- [ ] **Play mode**: placement cannot start; entering play cancels active draft.
- [ ] Pointer drag ≥ 4 px on viewport does **not** commit placement.

### Spawn

- [ ] `world.createProp` generates non-colliding `entity:prop/*` ids.
- [ ] Spawned entity appears in scene and Objects list; inspector shows Transform + Render.

### Accessibility

- [ ] Shape tiles have `aria-label` including "Place … on scene".
- [ ] Armed tile uses `aria-pressed="true"`.
- [ ] Banner uses `role="status"` and `aria-live="polite"`.
- [ ] Esc cancel announces via toast or live region ("Placement cancelled").

### Visual polish (Phase 2)

- [ ] `PlacementGhost` uses `--accent-entity` (not hardcoded hex).
- [ ] `GridCellHighlight` uses token fill + dashed border per design §Scene components.

### Regression

- [ ] Asset pick-to-field unchanged for textures/audio.
- [ ] Model `+` upload unchanged.
- [ ] Orbit/pan and viewport entity select still work when not placing.

---

## Stretch (non-blocking)

- [ ] Durable graph insert on spawn (new `DurableStore.createEntity` + `@graph` node) — host-only.
- [ ] Pointer-down on tile + immediate viewport move enters tracking without second click.

---

## Non-goals (v1)

- Rotation while placing (scroll / `[` `]`).
- Textures/audio spawn onto scene.
- Auto-switch to Objects tab after spawn.
- Multiplayer broadcast of placed props (RAM spawn is local/session host world state only until durable wedge).

---

## Follow-up wedge (record on graph)

**Proposal: Durable entity create on spawn** — extend `applyPatchToGraph` / Trellis write path to append full `Thing` nodes; sync across host peers.
