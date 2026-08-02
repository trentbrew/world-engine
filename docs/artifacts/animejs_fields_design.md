---
version: alpha
name: Anime.js Field Language
description: Design artifact — dense monospace inspector fields with warm accent, adapted from anime.js config GUI for right pane and shared form primitives
source:
  tool: human
  url: https://animejs.com
  mock: docs/artifacts/animejs_fields_mockup.html
colors:
  viewport: "#0a0a0a"
  viewport-grid: "#161616"
  surface-glass: "color-mix(in srgb, #1c1c1c 22%, transparent)"
  field-well: "#141414"
  field-well-hover: "#181818"
  field-well-active: "#1c1c1a"
  text: "#e8e6e0"
  text-muted: "#6f6f6f"
  text-dim: "#4a4a4a"
  accent-field: "#c9a227"
  accent-field-dim: "color-mix(in srgb, #c9a227 35%, transparent)"
  accent-field-glow: "color-mix(in srgb, #c9a227 18%, transparent)"
  border: "#2a2a2a"
  border-subtle: "#1f1f1f"
  border-focus: "color-mix(in srgb, #c9a227 55%, #2a2a2a)"
  destructive: "#e85d4c"
  success: "#7dba6a"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    letterSpacing: 0.01em
    textTransform: lowercase
  value:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1
  section:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.06em
    textTransform: uppercase
rounded:
  none: 0px
  sm: 3px
  md: 6px
spacing:
  xs: 2px
  sm: 6px
  md: 10px
  lg: 16px
  field-row-height: 28px
  label-col: 88px
  dot-size: 5px
  right-panel-width: 320px
  float-inset: 12px
components:
  field-row:
    display: grid
    gridTemplateColumns: "{spacing.label-col} 1fr"
    minHeight: "{spacing.field-row-height}"
    gap: "{spacing.sm}"
    alignItems: center
  field-well:
    backgroundColor: "{colors.field-well}"
    border: "1px solid {colors.border-subtle}"
    borderRadius: "{rounded.sm}"
    minHeight: "{spacing.field-row-height}"
  field-well-active:
    borderColor: "{colors.border-focus}"
    boxShadow: "inset 0 0 0 1px {colors.accent-field-glow}"
  field-dot:
    width: "{spacing.dot-size}"
    height: "{spacing.dot-size}"
    borderRadius: 999px
    backgroundColor: "{colors.accent-field}"
  section-header:
    font: "{typography.section}"
    color: "{colors.text-muted}"
    padding: "{spacing.md} {spacing.sm} {spacing.xs}"
---

# Design: Anime.js Field Language

**Status:** Design complete (handoff to Architect)  
**Parent:** exploratory — shell chrome + inspector cohesion  
**Mock:** [animejs_fields_mockup.html](./animejs_fields_mockup.html)  
**Reference:** anime.js “Scramble config” GUI — dense, monospace, warm accent on active values

---

## Overview

The anime.js config panel treats every parameter as a **pro-tool row**: lowercase monospace label, recessed value well, optional status dot, and a single warm accent color that only appears when a field is **focused, dirty, or driving animation**. The feeling is “patch bay / node editor,” not “settings app.”

This design **adapts** that language to our engine inspector without cloning anime.js wholesale:

- **Keep** transparent glass shell, tabbed right panel, and component accordions from the current shell.
- **Replace** the shadcn-segmented control aesthetic inside the inspector body with anime-style **field wells** and **integrated sliders**.
- **Extend** the same primitives to Scene tab, Settings, and dialogs so forms feel like one instrument.

**Emotional tone:** precise, calm, technical — the accent is rare and meaningful (dirty field, live preview, active tween), not decorative chrome.

## Colors

| Token | Role |
| ----- | ---- |
| `field-well` | Recessed input background — always darker than glass panel |
| `accent-field` | Warm gold `#c9a227` — focus ring, dirty dot, active value text |
| `text-muted` | Labels at rest |
| `text-dim` | Placeholder / disabled value |
| `border-subtle` | Well outline at rest |
| `border-focus` | Gold-tinted border on focus or dirty |

Glass panel tokens from `design_system_unification` stay for **shell** surfaces; field wells are **opaque islands** inside glass so controls remain readable over the viewport.

## Typography

- **UI chrome** (tabs, entity title): Geist sans — unchanged from current shell.
- **All field labels + values**: Geist Mono, **lowercase** labels (anime.js convention).
- **Section headers** (`transform`, `ground`): 10px uppercase mono, muted — replaces heavy accordion chrome with a lighter divider.

## Layout

### Field row grid

```
[ label 88px ] [ gap 6px ] [ well — flex 1 ]
```

- Row height **28px** fixed (dense but tappable).
- Vec3 rows: one row per axis; axis letter (`x` `y` `z`) **inside** the well as a narrow prefix column, not a separate pill.

### Right panel anatomy (unchanged regions, new body)

1. Header — entity type + id badge (sans)
2. Transform toolbar — keep M/R/S; restyle as flat mono pills
3. Tabs — Props / Events / … (sans, current underline)
4. **Body** — accordion per component; inside each: anime field rows

### Density comparison

| Current | Proposed |
| ------- | -------- |
| 7px-tall segmented groups + outer borders | Single well per control |
| Uppercase inspector labels | lowercase mono labels |
| Slider thumb + separate number | Integrated bar + right-aligned value |
| No dirty indication | Gold dot when value ≠ default |

## Elevation & Depth

- **Shell:** existing frosted glass (`glass-panel-shell`, ~22% tint).
- **Wells:** flat inset `#141414`, 1px `border-subtle` — no drop shadow on fields.
- **Focus:** inset gold glow, not outer ring spread (keeps density).

## Shapes

- Field wells: **3px** radius (anime.js uses near-square; we use minimal soften).
- Panel corners: **flush** (`glass-flush`) — already shipped.
- Checkboxes: 14×14 recessed square, 2px radius.
- Color swatch: circle inside well, right-aligned.

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| `FieldRow` | label + optional dot + well | default, focus, dirty, disabled | new `AnimeFieldRow.svelte` or restyle `InspectorField.svelte` |
| `FieldWell` | mono container for any control | hover, focus-within, dirty | wrapper in `InspectorField.svelte` |
| `ScalarInput` | well + right-aligned number + invisible range | focus types value | `InspectorField` kind `number` |
| `SliderField` | well + vertical tick at value % + number | drag, hover tick | `InspectorField` kind `slider` |
| `SelectField` | well + label/value + stacked chevrons | open, focus | `InspectorField` kind `select` |
| `BoolField` | well + checkbox left + label optional | on/off | `InspectorField` kind `boolean` |
| `ColorField` | well + hex mono + swatch disc | pick | `InspectorField` kind `color` |
| `Vec3Row` | axis prefix in well + number | per-axis dirty dot | `layoutComponentFields` rows |
| `SectionLabel` | uppercase mono divider | — | accordion trigger restyle |
| `InspectorActions` | flat text buttons SAVE / REVERT | primary gold on SAVE when dirty | future durable edit bar |

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Click label | — | focus associated well |
| Arrow keys on number | focus | nudge ±step (existing `handleNumberNudgeKeydown`) |
| Drag slider tick | drag | update value; well → dirty; dot appears |
| Tab between wells | focus | gold border; value text → accent |
| Reset to default | alt+click label (proposed) | revert; dot hides |
| Accordion section | collapsed/expanded | only header visible; no height animation (reduced motion) |

## Accessibility

- **Focus order:** top → bottom within panel; vec3 rows are x → y → z.
- **Labels:** explicit `<label for>`; dirty dot is `aria-hidden` — use `aria-describedby` for “modified from default” when dirty.
- **Contrast:** gold accent on `#141414` meets AA for 11px mono when used for text; labels stay `#6f6f6f` on glass (decorative only).
- **Motion:** slider tick moves with CSS `transform` only; respect `prefers-reduced-motion` — jump tick, no transition.

## Do's and Don'ts

**Do**

- Use accent gold **only** for focus, dirty, or live-driven values.
- Keep wells **opaque** over glass.
- Lowercase mono labels everywhere in inspector body.
- Right-align numeric values inside wells.

**Don't**

- Don't gold-paint entire rows or tabs — accent is signal, not theme.
- Don't add outer card shadows per field — density is the point.
- Don't mix sans inside wells (breaks anime.js rhythm).
- Don't remove keyboard nudge / reset behaviors we already ship.

## Open for Architect

1. **Token seam:** add `--accent-field`, `--field-well`, `--field-row-height` to `themes.css` or scoped inspector block in `app.css`?
2. **Refactor scope:** restyle `InspectorField.svelte` + `app.css` inspector block vs. new parallel component?
3. **Dirty tracking:** engine already knows defaults from ontology — expose `isDirty(entity, component, field)` for dot?
4. **Transform toolbar + tabs:** phase 2 or include in same wedge?
5. **Settings / Scene tab:** same field language — one CSS module or shared `FieldWell` snippet?

## Handoff checklist

- [x] `docs/artifacts/animejs_fields_design.md`
- [x] `docs/artifacts/animejs_fields_mockup.html`
- [ ] Trellis design issue (create when parent proposal exists)
- [ ] Architect spec with AC per field kind + migration plan from shadcn segments
