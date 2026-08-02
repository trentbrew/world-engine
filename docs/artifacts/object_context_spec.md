---
version: 1
name: Editor shell — Object context (Phase D)
status: queue-ready
labels: spec, ui, shell, animation, behavior, phase-d, needs-e2e
parent: editor_shell_refactor_spec.md
graph: TRL-145
related: SkinnedMeshView, clipCatalog, animated-npc-demo, gamemaker_alarms_spec, skinned_mesh_animation_spec
---

# Spec: Object context — isolated stage + clip picker + Behavior drawer

**Goal.** When authoring an animated Character, switch to a dedicated **Object**
context: clip library on the left, a single-entity **preview stage** in the
canvas, playback fields on the right, and a **Behavior** bottom shelf (clip
schedule + `alarm*` event lanes). Enter via rail, double-click, or an explicit
“Edit object” verb. Reuses skinned-mesh Phases 1–4 (runtime, catalogs,
placement) — **no new ontology components** in v1.

**Parent:** [editor_shell_refactor_spec.md](./editor_shell_refactor_spec.md)
Phase D.\
**Graph:** TRL-145 (impl). **Blocked by:** TRL-142, TRL-143.

---

## Grounded prerequisites (2026-07-08)

| Prerequisite                                | Status   | Notes                                                         |
| ------------------------------------------- | -------- | ------------------------------------------------------------- |
| `railRoute`, `objectTarget`, `editObject()` | **done** | `ui.svelte.ts` — `rooms` default; `object` = instance editor  |
| Bottom dock world nav                       | **done** | `BottomDock.svelte` — Graph / Assets / Objects / Rooms / Chat |
| `AppShell` bottom slot + `bottomPaneHeight` | **done** | `BottomPane.svelte`                                           |
| `WorldShell` routes by `railRoute`          | **done** | left / main / right / bottom                                  |
| `setEvents` durable patch                   | **done** | D4 behavior authoring                                         |

**Hard gate:** TRL-145 impl must not merge until **TRL-142** and **TRL-143**
close. D4a (read-only behavior) may land in the same PR as D1–D3 once B routing
works.

---

## Context layout

| Region          | Rooms (default)                                              | Instance editor (`object`)                         |
| --------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| **Bottom dock** | Graph · Assets · Objects · **Rooms** · Chat                  | same (Rooms not highlighted)                       |
| **Left**        | `LeftPanel` — tabs **Room** \| **Instances** \| **Settings** | `ObjectClipLibrary`                                |
| **Canvas**      | `WorldViewport`                                              | `ObjectStageViewport` — **only** `ui.objectTarget` |
| **Right**       | `RightPanel`                                                 | `ObjectPlaybackInspector`                          |
| **Bottom**      | _(none)_                                                     | `ObjectBehaviorDrawer` in `BottomPane`             |

**Navigation rule:** bottom dock = _world places_; left pane tabs = _room
views_; instance editor = _enter via dblclick_, not bottom dock. Never label a
pane tab "Assets" when Assets is a dock route.

---

## Decisions (normative)

| Decision                        | Choice                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `objectTarget` on exit to Scene | **Preserve** — resume last character when re-entering Object                                                                      |
| Bottom pane toggle              | **`bottomPaneOpen` / `toggleBottomPane()`** — Object context only (`/` shortcut)                                                  |
| Animatable eligibility          | Entity has **`SkinnedMesh` and `Mesh3DAnimator`**                                                                                 |
| Edit-mode root motion           | **Off** — `SkinnedMeshView` root-motion writes remain play-only                                                                   |
| Preview `playing`               | **`objectPreviewPlaying`** in `ui` — drives stage mixer only; durable `Mesh3DAnimator.playing` unchanged until author edits field |
| Behavior authoring scope        | **Clip + alarm schedule only** — no generic DSL editor in v1                                                                      |

---

## Entry & exit

### Entry (all → `ui.editObject(entityId)`)

1. **Double-click** animatable entity in Rooms viewport (`pointerPick.ts`).
2. Entity list action: “Edit behavior…”
3. Room inspector link on `Mesh3DAnimator`: “Open in Object editor”

**Not** bottom-dock Objects — that route lists world object _types_, not the
instance editor.

> **Game-tier note.** The Objects route (`ObjectsResourcePanel`, a stub) lists
> game-global `EntityType`s. Those types, and **Collections** (data-record
> types), are the _same primitive_ — game-global types defined via `defineType`.
> Build the type-definition backend **once** and share it between the Objects
> resource editor and Collections. The instance editor below is unaffected. See
> [[game_project_tier_collections_spec]].

### Gate

Non-animatable: `editObject` no-ops + `ui.modeMessage` toast; instance editor
shows empty state.

### Exit

- Rail → Scene (`objectTarget` preserved)
- Esc: collapse bottom pane if open, else `exitObject()` → Scene
- DocBar breadcrumb (follow-up): `Scene › <shortId>`

---

## State (`ui.svelte.ts`)

**Add:**

```ts
type ObjectLeftTab = 'clips' | 'structure';

objectLeftTab = $state<ObjectLeftTab>('clips');
objectPreviewPlaying = $state(true);

isAnimatableEntity(id: string): boolean
exitObject(): void  // railRoute='rooms'; preserve objectTarget
```

**Reuse:** `bottomPaneOpen`, `bottomHeight`, `resizeBottomPane`,
`bottomPaneHeight` getter (returns 0 in Scene).

---

## Implementation wedges

### D1 · Isolated stage + routing shell

| File                         | Change                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| `WorldShell.svelte`          | Switch `leftPanel` / `main` / `rightPanel` snippets by `railRoute` |
| `ObjectStageViewport.svelte` | **New** — `Canvas` when `railRoute==='object'` && `objectTarget`   |
| `ObjectStageScene.svelte`    | **New** — stage light, ground disc, orbit cam, single `Thing`      |
| `pointerPick.ts`             | dblclick → `editObject` when animatable                            |
| `ui.svelte.ts`               | `isAnimatableEntity`, `exitObject`, validate in `editObject`       |

**Stage rules:**

- Render only `objectTarget` — no world roots, peers, placement ghost.
- Stage entity at origin; honor `SkinnedMesh.anchor` for Y.
- Suspend / destroy Object `Canvas` when leaving Object route (no idle second
  renderer).
- Share `loadGltf` / `resolveClip` cache with `SkinnedMeshView`.

**AC (D1):**

- `?game=animated-npc-demo` → dblclick `entity:npc/guard` → Object route; stage
  shows guard only.
- `Mesh3DAnimator.clip` change (via evaluate or inspector) updates preview
  without reload.
- `e2e/smoke`, `e2e/workbench-ui`, `e2e/assets-placement`,
  `e2e/play-edit-boundary` green.

---

### D2 · Clip library (left)

| File                       | Change  |
| -------------------------- | ------- |
| `ObjectClipLibrary.svelte` | **New** |
| `ObjectClipGrid.svelte`    | **New** |

- Load catalog from `Mesh3DAnimator.catalog` via `loadCatalog` or
  `GET /api/animation/clips?catalog=`.
- Category pills + search on clip `id`.
- Click → `world.setField` + `editHistory` capture (same path as inspector).

**AC (D2):**

- Guard library lists `Idle_Loop`, `Walk_Loop`, `Dance_Loop`, …
- Click `Dance_Loop` → durable field update + stage preview.

---

### D3 · Playback inspector (right)

| File                             | Change  |
| -------------------------------- | ------- |
| `ObjectPlaybackInspector.svelte` | **New** |

Fields: `clip` (read-only), `speed`, `loop`, `rootMotion`, `playing` (preview
via `objectPreviewPlaying`), `catalog` (read-only). Reuse `InspectorField` /
`EntityAttributes` writers. Link: “All properties…” → Scene +
`world.select(objectTarget)`.

**AC (D3):** Speed/loop edits persist and reflect in stage preview.

---

### D4a · Behavior drawer (read)

| File                           | Change                         |
| ------------------------------ | ------------------------------ |
| `ObjectBehaviorDrawer.svelte`  | **New** — replaces bottom stub |
| `BehaviorScheduleStrip.svelte` | **New**                        |
| `BehaviorAlarmLane.svelte`     | **New**                        |

- Parse `entity.events` (`create`, `alarm0`…`alarm11`).
- **Schedule strip:** static walk of `{ alarm, in }` chains +
  `set Mesh3DAnimator.clip` → chips `+Ts → ClipId`. Mark **partial** when `if`
  branches present.
- **Alarm lanes:** collapsible rows; reuse `EntityEventsPanel` action summaries.

**AC (D4a):** Guard idle⇄dance loop visible on strip without Play.

---

### D4b · Behavior authoring + `setEvents` patch

**New durable patch kind:**

```ts
export type DurableSetEventsPatch = {
  kind: "setEvents";
  entityId: string;
  events: EntityEvents; // full replacement for entity inline events
};
```

Wire through: `durablePatch.ts`, `applyDurablePatchToGraph`,
`world.applyHistoryPatch`, `/api/world/[game]/patch`, undo/redo in
`editHistory.svelte.ts`.

**Minimal authoring UI (no generic action editor):**

| UI action                | DSL                                              |
| ------------------------ | ------------------------------------------------ |
| Add clip at +T on slot N | `{ "alarm": N, "in": T }` in prior handler       |
| On alarm fire            | `{ "set": "Mesh3DAnimator.clip", "to": "<id>" }` |
| Loop                     | re-arm `{ "alarm": 0, "in": T }` at chain end    |

**AC (D4b):** Author `Angry` at +5s on a test Character → persists in JSON-LD;
undo restores.

---

## `setEvents` patch — apply semantics

1. Find entity node in `@graph` by `@id`.
2. Set `events` key to patch payload (omit key when `{}`).
3. On live world: replace `entity.events` on the reactive instance.
4. Do **not** sync alarm runtime state — alarms arm on next Play `create`
   (existing semantics).

---

## E2E (`needs-e2e`)

**New:** `e2e/object-context.spec.ts`

| Test               | Assert                                             |
| ------------------ | -------------------------------------------------- |
| Enter via dblclick | Object route; guard visible on stage               |
| Clip pick          | `Walk_Loop` in library → field + preview           |
| Behavior read      | Schedule strip contains `Dance_Loop`               |
| Round-trip         | Object → Scene → Play → guard → `Dance_Loop` ~2.5s |
| Gate               | dblclick ground → stays Scene                      |

**Extend:** `e2e/animated-npc-demo.spec.ts` — no regression on existing three
tests.

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/object-context.spec.ts e2e/animated-npc-demo.spec.ts e2e/assets-placement.spec.ts e2e/smoke.spec.ts
```

---

## File checklist

| Path                                         | Wedge      |
| -------------------------------------------- | ---------- |
| `src/lib/ui/WorldShell.svelte`               | D1 routing |
| `src/lib/scene/ObjectStageViewport.svelte`   | D1         |
| `src/lib/scene/ObjectStageScene.svelte`      | D1         |
| `src/lib/ui/ObjectClipLibrary.svelte`        | D2         |
| `src/lib/ui/ObjectClipGrid.svelte`           | D2         |
| `src/lib/ui/ObjectPlaybackInspector.svelte`  | D3         |
| `src/lib/ui/ObjectBehaviorDrawer.svelte`     | D4         |
| `src/lib/ui/BehaviorScheduleStrip.svelte`    | D4a        |
| `src/lib/ui/BehaviorAlarmLane.svelte`        | D4a        |
| `src/lib/engine/render/pointerPick.ts`       | D1         |
| `src/lib/ui/ui.svelte.ts`                    | D1         |
| `src/lib/engine/ontology/durablePatch.ts`    | D4b        |
| `src/lib/engine/authoring/worldFileStore.ts` | D4b        |
| `src/lib/engine/runtime/world.svelte.ts`     | D4b        |
| `e2e/object-context.spec.ts`                 | D1+        |

---

## Landing order

1. Close **TRL-142**, **TRL-143** (shell grid + rail routing)
2. **D1** → **D2 + D3** (parallel) → **D4a** → **D4b**
3. E2e + close **TRL-145**

---

## Out of scope

- Assets / Graph / Config rail contexts
- Full event DSL editor (collision, input, scripts, arbitrary `if`)
- Keyframe timeline; multi-entity choreography
- Skeleton tree UI; play-mode grid collapse (TRL-146)

---

## Acceptance criteria (TRL-145 close)

1. `test:pnpm check`
2. `test:PW_REUSE=1 pnpm test:e2e e2e/object-context.spec.ts`
3. `test:PW_REUSE=1 pnpm test:e2e e2e/animated-npc-demo.spec.ts`
4. Object context via dblclick + rail; stage renders only `objectTarget` with
   live clip preview
5. Clip library assigns `Mesh3DAnimator.clip` durably
6. Behavior drawer shows guard schedule (D4a); one authoring flow persists alarm
   clip change (D4b)
7. Scene placement + play-mode alarms unchanged

---

## References

- [object_behavior_drawer_design.md](./object_behavior_drawer_design.md) —
  **canonical mock** (adopted from
  [Claude artifact](https://claude.ai/code/artifact/aa0e55c7-353a-4bdc-ab30-c3385913a313))
- [object_behavior_drawer_mockup.html](./object_behavior_drawer_mockup.html)
- [editor_shell_refactor_spec.md](./editor_shell_refactor_spec.md)
- [skinned_mesh_animation_spec.md](./skinned_mesh_animation_spec.md)
- [gamemaker_alarms_spec.md](./gamemaker_alarms_spec.md)
- `static/games/animated-npc-demo.jsonld`
- `src/lib/engine/render/views/SkinnedMeshView.svelte`
- `src/lib/engine/animation/clipCatalog.ts`
- `src/lib/ui/EntityEventsPanel.svelte`
- `src/lib/ui/BottomPane.svelte`
