---
version: 1
name: Editor shell — docked bottom pane
status: draft
labels: spec, ui, shell, bottom-pane, needs-e2e
related: editor_shell_cards_design.md, editor_shell_cards_mockup.html, editor_shell_refactor_spec.md
parent-design: docs/artifacts/editor_shell_cards_design.md
---

# Spec: Docked bottom pane (generic action surface)

**Goal.** Replace the floating `ScenePalette` card with a **grid-docked bottom pane**
that shares the side-panel glass shell, sits flush under the viewport column (no inset /
radius on the outer shell), and is structured as a **route-swappable slot** for future
Behavior content.

**Design refs:**

- [editor_shell_cards_design.md](./editor_shell_cards_design.md)
- [editor_shell_cards_mockup.html](./editor_shell_cards_mockup.html) — **Docked bottom pane** toggle

**Parent epic:** [editor_shell_refactor_spec.md](./editor_shell_refactor_spec.md) Phase C
(layout + palette wiring). Object-route Behavior **content** remains Phase D — this spec
ships shell + Scene palette only.

---

## Architect decisions (design open questions)

| Question | Decision |
| -------- | -------- |
| Side panel row span | **L-frame:** left/right span rows `body` + `bottom`; bottom pane occupies center column row `bottom` only (matches mock). |
| State rename | **Defer** `paletteOpen` → `bottomPaneOpen`. Add `bottomHeight` now; alias in comments. Rename when Behavior lands. |
| Resize handle | **Extend** `PanelResizeHandle` with `axis: 'horizontal' \| 'vertical'` (default horizontal). Bottom pane uses `axis="vertical"` `edge="start"` on top edge. |
| Collapsed height | CSS token `--bottom-pane-collapsed: 36px`. Expanded height from `ui.bottomHeight` (default `168`, min `36`, max `400`). |
| Play mode | Bottom row height → `0`; hide bottom pane (same as sidebars today via `showPanels`). |
| Glass treatment | `glass-panel-shell glass-flush` on bottom shell — **not** `glass-panel`. Same `::before` stack as `.panel-shell`. |

---

## Current state

| Piece | Today |
| ----- | ----- |
| `ScenePalette.svelte` | `position: fixed`, `glass-panel`, `--radius-lg`, dynamic `left/right` insets, rendered **outside** `AppShell` in `WorldShell.svelte` |
| `AppShell.svelte` | 3-column grid, single row; no `bottom` slot |
| `ui.svelte.ts` | `paletteOpen`, `togglePalette()`; no `bottomHeight` |
| `e2e/scene-palette.spec.ts` | Targets `.palette .card`; opens via `ui.togglePalette(true)` |

---

## Target architecture

### Grid (Edit mode, panels visible)

```
grid-template-columns: var(--left-panel-width) minmax(0, 1fr) var(--right-panel-width)
grid-template-rows:    minmax(0, 1fr) var(--bottom-pane-height)
```

| Cell | grid-column | grid-row | Content |
| ---- | ----------- | -------- | ------- |
| Left panel | 1 | 1 / -1 | `leftPanel` snippet (unchanged) |
| Viewport | 2 | 1 | `main` snippet (canvas behind via absolute viewport layer) |
| Right panel | 3 | 1 / -1 | `rightPanel` snippet |
| Bottom pane | 2 | 2 | `bottom` snippet |

`--bottom-pane-height` derived:

```ts
// collapsed handle always visible in edit+scene route
paletteOpen ? `${bottomHeight}px` : 'var(--bottom-pane-collapsed)'
```

When `shellMode === 'play'` or `!sidebarsVisible`: `--bottom-pane-height: 0` (interim —
full grid collapse is Phase E).

### Component split

| File | Responsibility |
| ---- | -------------- |
| `BottomPane.svelte` **(new)** | Flush shell, collapse handle, top resize, `aria-label` per route, renders child snippet |
| `ScenePalette.svelte` | **Content only** — pills, strip, legend, `/` shortcut; no positioning / outer glass |
| `AppShell.svelte` | `bottom` slot; grid row; passes `--bottom-pane-height` via style |
| `WorldShell.svelte` | `{#snippet bottom()}` → `BottomPane` wrapping route content |

### Route wiring (this wedge)

```svelte
{#snippet bottom()}
  <BottomPane label={ui.railRoute === 'object' ? 'Behavior' : 'Palette'} …>
    {#if ui.railRoute === 'scene'}
      <ScenePalette />
    {:else if ui.railRoute === 'object'}
      <BottomPaneStub label="Behavior drawer — Phase D" />
    {/if}
  </BottomPane>
{/snippet}
```

Only render bottom snippet when `shellMode === 'edit'` and `railRoute` is `scene` or
`object`. Other routes: `--bottom-pane-height: 0`.

---

## State (`ui.svelte.ts`)

```ts
bottomHeight = $state(168);

resizeBottomPane(deltaY: number) {
  this.bottomHeight = clamp(this.bottomHeight - deltaY, 36, 400);
}
```

Keep `paletteOpen` / `togglePalette()` — ScenePalette and `/` shortcut unchanged.

Expose on shell style string:

```ts
`--bottom-pane-height: ${computeBottomPaneHeight(ui)}px`
```

---

## `BottomPane.svelte` AC

- Outer class: `bottom-pane panel-shell glass-panel-shell glass-flush`
- `role="region"` + `aria-label` prop (e.g. `"Scene palette"`, `"Object behavior"`)
- Collapse button: `aria-expanded={ui.paletteOpen}`; calls `ui.togglePalette()`
- Top `PanelResizeHandle` when `paletteOpen` (vertical axis)
- **No** `border-radius`, **no** `box-shadow`, **no** `position: fixed`
- `border-top: 1px solid color-mix(in srgb, var(--border) 28%, transparent)` on shell

## `ScenePalette.svelte` AC

- Remove: `svelte:window` positioning styles, `leftInset`/`rightInset`, `glass-panel`, fixed positioning, card shadow/radius on root
- Root becomes content wrapper (e.g. `.palette-body` only, or `.palette-content`)
- Preserve: filter pills, asset cards, drag handlers, `/` keyboard toggle, rigged detection
- Inner asset cards keep `--radius-md`

## `PanelResizeHandle.svelte` AC

- Add optional `axis?: 'horizontal' | 'vertical'` (default `'horizontal'`)
- Vertical: `cursor: ns-resize`, handle spans top edge, `deltaY` passed to `onResize`
- Horizontal behavior unchanged

## `AppShell.svelte` AC

- Add optional `bottom?: Snippet`
- `app-body` grid adds second row when `showPanels && bottom`
- New `.app-bottom-pane` grid cell (column 2, row 2)
- Left/right panels: `grid-row: 1 / -1`
- Style includes `--bottom-pane-height`

## Viewport / chrome insets

- Update `--bottom-chrome-height` in `app.css` to account for docked bottom pane when
  palette open (gizmo / chat FAB clearance). Minimum: `var(--bottom-pane-height)` when
  visible.
- Remove palette-specific fixed inset logic from `ScenePalette`; grid owns width.

---

## Accessibility

- Bottom region: `role="region"` + route-specific `aria-label`
- Handle: `aria-expanded` tied to `paletteOpen`
- Resize: `aria-label="Resize bottom pane"`
- `prefers-reduced-motion`: no new transitions required this wedge

---

## Tests

| Command | Purpose |
| ------- | ------- |
| `pnpm check` | types + lint |
| `pnpm test:e2e e2e/scene-palette.spec.ts` | palette open, cards, drag — update selectors if root class changes |
| `pnpm test:e2e e2e/workbench-ui.spec.ts` | shell regression |
| `pnpm test:e2e e2e/smoke-world-shell.spec.ts` | smoke |

**E2e selector migration:** prefer `getByRole('region', { name: 'Scene palette' })` over
`.palette` fixed-position assumptions. Cards may stay `.card` inside content.

---

## Acceptance criteria (Executor)

1. **Layout:** In Edit mode with sidebars visible, bottom pane renders in grid row under
   viewport column, flush with inner edges of left/right panels (no horizontal gap, no
   outer border-radius).

2. **Glass parity:** Bottom shell uses `glass-panel-shell` + `glass-flush`; visually
   matches left/right panel background (no `glass-panel` card shadow on bottom).

3. **Palette behavior unchanged:** `/` toggles expand/collapse; expanded shows filter
   pills + draggable asset cards; rigged GLB → Character badge; drag arms placement.

4. **Resize:** Dragging top edge of expanded bottom pane changes `ui.bottomHeight`
   (clamped 36–400).

5. **Route stub:** `railRoute === 'object'` shows bottom pane with "Behavior" handle +
   placeholder body (no clip editor yet).

6. **Play mode:** Bottom pane not visible in Play (`--bottom-pane-height: 0` or not
   rendered).

7. **No floating palette:** `ScenePalette` has no `position: fixed` and no
   `bottom/left/right` inset styles.

8. **Tests green:** `pnpm check` + listed e2e specs pass.

---

## Out of scope

- Full editor grid refactor (rail column, viewport recess) — Phase A/B
- Behavior drawer content (clips, event lanes) — [object_context_spec.md](./object_context_spec.md)
- Play-mode grid collapse animation — Phase E
- Renaming `paletteOpen` → `bottomPaneOpen`
- Mobile bottom sheet

---

## Risks

- **Canvas resize** when bottom row height changes — verify Threlte canvas reflows without
  camera jump.
- **E2e selectors** tied to `.palette` fixed layout — update in same PR.
- **Chat FAB / gizmo** overlap — confirm `--bottom-chrome-height` updated.

---

## File checklist

| File | Action |
| ---- | ------ |
| `src/lib/ui/BottomPane.svelte` | create |
| `src/lib/ui/AppShell.svelte` | add `bottom` slot + grid row |
| `src/lib/ui/ScenePalette.svelte` | strip shell/positioning |
| `src/lib/ui/WorldShell.svelte` | move palette into `bottom` snippet |
| `src/lib/ui/PanelResizeHandle.svelte` | vertical axis |
| `src/lib/ui/ui.svelte.ts` | `bottomHeight`, `resizeBottomPane` |
| `src/app.css` | `--bottom-pane-collapsed`, `--bottom-chrome-height` |
| `e2e/scene-palette.spec.ts` | region selector if needed |
