# Spec: Selection bar chrome + inspector accordion polish

**Issue:** TRL-192\
**Parent design:** TRL-191\
**Proposal:** TRL-190\
**Design:**
[selection_bar_inspector_polish_design.md](./selection_bar_inspector_polish_design.md)\
**Mock:**
[selection_bar_inspector_polish_mockup.html](./selection_bar_inspector_polish_mockup.html)

## Goal

Make the Rooms edit selection bar a **pane-peer** chrome strip (full main-inset
width, panel glass recipe), restore transform kbds, paint Destroy destructive
when enabled, place open-type as `ExternalLink` beside the title, and strengthen
inspector accordion hierarchy without nested Look & Shaders sections.

## Non-goals

- New transform modes / cut action
- Changing which fields live under Look & Shaders
- Splitting Look & Shaders into multiple top-level accordion items

## File map

| File                                                     | Change                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/ui/ViewportSelectionBar.svelte`                 | Geometry + class stack                                          |
| `src/lib/ui/TransformToolbar.svelte`                     | Float always shows `<Kbd>`                                      |
| `src/lib/ui/EntityEditActions.svelte`                    | Destroy color at rest / disabled                                |
| `src/lib/ui/RightPanel.svelte`                           | `ExternalLinkIcon`; title → link → badge                        |
| `src/lib/ui/SceneInspector.svelte`                       | Trigger weight 700; sticky panel wash; body indent `spacing-md` |
| `src/lib/ui/InspectorAccordion.svelte` and/or shared CSS | Match trigger/body hierarchy for entity inspectors              |
| `src/lib/ui/scene/ShadersSceneFields.svelte`             | Quieter `.group-label` if needed                                |
| `e2e/viewport-selection-bar.spec.ts`                     | Kbd, destroy color, open-type, inset span smoke                 |

## Behavior

### Selection bar

```css
.viewport-selection-bar {
  position: absolute;
  top: calc(var(--chrome-top-outer) + var(--chrome-inner-gap));
  left: var(--main-inset-left);
  right: var(--main-inset-right);
  z-index: 12;
  pointer-events: none;
}
.selection-bar-card {
  pointer-events: auto;
  width: 100%;
  /* classes: chrome-float-card glass-panel-shell chrome-opacity-panel */
}
```

- **Forbidden:** `--chrome-pill-bg`, `--rounded-pill` on the bar shell.
- Inner: transform left, actions right, divider when both present.
- Visibility unchanged (rooms edit + selection or clipboard); hide &lt;768px.

### Transform float

Always render `<Kbd>` for Move/Rotate/Scale in float variant (same as panel).

### Destroy

- Enabled: `color: var(--destructive)` at rest (not hover-only).
- Disabled: muted destructive (not full red); `disabled` attribute.

### Open type

- Icon: lucide `external-link`, 26×26 (`icon-sm`).
- Order: `.header-title` → open button → id `Badge`.
- Omit when `!getType(type)`.

### Accordion / Look & Shaders

- Keep `Accordion.Item value="look-shaders"` as the only Look & Shaders section.
- No nested `Accordion.Root` inside `ShadersSceneFields`.
- Shared trigger CSS: `font-weight: 700`; `position: sticky; top: 0`; sticky
  background = panel 30% wash
  (`color-mix(in srgb, var(--card) var(--chrome-fill-panel), transparent)`), not
  opaque `--background` and not 80% `--surface-glass-panel`.
- `.inspector-content` / accordion body: `padding-left: var(--spacing-md)`.
- `.group-label`: quieter than triggers (lower contrast / weight 500).

## Acceptance criteria

```
test:pnpm check
test:VITE_PORT=4000 PW_REUSE=1 pnpm test:e2e e2e/viewport-selection-bar.spec.ts
Selection bar spans main-inset-left to main-inset-right with chrome-float-card glass-panel-shell chrome-opacity-panel (not pill tokens)
Float TransformToolbar always shows Move/Rotate/Scale kbd indicators
Destroy control uses --destructive when enabled; muted when disabled
Open-type uses ExternalLink icon immediately beside title before id badge
Look & Shaders remains one top-level accordion; no nested Accordion.Root
Inspector accordion triggers sticky with panel-tier sticky bg; body indented spacing-md; trigger weight 700
```

## E2E notes

Extend `e2e/viewport-selection-bar.spec.ts`:

1. After selecting a transformable entity, assert transform toolbar contains kbd
   text (e.g. `/M|R|S/`).
2. Assert Destroy button computed color matches destructive when enabled.
3. Assert open-type control is before the id badge in DOM order / accessible
   name still `Open Prop in Objects`.
4. Optional smoke: selection-bar card `getBoundingClientRect()` left/right
   within ~2px of main inset edges (via evaluated CSS vars) — skip if flaky;
   class presence (`chrome-opacity-panel`) is minimum.
