# Spec — Fold Objects bottom pane into the right inspector

**Status:** ready to implement · **Date:** 2026-07-09 · **Route scope:** `objects` (type authoring) only — the singular `object` editor route is untouched.

## Goal

Retire the bottom pane on the **Objects** route. Move its three tabs (**Behaviors / Schedule / Clip**) into the right inspector alongside the existing type editor, so a type's *data* and its *logic* live in one place. Reclaims viewport height and deletes a chrome subsystem on this route.

### Why now
The bottom pane earned horizontal space when it held the **Animations** clip grid. That moved to the assets route. What remains is narrow, vertical form/list content — right-rail shaped. On the Objects route the right inspector is already scoped to the selected type, and Behaviors/Schedule/Clip are also per-type, so the semantics line up.

## Chosen design — flat 4-tab inspector

One tab row at the top of the Objects-route right panel:

```
┌─ CharacterFemale ──────────── custom ─┐
│ Properties │ Behaviors │ Schedule │ Clip │   ← single tab row
├───────────────────────────────────────┤
│ (active tab body — scrolls on its own) │
└───────────────────────────────────────┘
```

- **Properties** — the existing `ObjectTypeEditor` component/field surface (Transform, SkinnedMesh, …, Add capability / Add field). Default tab.
- **Behaviors / Schedule / Clip** — the existing `TypeBehaviorsPanel` / `TypeSchedulePanel` / `TypeClipPanel` bodies, unchanged.

**Why flat, not nested (`Properties | Logic ▸ sub-tabs`):** two tab levels in a ~320px rail is clunky, and there are only three logic tabs. Flat keeps one interaction level. If "Logic" later grows past ~4 items, revisit nesting then. (Naming is a bikeshed — "Properties" vs "Definition" vs "Schema"; pick at build time.)

## File-by-file changes

### 1. New host: `src/lib/ui/ObjectInspectorPanel.svelte`
Wrapper that owns the tab row and switches bodies. Mirror the tab pattern already in [AssetInspectorPanel.svelte](../../src/lib/ui/AssetInspectorPanel.svelte) (role=tablist, `aria-selected`, `hidden` on inactive panels, roving `tabindex`).

- Header: type name + built-in/custom badge (lift from `ObjectTypeEditor`'s current header, or keep the header inside `ObjectTypeEditor` and render this wrapper's tab row below it — decide during build; simpler to keep the header in the Properties body and give the wrapper just the tab row + bodies).
- Tabs: `Properties | Behaviors | Schedule | Clip`, gated so the logic tabs render only when a type is selected.
- Bodies (each a `role="tabpanel"`, `flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain`):
  - `properties` → `<ObjectTypeEditor />`
  - `behaviors` → `<TypeBehaviorsPanel {typeName} {readonly} />`
  - `schedule` → `<TypeSchedulePanel {typeName} {readonly} />`
  - `clip` → `<TypeClipPanel {typeName} {readonly} />`
- `typeName = ui.selectedObjectType`; `readonly = typeName ? !isEditableObjectType(typeName) : true` (copy from the now-deleted [ObjectsBottomDrawer.svelte](../../src/lib/ui/ObjectsBottomDrawer.svelte)).
- Empty state when `!typeName`: reuse `ObjectTypeEditor`'s existing empty state, or a short "Select an object type" message. The logic tabs should be hidden (not just disabled) when no type is selected.

### 2. `src/lib/ui/ui.svelte.ts`
- Rename `objectsBottomTab` → **`objectInspectorTab`** and widen the type:
  ```ts
  export type ObjectInspectorTab = 'properties' | 'behaviors' | 'schedule' | 'clip';
  objectInspectorTab = $state<ObjectInspectorTab>('properties');
  ```
- Grep every `objectsBottomTab` reference and repoint. Known consumers: `viewportProjectionAlign.svelte.ts:25` (`void ui.objectsBottomTab` — just a reactivity poke; update the name).
- **Delete** the `bottomChromeHeight` contribution path for objects if the bottom pane is gone route-wide (see §4). `bottomPaneHeight`/`bottomChromeHeight` still exist for the `object` singular route, so keep the getters; they'll simply return 0 on `objects`.
- Leave `bottomPaneOpen` and `toggleBottomPane` as-is (still used by `object` singular route).

### 3. `src/lib/ui/WorldShell.svelte`
- **Right snippet** (~line 351): replace `{:else if ui.railRoute === 'objects'}` → `<ObjectTypeEditor />` with `<ObjectInspectorPanel />`.
- **Bottom snippet** (~line 370): delete the entire `{:else if ui.railRoute === 'objects'}` `BottomPane`/`ObjectsBottomDrawer` block. Keep the `object` singular branch above it.
- Remove now-unused imports: `ObjectsBottomDrawer`, and `BottomPane`/`ObjectTypeEditor` only if no longer referenced (ObjectTypeEditor is still used inside the new wrapper, so it moves out of WorldShell's imports).
- `bottomPaneFullWidth={ui.railRoute === 'objects'}` (~line 278) and the `railRoute === 'objects'` clauses in the layout guards (~266, ~317, ~328): audit each. The full-width bottom treatment was for the objects shelf — with the shelf gone, drop `objects` from those conditions so the objects route no longer reserves/participates in bottom chrome.

### 4. `src/lib/ui/AppShell.svelte`
- No structural change required if `bottomPaneHeight` returns 0 on the objects route (it will, once WorldShell stops passing a `bottom` snippet for objects — `showPanels && !!bottom` guards it). Verify `showBottom` is false on objects after §3. Nothing to reserve, so viewport height reclaims automatically.

### 5. `src/lib/ui/shellKeyboard.ts`
- `'/'` handler (~line 287) currently toggles the bottom pane on `object` **and** `objects`. Remove `objects` from that condition (no bottom pane there anymore). Optional nicety: repoint `'/'` on the objects route to cycle/focus the inspector tabs — **out of scope for v1**, note it.
- Escape-collapses-bottom-pane branch (~line 209, `railRoute === 'objects' && bottomPaneOpen`): remove the `objects` case.

### 6. Delete
- `src/lib/ui/ObjectsBottomDrawer.svelte` (logic absorbed into the new wrapper).
- Any residual `objects-drawer` global CSS in AppShell (already cleaned for the playback bar; double-check).

### 7. `ObjectTypeEditor.svelte`
- No functional change. It becomes the **Properties** tab body. If its header (type name + badge) is duplicated by the new wrapper header, remove one — prefer keeping the header in `ObjectTypeEditor` and giving the wrapper only the tab row, so `ObjectTypeEditor` stays self-contained. Confirm it already sizes to `height:100%; min-height:0` inside a flex parent (it renders as an `<aside class="object-type-editor">` today — may need `flex:1; min-height:0` when nested in a tab panel).

## Behavior / edge cases

- **Default tab:** `properties`. Selecting a different type does **not** reset the tab (keep last-used) — unless the current tab is a logic tab and the new type is built-in/readonly; readonly logic panels already render read-only, so no reset needed.
- **Built-in types (readonly):** logic tabs still show, panels render read-only (existing `readonly` prop behavior). Properties tab already handles readonly.
- **No type selected:** show only the Properties tab (empty state); hide logic tabs.
- **Vertical budget:** Behaviors + event lanes can be tall. Each tab body scrolls independently (`overflow-y:auto`) and competes with nothing else — that's the win over the old resizable shelf. No height persistence needed.
- **`object` singular route:** completely unaffected — still uses `BottomPane` + `ObjectBehaviorDrawer`.

## Out of scope (v1)
- Rooms-route right inspector (`entityInspectorTab: properties|ops|json`) — do **not** touch; this change is Objects-route only.
- Nested "Logic" grouping, `'/'`-to-focus-tabs, drag-resize of the inspector, moving Animations back anywhere.

## Verification
- `pnpm check` clean (watch for stale `objectsBottomTab` refs).
- Objects route: right inspector shows `Properties | Behaviors | Schedule | Clip`; no bottom shelf; viewport taller than before.
- Each logic tab renders its panel and scrolls; Properties tab unchanged (Add capability / Add field still work).
- Built-in type (e.g. `Player`) → logic tabs read-only; custom type (`CharacterFemale`) → editable.
- `object` singular route still shows its bottom Behavior drawer.
- Regression: [e2e/object-type-events.spec.ts](../../e2e/object-type-events.spec.ts) — **will break.** It drives `openObjectTypeBehaviorPane` via the bottom drawer (`region "Object type drawer"` → `tab "Behaviors"`). Update the helper to open the Behaviors **inspector tab** in the right panel instead. Budget time for this; it's the main test churn.

## Rough sequencing (tomorrow)
1. `ui.svelte.ts` rename + type widen (compile errors guide the rest).
2. New `ObjectInspectorPanel.svelte` (tab row + 4 bodies).
3. WorldShell: swap right snippet, delete objects bottom snippet + guards.
4. Delete `ObjectsBottomDrawer.svelte`; fix shellKeyboard.
5. `pnpm check` → fix stragglers.
6. Update `object-type-events` e2e helper.
7. Browser-verify the checklist above.
