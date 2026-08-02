---
version: 1
name: Anime.js Field Language
parent: shell/inspector-cohesion (exploratory)
design: docs/artifacts/animejs_fields_design.md
mock: docs/artifacts/animejs_fields_mockup.html
status: queue-ready
labels: spec, ui, inspector, needs-e2e
---

# Spec: Anime.js Field Language

**Parent:** exploratory UI cohesion (transparent chrome + inspector)  
**Design:** [animejs_fields_design.md](./animejs_fields_design.md)  
**Mock:** [animejs_fields_mockup.html](./animejs_fields_mockup.html)  
**Orthogonal:** transparent glass shell changes in working tree — do not regress; no re-litigation of shell layout in this wedge.

---

## Summary

Replace the **shadcn segmented inspector control** aesthetic (ButtonGroup + per-segment borders) with a **dense anime.js-style field language**: lowercase mono labels, opaque recessed **wells**, integrated slider tick, and **gold accent** only on focus/dirty. Implementation is a **single refactor** of `InspectorField.svelte` + `ComponentFieldInput.svelte` + the `app.css` inspector block — not a parallel component tree.

**In scope (phase 1):** all call sites of `InspectorField` (right Props tab, left Scene tab scene fields, `CameraSceneFields`, `ShadersSceneFields`).  
**Out of scope (phase 2):** `TransformToolbar` pill restyle, `SettingsPanel` bespoke controls, durable SAVE/REVERT footer.

---

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Token home | Add semantic tokens to **`themes.css`** (`[data-theme='default']` + `.dark`); wire aliases in **`app.css` `:root`** | Theme-swappable; matches `design_system_unification` seam |
| Refactor surface | **Restyle in place** — `InspectorField`, `ComponentFieldInput`, `InspectorFieldLabel`, `app.css` | One code path; Scene tab picks up style automatically |
| New Svelte files | **`FieldWell.svelte`** (presentational wrapper) + **`inspectorFieldDirty.ts`** (pure util) only | Avoid duplicating 6 field kinds |
| Dirty dot | **`inspectorFieldDirty(entity, component, field, value)`** compares normalized value vs effective default | Registry + type defaults + instance bag; dot hidden when equal |
| Alt+click reset | **Ship in phase 1** on label when default exists and field editable | Design interaction matrix; calls existing `world.setField` |
| Vec3 / quat rows | **One `field-row` per axis**; label only on first row; axis prefix **inside well** (22px column) | Matches mock; remove ButtonGroup axis pills |
| Slider | Custom **integrated track** in `InspectorField` (range input + tick div); **remove** shadcn `Slider` for inspector sliders | anime tick visual; keep dblclick reset on well |
| Select | Keep **bits-ui Select** inside well; style trigger as mono lowercase + chevrons via CSS | Behavior unchanged; fewer regressions |
| Boolean | Recessed **14×14** box in well + `on`/`off` mono text; replace bare Checkbox row | Mock parity |
| Color | Well: swatch disc right, hex mono left-of-swatch; alpha row **second field-row** below | Keep alpha editing; drop ButtonGroup color layout |
| Accordion headers | **Phase 1:** uppercase mono 10px on `.inspector-trigger` only | Light touch; full section divider defer optional |
| Transform toolbar | **Phase 2** separate issue | ToggleGroup works; not blocking field language |
| Settings panel | **Phase 2** — audit controls not using `InspectorField` | |
| Play mode | Unchanged — right panel hidden | |

---

## Tokens (`themes.css` + `app.css`)

Add to each theme preset (at minimum `default` / `default.dark`):

```css
--field-well: oklch(0.16 0 0);           /* ~#141414 dark */
--field-well-hover: oklch(0.19 0 0);
--field-well-active: oklch(0.2 0.01 100);
--accent-field: oklch(0.72 0.12 85);   /* warm gold ~#c9a227 */
--accent-field-glow: color-mix(in srgb, var(--accent-field) 18%, transparent);
--border-field: color-mix(in srgb, var(--border) 65%, transparent);
--border-field-focus: color-mix(in srgb, var(--accent-field) 55%, var(--border));
```

`:root` aliases in `app.css`:

```css
--field-row-height: 28px;
--field-label-col: 88px;
--field-dot-size: 5px;
```

Map `--accent-field` in `@theme inline` only if Tailwind utilities needed (`text-accent-field`); CSS classes preferred for v1.

**Do not** replace `--primary` / tab accent with gold globally — gold is **field-signal only** (design don't).

---

## CSS architecture (`app.css`)

Replace / extend the existing **Inspector field system** block (~L231+) with:

| Class | Role |
| ----- | ---- |
| `.field-row` | Grid: `var(--field-label-col) 1fr`; gap 6px; min-height 28px |
| `.field-row--dirty` | Well border tint; dot visible; value color accent |
| `.field-row--focused` | `:focus-within` equivalent (class toggled or CSS only) |
| `.field-label-wrap` | Flex; dot + label + optional help icon |
| `.field-dot` | 5px circle; `opacity: 0` default; `opacity: 1` when dirty |
| `.field-well` | Opaque well container; hover/active/focus-within states |
| `.field-axis` | 22px prefix column inside well |
| `.field-value` | Right-aligned mono input (borderless inside well) |
| `.slider-well` / `.slider-track` / `.slider-tick` | Integrated slider (see mock) |
| `.bool-well` / `.bool-box` | Checkbox replacement |
| `.select-well` | Select trigger padding |

**Remove** dependency on segmented `.inspector-field[data-slot='button-group']` corner rules where no longer used.

**Retain** for regression safety until migrated:
- `handleNumberNudgeKeydown` behavior
- `readonly` / `disabled` from `ComponentFieldInput`
- `inspector-field-help` tooltips on label

---

## Component map

| File | Action |
| ---- | ------ |
| `src/lib/ui/FieldWell.svelte` | **New** — `<div class="field-well">` + optional `dirty`/`disabled` props; slot for control |
| `src/lib/ui/inspectorFieldDirty.ts` | **New** — `fieldDefault(entity, component, field)`, `isInspectorFieldDirty(...)` |
| `src/lib/ui/InspectorField.svelte` | **Rewrite** markup: `field-row` + `FieldWell` per kind; integrated slider; bool/select/color layouts |
| `src/lib/ui/InspectorFieldLabel.svelte` | Label lowercase via CSS `text-transform: lowercase`; dot slot; alt+click reset handler |
| `src/lib/ui/ComponentFieldInput.svelte` | Vec3/quat/vec2: one row per axis using shared row snippet; pass `defaultValue` + dirty to `InspectorField` |
| `src/lib/ui/EntityAttributes.svelte` | Minor: accordion trigger font → section mono style (10px uppercase) |
| `src/lib/theme/themes.css` | Add field tokens per preset |
| `src/app.css` | Field language CSS; deprecate old segment-specific rules |
| `docs/ontology.md` | **No change** |

**Do not edit** in phase 1: `TransformToolbar.svelte`, `SettingsPanel.svelte`, shell layout files.

---

## Dirty default resolution (`inspectorFieldDirty.ts`)

```ts
export function resolveInspectorFieldDefault(
  entity: Entity,
  component: string,
  field: string
): unknown;

export function isInspectorFieldDirty(
  entity: Entity,
  component: string,
  field: string,
  value: unknown
): boolean;
```

**Resolution order** (first wins):

1. Instance `entity.components[component][field]` if key absent → fall through to defaults for comparison baseline only when computing *effective default for dirty* use the merged default at spawn, not live value
2. `EntityType.defaults[component][field]` when `entity.conformsTo` resolves
3. `getComponent(component).fields[field].default`
4. If still `undefined` — **never dirty** (no dot)

**Comparison:** normalize numbers (round 1e-6), vec3/quat array length coercion, boolean strict, string trim. Formula fields (`=…`) — **never dirty** (derived).

**Accessibility:** when dirty, `aria-describedby` points to visually hidden “modified from default” text.

---

## Field kind AC (visual + behavior)

### All kinds

- [ ] Row uses `.field-row` grid; well is **opaque** (`--field-well`) over glass panel
- [ ] Label is Geist Mono 11px lowercase; help icon remains left of label when present
- [ ] Focus within well: gold border + inset glow; value text `--accent-field`
- [ ] Dirty (value ≠ resolved default): dot visible + value accent (even without focus)
- [ ] `disabled` / `readonly`: well at 50% opacity; no dot; no edit
- [ ] Arrow up/down nudge still works on numeric fields

### `number` / `text`

- [ ] Single well; value right-aligned in mono input

### `slider`

- [ ] Hairline track + vertical tick at value%; invisible `<input type="range">` overlay
- [ ] Number right-aligned in well (40px column); typing updates slider
- [ ] Double-click well resets to `defaultValue` when provided

### `boolean`

- [ ] 14×14 recessed box; gold fill when on; `on`/`off` text in well

### `select`

- [ ] Select trigger fills well; lowercase selected value; chevrons right

### `color`

- [ ] Hex + circular swatch right-aligned; alpha as separate row when opacity &lt; 1 or always (match current behavior — **keep alpha row**)

### `vec3` / `vec2` / euler `quat`

- [ ] Three (or two) rows; label only first row; `x`/`y`/`z` axis prefix inside well
- [ ] Per-axis dirty dot independent

---

## Phase 2 (follow-up — not this impl)

| Item | Notes |
| ---- | ----- |
| `TransformToolbar` | Flat mono pills per mock; gold active |
| `SettingsPanel` | Migrate bespoke inputs to `InspectorField` or shared wells |
| `InspectorActions` | SAVE gold when graph dirty — needs durable UX spec |
| Left panel only fields | Already covered if using `InspectorField` |

---

## Testing

### Automated

```bash
pnpm check
pnpm test:e2e e2e/inspector-components.spec.ts
pnpm test:e2e e2e/undo-redo.spec.ts
pnpm test:e2e e2e/prop-collision.spec.ts
```

### New e2e (`e2e/inspector-field-style.spec.ts`) — **required**

| AC | Assertion |
| -- | --------- |
| Wells render | Selected GroundPlane → `Props` tab → `.field-well` count ≥ 1 |
| Slider tick | `Ground` `size` field has `.slider-tick` or `input[type=range]` inside `.field-well` |
| Dirty dot | Change `size` from default → parent `.field-row` gains dirty class OR dot visible |
| Keyboard nudge | Focus position x input → ArrowUp → value increases |
| Scene tab parity | Left `Scene` tab → scene field uses `.field-row` (not legacy button-group segments) |

Run: `PW_REUSE=1 pnpm test:e2e e2e/inspector-field-style.spec.ts`

### Manual (QA)

- [ ] Open `animejs_fields_mockup.html` side-by-side with app — visual parity on GroundPlane props
- [ ] Glass panel behind wells still shows blurred viewport
- [ ] `prefers-reduced-motion`: slider tick jumps without transition

---

## Migration / cleanup

1. Land tokens + CSS + `FieldWell` + dirty util
2. Rewrite `InspectorField` kinds one at a time (bool → number → slider → select → color → text)
3. Refactor `ComponentFieldInput` vec/quat rows to use shared row markup
4. Delete unused ButtonGroup imports from `InspectorField`
5. Prune dead `.inspector-field[data-slot='button-group']` rules from `app.css`

**Rollback:** revert single PR; no data migration.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Select dropdown styling breaks | Keep bits-ui portal; only restyle trigger |
| Dirty false positives on vec3 float noise | Epsilon compare in normalizer |
| Slider a11y regression | Preserve `aria-label` on range input |
| Theme contrast on light mode | Ship tokens for both `default` and `default.dark`; light wells slightly lighter oklch |

---

## Acceptance criteria (issue-ready)

- [ ] `docs/artifacts/animejs_fields_spec.md` exists (this file)
- [ ] Field tokens in `themes.css` + `app.css`
- [ ] `FieldWell.svelte` + `inspectorFieldDirty.ts` implemented
- [ ] `InspectorField.svelte` uses field-row / well layout for all kinds
- [ ] `ComponentFieldInput.svelte` vec/quat/vec2 use per-axis rows with in-well axis prefix
- [ ] Dirty dot + focus accent per design mock
- [ ] Alt+click label resets to default when editable
- [ ] `test:pnpm check`
- [ ] `test:pnpm test:e2e e2e/inspector-components.spec.ts`
- [ ] `test:pnpm test:e2e e2e/undo-redo.spec.ts`
- [ ] `test:PW_REUSE=1 pnpm test:e2e e2e/inspector-field-style.spec.ts`
- [ ] No changes to `TransformToolbar` / `SettingsPanel` in this wedge

---

## Handoff notes for Executor

- **Reference mock** toggles `anime` vs `current` — impl should match `anime` mode.
- **Do not** widen gold to tabs/header — mock keeps sans chrome unchanged.
- Transparent shell work in tree is separate; avoid merge conflicts in `app.css` glass block vs inspector block (inspector changes below glass section).
