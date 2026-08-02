---
version: 1
name: Objects bottom pane layout + chrome overlap
status: draft
labels: spec, ui, shell, needs-e2e
parent: TRL-173
parent-design: docs/artifacts/objects_bottom_pane_layout_design.md
parent-mock: docs/artifacts/objects_bottom_pane_layout_mockup.html
related: TRL-159, TRL-142
---

# Spec: Objects bottom pane layout + chrome overlap (TRL-173)

**Goal.** Fix Objects-route bottom shelf clipping under side panels; redesign
the type-authoring bottom pane into four top-tabbed views with Animations
category rail, inspector field language on composers, and taller default height.

**Design refs:**

- [objects_bottom_pane_layout_design.md](./objects_bottom_pane_layout_design.md)
- [objects_bottom_pane_layout_mockup.html](./objects_bottom_pane_layout_mockup.html)

**Out of scope:** `object` route `ObjectBehaviorDrawer`, rail position settings
UI, TRL-142 grid refactor, animejs dirty-dot polish on composers.

---

## Architect decisions

| Question                   | Decision                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab union                  | `ObjectsBottomTab = 'behaviors' \| 'schedule' \| 'clip' \| 'animations'`                                                                                                           |
| Default tab on type select | `behaviors` (unchanged default)                                                                                                                                                    |
| Component split            | Extract three panel bodies from `TypeEventsEditor`; keep shared event helpers in module or parent                                                                                  |
| Clip vs Animations         | **Clip** = `addClipOnCreate` form + read-only clip-assignment summary (no catalog grid). **Animations** = catalog browse + playback only                                           |
| Bottom pane flex           | `BottomPane.svelte`: `flex-direction: column` (tabs top); tabs only when `tabs` prop provided                                                                                      |
| Z-index                    | `.app-bottom-pane.full-width { z-index: 18 }` in `AppShell.svelte`                                                                                                                 |
| Gap above shelf            | `.app-bottom-pane` gets `padding-top: var(--chrome-float-gap)` on objects full-width route (or equivalent margin on stack)                                                         |
| Default height             | `ui.bottomHeight` default `320`; auto-bump on Animations tab when `< 320`                                                                                                          |
| Category rail width        | CSS `width: var(--left-panel-width)` — value already set on `.app-shell` style                                                                                                     |
| Field migration            | `add-action` + `add-clip` forms only → `field-row` / `field-well` pattern from `app.css`                                                                                           |
| Nested tablists            | Category rail: `role="tablist"` vertical; pane tabs: horizontal. Roving tabindex on both when focused; no arrow-key library required v1 if native buttons + focus order documented |
| Coordination               | Single lane; touch `AppShell` minimally (z-index + gap). Do not block on TRL-142                                                                                                   |

---

## File map

| File                                    | Action                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/ui/AppShell.svelte`            | z-index 18 for `.full-width`; optional `padding-top` gap on bottom stack |
| `src/lib/ui/BottomPane.svelte`          | column layout; tab strip above body; resize handle above tabs when open  |
| `src/lib/ui/ui.svelte.ts`               | extend `ObjectsBottomTab`; `bottomHeight` default 320                    |
| `src/lib/ui/WorldShell.svelte`          | 4 tabs in `BottomPane`; tab change bump height for animations            |
| `src/lib/ui/ObjectsBottomDrawer.svelte` | route 4 tab bodies                                                       |
| `src/lib/ui/TypeBehaviorsPanel.svelte`  | **new** — event cards + add-action                                       |
| `src/lib/ui/TypeSchedulePanel.svelte`   | **new** — schedule strip + alarm lanes                                   |
| `src/lib/ui/TypeClipPanel.svelte`       | **new** — add-clip form + summary                                        |
| `src/lib/ui/TypeAnimationsPanel.svelte` | refactor — vertical category rail, title row + search                    |
| `src/lib/ui/TypeEventsEditor.svelte`    | thin re-export or delete after split (prefer thin wrapper flagged on)    |
| `e2e/objects-animations-tab.spec.ts`    | 4 tabs, category rail, search in title row                               |
| `e2e/helpers.ts`                        | update if tab helpers assume 2 tabs                                      |

---

## `AppShell.svelte`

```css
.app-bottom-pane.full-width {
   z-index: 18;
   padding-top: var(--chrome-float-gap);
}
```

Panels remain `z-index: 15`. Verify doc-bar (30) and rail (28) unchanged.

**Rail bottom position:** existing `.rail-position-bottom` rules must not
regress tab clickability; manual check both positions.

---

## `BottomPane.svelte`

| Before                           | After                                     |
| -------------------------------- | ----------------------------------------- |
| `flex-direction: column-reverse` | `flex-direction: column`                  |
| Tabs in handle at bottom         | Tab strip first child below resize handle |
| Body scroll region               | `.bottom-pane-body` below tab strip       |

Collapsed: chevron + tabs still visible in 48px shelf (tabs may truncate with
overflow hidden — acceptable v1).

---

## Tab bodies

### Behaviors (`TypeBehaviorsPanel`)

- Lede copy (optional shorten)
- `event-groups` cards for create/step/destroy (lift from `TypeEventsEditor`)
- `add-action` form with `field-row` / `field-well`
- **Exclude:** schedule strip, alarm lanes, `add-clip`

### Schedule (`TypeSchedulePanel`)

- `BehaviorScheduleStrip`
- `BehaviorAlarmLane` list
- Empty state when no alarms: "No alarm lanes yet."

### Clip (`TypeClipPanel`)

- `add-clip` form (`field-row` / `field-well`)
- Summary of clip-related actions from events (read-only list or single
  paragraph)
- **No** `clip-grid` / catalog cards

### Animations (`TypeAnimationsPanel`)

Layout:

```
┌─ cat-rail (width: var(--left-panel-width)) ─┬─ anim-main ─────────────┐
│ vertical category buttons                    │ title row + search      │
│                                              │ clip-grid               │
└──────────────────────────────────────────────┴─────────────────────────┘
```

- Remove horizontal `.cats` pill row
- Search: `type="search"`, in title row, `max-width: 48rem`, `margin-left: auto`
- Category filter logic unchanged (`category` state)

---

## State (`ui.svelte.ts`)

```ts
export type ObjectsBottomTab = "behaviors" | "schedule" | "clip" | "animations";
bottomHeight = $state(320);
```

`objectsPlaybackBarHeight` rule unchanged (`animations` tab only).

---

## Accessibility

- Pane tabs: `role="tablist"` / `role="tab"` / `aria-selected`
- Tab panels: `role="tabpanel"` + `aria-labelledby`
- Category rail: `role="tablist"` `aria-label="Animation categories"`
- Search: `aria-label="Filter animations"`
- Focus order per design doc §Accessibility

---

## Tests

| Command                                            | Purpose                    |
| -------------------------------------------------- | -------------------------- |
| `pnpm check`                                       | types                      |
| `pnpm test:e2e e2e/objects-animations-tab.spec.ts` | 4-tab shelf + animations   |
| `pnpm test:e2e e2e/workbench-ui.spec.ts`           | shell regression (if time) |

### E2e updates (`objects-animations-tab.spec.ts`)

1. Assert tabs: Behaviors, Schedule, Clip, Animations (all visible)
2. Animations tab: `getByRole('tablist', { name: 'Animation categories' })`
3. Search: `getByRole('searchbox', { name: 'Filter animations' })` visible in
   drawer
4. Playback bar + clip grid behavior unchanged
5. Optional: click Schedule tab → schedule strip or empty state visible

---

## Acceptance criteria

```text
test:pnpm check
test:pnpm test:e2e e2e/objects-animations-tab.spec.ts
```

1. **Z-index:** On Objects route with bottom pane open, bottom shelf tab strip
   is not obscured by left/right panel glass at the L-corner (full-width mode).

2. **Gap:** Visible `--chrome-float-gap` between viewport content and bottom
   chrome stack on Objects route.

3. **Four tabs:** Bottom pane shows Behaviors, Schedule, Clip, Animations at the
   **top** of the pane shell; switching tabs swaps body without URL change.

4. **Behaviors:** Create/Step/Destroy event cards and add-action composer only;
   no schedule strip or clip form on this tab.

5. **Schedule:** `BehaviorScheduleStrip` and alarm lanes on Schedule tab only.

6. **Clip:** Clip-on-create form on Clip tab only; no animation catalog grid on
   Clip tab.

7. **Animations:** Vertical category rail width matches left panel width; search
   on same row as type title, right-aligned, max-width 48rem; horizontal
   category pills removed.

8. **Default height:** `ui.bottomHeight` defaults to 320px; opening Animations
   tab bumps height to at least 320 when lower.

9. **Field language:** add-action and add-clip forms use `.field-row` and
   `.field-well` (or shared inspector field components).

10. **Playback:** `ObjectsPlaybackBar` visible only on Animations tab when pane
    open and type selected.

11. **Object route:** `object` route bottom pane unchanged (no 4-tab strip).

12. **E2e:** `objects-animations-tab.spec.ts` passes with updated assertions.

---

## Risks

- Splitting `TypeEventsEditor` may duplicate derived state — extract shared
  `$derived` helpers to `.svelte.ts` module if needed.
- `column` flip may affect `object` route BottomPane without tabs — verify
  title-only handle still works.
- TRL-142 parallel edits to `AppShell` — reconcile if conflict.

---

## File checklist

See File map above. Prefer extend TRL-159 lane if open; else new impl child
under this spec.
