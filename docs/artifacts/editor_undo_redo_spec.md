---
version: 1
name: Editor undo/redo
parent: TRL-undo
status: queue-ready
labels: spec, needs-e2e
---

# Spec: Editor undo/redo (v1)

**Parent:** TRL-undo (Proposal — strategist scope, Jul 2026)  
**Pathway:** A — local command stack, coalesced gizmo, keyboard shortcuts

---

## Summary

Authors in **edit mode** can reverse and replay authoring mutations with **⌘Z / Ctrl+Z** and **⌘⇧Z / Ctrl+Shift+Z**. A local command stack records inverse patches at the world authoring boundary. Gizmo drags collapse to **one** undo step. Play mode, remote sync, and `defineType` are out of scope for v1.

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Stack model | **Local command stack** (`undo[]` / `redo[]`) | Trellis op-log is append-only audit; reversing server history is v2+ |
| Patch shape | **`HistoryStep`** with `undo` + `redo` patch arrays | Compound ops (cut, multi-field transaction) are one stack entry |
| History-only patch kinds | **`spawnEntity` / `despawnEntity`** (not `DurablePatch`) | Spawn/despawn bypass Trellis today; never broadcast these kinds |
| Integration point | **`world.authoringMutation()`** wrapper | Single gate before `#broadcastDurablePatch` / `#persistToStore` |
| Recording guards | Skip when `applyingRemoteDurable`, `applyingRemoteAuthoring`, `editHistory.applying`, `ui.shellMode === 'play'` | Remote + play must not pollute stack |
| Gizmo coalescing | **Transaction** `begin` on mousedown · `commit` on mouseup | Matches scale commit pattern; avoids per-frame undo |
| Inspector fields | **Debounce coalesce** 400 ms per `(entityId, component, field)` | Sliders fire continuous `setField`; collapse to one step |
| Arrow-key nudge | **Outside undo** in v1 | `shellKeyboard.nudgeSelectedPosition` stays direct `setField` — document as known gap |
| Multiplayer undo | **Local stack only** | Each client undoes their own recorded edits; remote patches do not push/pop stack |
| `defineType` | **Out of scope v1** | Hard to invert; rare; follow-up wedge |
| Scene settings | **Out of scope v1** | Separate store (`sceneSettings`) |
| UI chrome | **Shortcuts only v1** | DocBar buttons → cohesion follow-up |
| Stack cap | **100 entries** | Drop oldest on overflow |
| Selection on undo | **Restore** `selection` captured in step meta when entity still exists | Delete undo selects resurrected entity |
| Redo branch | **Clear redo** on any new recorded edit | Standard editor semantics |

---

## Data model

**New:** `src/lib/engine/authoring/editHistory.svelte.ts`

```ts
export type HistoryPatch =
  | DurablePatch
  | { kind: 'spawnEntity'; entity: EntitySnapshot }
  | { kind: 'despawnEntity'; entityId: string };

export type EntitySnapshot = {
  id: string;
  type?: string;
  components: Record<string, ComponentData>;
  formulas?: Entity['formulas'];
};

export type HistoryStep = {
  id: string;
  label: string;
  undo: HistoryPatch[];
  redo: HistoryPatch[];
  selection?: string | null;
};

export type HistoryMeta = {
  label?: string;
  selection?: string | null;
};
```

**Store API:**

| Method | Behavior |
| ------ | -------- |
| `canUndo` / `canRedo` | Derived booleans |
| `beginTransaction(label)` | Open transaction; nested calls no-op deeper nesting |
| `commitTransaction(meta?)` | Push accumulated step; clear redo |
| `cancelTransaction()` | Discard open transaction |
| `recordStep(undo, redo, meta?)` | Push immediately (used by debounce flush) |
| `undo()` | Pop undo → apply `undo` patches with `applying=true` → push to redo |
| `redo()` | Pop redo → apply `redo` patches with `applying=true` → push to undo |
| `clear()` | On world reload / `setReady` |

**Snapshot helper** — reuse clipboard pattern:

```ts
// src/lib/engine/authoring/entitySnapshot.ts
export function captureEntitySnapshot(entity: Entity): EntitySnapshot
export function entityFromSnapshot(snap: EntitySnapshot): Entity
```

Clone `components` with `structuredClone` or `$state.snapshot`; retain `formulas` reference (same as play snapshot).

---

## Apply path

**New:** `src/lib/engine/authoring/applyHistoryPatch.ts`

| `HistoryPatch` kind | Apply |
| ------------------- | ----- |
| `DurablePatch` | `applyDurableMutation(patch)` (existing) |
| `spawnEntity` | `world.spawn(entityFromSnapshot(...))` + `bootstrapFormulas()` |
| `despawnEntity` | `world.despawn(entityId)`; clear selection if needed |

**Inverse capture** — `src/lib/engine/authoring/captureBefore.ts`:

| Forward mutation | `undo` patch(es) | `redo` patch(es) |
| ---------------- | ---------------- | ---------------- |
| `setField` | `setField` with **before** value | forward patch |
| `setComponent` | `removeComponent` if new, else `setComponent` with before bag | forward |
| `removeComponent` | `setComponent` with before bag (+ formulas) | forward |
| `setEntity` | `setEntity` with before components/conformsTo | forward |
| spawn (paste, spawnFromType, createProp) | `despawnEntity` | `spawnEntity` snapshot |
| despawn (delete, cut) | `spawnEntity` snapshot | `despawnEntity` |

`captureBefore` reads live entity state **before** mutation.

---

## World integration

**Modify:** `src/lib/engine/runtime/world.svelte.ts`

Add private gate used by all authoring mutations:

```ts
#authoringEdit(
  redo: HistoryPatch[],
  undo: HistoryPatch[],
  apply: () => void,
  meta?: HistoryMeta
): void
```

Flow:
1. If `editHistory.shouldRecord()` → after `apply()`, `editHistory.recordStep(undo, redo, meta)` OR append to open transaction
2. Else → `apply()` only

**Wire these methods** through `#authoringEdit`:

| Method | Notes |
| ------ | ----- |
| `setField` | Capture before value; debounce coalesce |
| `addComponent` | Capture absent/prior bag |
| `removeComponent` | Capture full prior bag |
| `applyEntityJson` | Capture prior `setEntity` shape |
| `pasteClipboard` / `spawnFromType` / `createProp` | `spawnEntity` snapshot |
| `deleteSelection` / `cutSelection` | `spawnEntity` snapshot before despawn |
| `duplicateSelection` | Treat as paste (one step) |

**Do not record:** `applyFieldLocal` alone, remote apply paths, play runtime spawn/despawn, `saveAsType` (`defineType`).

### Debounce coalesce (`setField`)

In `editHistory` or world gate:

- Key: `${entityId}:${component}:${field}`
- If a pending debounced step exists for key within 400 ms window, **replace** its `redo` tail with latest forward patch (keep original `undo` before-value)
- Flush on timeout → `recordStep`
- **Transactions suppress debounce** — only commit on `commitTransaction`

---

## Gizmo transaction

**Modify:** `src/lib/scene/EntityTransformControls.svelte`

```ts
onmouseDown → editHistory.beginTransaction('transform')
onmouseUp   → editHistory.commitTransaction({ selection: entity.id })
```

During drag, `setField` calls append to transaction (single undo step with first-before / last-after for each touched field).

---

## Keyboard + shortcuts

**Modify:** `src/lib/engine/input/shortcutBinding.ts`

```ts
export type ShortcutAction = ... | 'undo' | 'redo';

STUDIO_SHORTCUTS / BLENDER_SHORTCUTS:
  undo: [{ key: 'z', mod: true }]
  redo: [{ key: 'z', mod: true, shift: true }]
```

**Modify:** `src/lib/ui/shellKeyboard.ts` — in `handleShellKeydown`, before clipboard handlers:

- `eventMatchesAction(event, 'undo')` → `editHistory.undo()` if `ui.shellMode === 'edit'` && !`isFormFieldFocused()`
- `eventMatchesAction(event, 'redo')` → `editHistory.redo()` same guards

**Modify:** `src/lib/ui/InputShortcutsSection.svelte` — list undo/redo labels.

---

## World lifecycle

**Modify:** `world.setReady()` → `editHistory.clear()` so reload does not leave stale stack.

---

## Non-goals (v1)

- DocBar undo/redo buttons (disabled/enabled state)
- Multiplayer shared undo / host-only undo
- Trellis op-log walk-back
- `defineType` undo
- `sceneSettings` undo
- Arrow-key position nudge undo
- Ops panel "revert this op" click

---

## Files

| File | Change |
| ---- | ------ |
| `src/lib/engine/authoring/editHistory.svelte.ts` | **New** — stack, transactions, debounce |
| `src/lib/engine/authoring/entitySnapshot.ts` | **New** — capture / restore |
| `src/lib/engine/authoring/applyHistoryPatch.ts` | **New** — unified apply |
| `src/lib/engine/authoring/captureBefore.ts` | **New** — inverse patch builders |
| `src/lib/engine/runtime/world.svelte.ts` | `#authoringEdit` gate; wire mutations |
| `src/lib/scene/EntityTransformControls.svelte` | Transaction begin/commit |
| `src/lib/engine/input/shortcutBinding.ts` | `undo` / `redo` actions |
| `src/lib/ui/shellKeyboard.ts` | Wire shortcuts |
| `src/lib/ui/InputShortcutsSection.svelte` | Display bindings |
| `e2e/undo-redo.spec.ts` | **New** |
| `e2e/helpers.ts` | Optional helper: `undo(page)` / `redo(page)` |

---

## Acceptance criteria

1. **Gizmo:** Select default-world prop → drag translate → ⌘Z restores prior position (one step).
2. **Inspector:** Change `Render.color` → ⌘Z restores prior color.
3. **Delete:** Delete entity → ⌘Z resurrects same `@id` and components.
4. **Paste:** Paste clipboard entity → ⌘Z removes pasted instance.
5. **Redo:** After undo → ⌘⇧Z reapplies.
6. **Branch clear:** Undo → new edit → ⌘⇧Z no-op (`canRedo === false`).
7. **Play guard:** In play mode ⌘Z does nothing.
8. **Remote guard:** Applying remote durable patch does not change `canUndo`.
9. `pnpm check` passes.
10. `PW_REUSE=1 pnpm test:e2e e2e/undo-redo.spec.ts` passes.

### E2E sketch (`e2e/undo-redo.spec.ts`)

- Load `/` default world, edit mode
- Select `crate-b`, change color via inspector (or use known field)
- `Meta+Z` / `Control+Z` → assert prior value
- `Meta+Shift+Z` → assert new value
- Delete entity → undo → treeitem visible again

Use `primeCollabStorage` + `waitForWorldReady` from `./helpers`.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/undo-redo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| v1.1 | Arrow-key nudge + inspector slider coalesce polish |
| v2 | DocBar undo/redo with `canUndo`/`canRedo` derived state |
| v3 | `defineType` undo |
| v4 | Multiplayer undo policy (host vs per-owner) |
