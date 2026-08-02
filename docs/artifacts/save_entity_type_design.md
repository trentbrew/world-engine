---
version: alpha
name: Save Selection as EntityType
description: Design artifact for TRL-92 — promote a configured entity instance to a reusable world-scoped EntityType
colors:
  viewport: "#0e0e0e"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  surface-overlay: "#242424"
  surface-glass: "color-mix(in srgb, #242424 62%, transparent)"
  text: "#e8e8e8"
  text-muted: "#8a8a8a"
  text-mono: "#a3a3a3"
  primary: "#d4d4d4"
  primary-muted: "#2e2e2e"
  accent-link: "#737373"
  accent-type: "#a78bfa"
  success: "#86efac"
  destructive: "#f87171"
  border: "#333333"
  border-focus: "#737373"
  ring: "#737373"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.04em
    textTransform: uppercase
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  right-panel-width: 280px
  dialog-width: 420px
components:
  save-type-trigger:
    extends: shadcn-button
    variant: outline
    size: sm
    fontSize: 11px
  save-type-dialog:
    extends: shadcn-dialog
    maxWidth: "{spacing.dialog-width}"
  component-chip:
    font: "{typography.mono}"
    fontSize: 10px
    padding: "2px 8px"
    borderRadius: "{rounded.sm}"
    background: "{colors.surface-raised}"
    border: "1px solid {colors.border}"
  type-preview:
    font: "{typography.mono}"
    fontSize: 11px
    padding: "{spacing.sm}"
    borderRadius: "{rounded.sm}"
    background: "{colors.viewport}"
    border: "1px solid {colors.border}"
---

# Design: Save Selection as EntityType

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-92 (Proposal) · depends on TRL-C (durable component ops)  
**Mock:** [save_entity_type_mockup.html](./save_entity_type_mockup.html)

---

## Overview

Authors compose entities in the inspector (add/remove components, JSON tab). **Save as type…** promotes the current instance's **component composition + durable defaults** into a new `EntityType` node in the world `@graph`, then surfaces that type in **Add entity** and spawn flows.

**Audience:** builder-engineer authoring JSON-LD worlds in edit mode — wants div-like composability without hand-editing `@graph` type definitions.

**Brand posture:** Same creative-tool density as `AddEntityDialog` and right inspector tabs. Promotion is a **deliberate, named action** (dialog), not an implicit side effect of editing props. Type creation reads as **schema authoring**, not generic CRUD.

**v1 scope (design):**

| In | Out |
| --- | --- |
| Save new type from eligible entity | Update existing type in place (v1.1) |
| Durable persist via graph write | ComponentSchema node authoring |
| Add entity lists world types | Full spawn palette / asset dock integration |
| Set `conformsTo` on source entity (checkbox, default on) | Bulk re-type existing instances |

---

## Colors

Extends `right_inspector_tabs_design.md` tokens — no palette fork.

| Token | Role |
| ----- | ---- |
| `accent-type` | Type badge, `type:` preview prefix, success chip border |
| `surface-overlay` | Dialog surface |
| `text-muted` | Helper copy, component chip labels |
| `destructive` | Name collision / validation errors |

---

## Typography

- **Dialog title:** 13px semibold — "Save as type"
- **Field labels:** shadcn Form.Label (11px)
- **Type preview:** 11px mono — `type:FallingCrate` / `conformsTo: FallingCrate`
- **Component chips:** 10px mono uppercase component names
- **Schema tab CTA:** 11px outline button, full width in footer strip

---

## Layout

### Entry points (v1)

Primary: **Schema tab** footer action strip (entity selected, edit mode).

Secondary (optional v1 — Architect may defer): **Props tab** overflow menu item "Save as type…" — same dialog.

```
┌──────────────────────────────┐
│ Prop              crate-b    │  header
├──────────────────────────────┤
│ Props Schema Graph Ops JSON  │
├──────────────────────────────┤
│  [Schema accordions…]        │
│                              │
├──────────────────────────────┤
│ [ Save as type… ]            │  ← schema-footer (sticky)
└──────────────────────────────┘
```

| Region | Behavior |
| ------ | -------- |
| **schema-footer** | `position: sticky; bottom: 0`; top border; padding `sm md`; background matches panel |
| **Save as type…** | Outline `sm` button; disabled when ineligible |

### Dialog anatomy

Mirrors `AddEntityDialog.svelte` width (~420px):

```
┌ Save as type ─────────────────────┐
│ Type name                         │
│ [ FallingCrate____________ ]      │
│                                   │
│ Components captured               │
│ [Transform] [Render] [Gravity]    │
│                                   │
│ Defaults (durable fields)         │
│ ┌ mono preview block ───────────┐ │
│ │ Render.color: #ff6b6b         │ │
│ │ Gravity.g: 9.8                │ │
│ └───────────────────────────────┘ │
│                                   │
│ ☑ Apply type to this entity       │
│   (sets conformsTo)               │
│                                   │
│ Preview                           │
│ type:FallingCrate                 │
│                                   │
│              [Cancel]  [Save]     │
└───────────────────────────────────┘
```

---

## Elevation & Depth

- Footer strip: 1px top border inset (no shadow)
- Dialog: standard shadcn overlay + `Dialog.Content` elevation
- Component chips: flat `surface-raised`, no pill glow

---

## Shapes

- Component chips: `{rounded.sm}`, 2px 8px padding
- Dialog: `{rounded.lg}` (shadcn default)
- Type preview block: same as Add entity `@id` preview

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **SaveTypeTrigger** | outline button | default, disabled, focus | **New** in `EntitySchemaPanel.svelte` footer |
| **SaveTypeDialog** | Dialog + form | open, validating, submitting, error | **New** `SaveTypeDialog.svelte` |
| **ComponentChipList** | horizontal wrap of chips | empty (shouldn't show) | inline in dialog |
| **DefaultsPreview** | read-only mono block | scroll if >6 lines | inline in dialog |
| **AddEntityDialog** | type select | built-in + world types | extend `AddEntityDialog.svelte` |
| **EntitySchemaPanel** | accordions + footer | eligible / ineligible | extend existing |

---

## Interaction matrix

| Input | Preconditions | States | Output |
| ----- | ------------- | ------ | ------ |
| Open Schema tab | Entity selected, edit mode | eligible / ineligible | Schema accordions + footer CTA |
| Click **Save as type…** | Eligible entity | — | Opens `SaveTypeDialog` |
| Type name field | Dialog open | empty, valid, collision, invalid chars | Inline validation; preview updates |
| Toggle **Apply to this entity** | Dialog open | checked (default) / unchecked | Architect: controls post-save `conformsTo` patch |
| Click **Save** | Valid name, host or RAM-only | submitting → success / error | Graph `EntityType` node; optional `conformsTo`; toast; close dialog |
| Click **Cancel** / Esc | Dialog open | — | Close, no mutation |
| Add entity → type select | After save | built-in + world group | New type in dropdown under "World types" |

### Eligibility rules (UX)

| Entity | Save as type… |
| ------ | ------------- |
| Prop / composable instance (Transform + Render or custom components) | **Enabled** |
| Player (has `Player` component) | Disabled — tooltip: "Player entities cannot become types" |
| Ground / GroundPlane | Disabled |
| Scene settings entity | Disabled |
| SpawnPoint-only (Marker, no Render) | Disabled — tooltip: "Needs a renderable composition" |
| No selection | N/A (panel empty) |

**Non-host + durable mode:** Button enabled (local + peer sync); Trellis persist follows TRL-C host gate — no special UI beyond existing offline toast pattern.

### Name validation (UX)

- **Pattern:** PascalCase identifier — `^[A-Z][a-zA-Z0-9]*$` (matches built-in `Prop`, `Orbiter` style)
- **Collision:** inline error "Type `{name}` already exists"
- **Reserved:** block built-in registry names (`Prop`, `Player`, `GroundPlane`, …) with hint to pick a distinct name
- **Preview:** `type:{Name}` and `conformsTo: {Name}` (Architect maps to `@id` convention)

### Defaults capture (UX display)

Show **durable fields only** from instance bags (aligns with TRL-C `durableBagOnly`). Realtime fields (e.g. `Transform.position`) omitted from defaults preview with footnote: "Position and other realtime fields are not saved on the type."

---

## Accessibility

| Requirement | Implementation |
| ----------- | -------------- |
| **Focus order** | Schema tab → footer button → dialog: name → checkbox → Cancel → Save |
| **Dialog** | `Dialog.Title` "Save as type"; `aria-describedby` on helper paragraph |
| **Disabled trigger** | `disabled` + `title` tooltip explaining eligibility |
| **Live validation** | `aria-invalid` on name input; errors linked via `aria-describedby` |
| **Motion** | Dialog enter/exit uses shadcn defaults; respect `prefers-reduced-motion` (no custom animation) |
| **Keyboard** | Esc closes dialog; Enter submits when valid (form default) |

---

## Add entity integration (post-save)

Extend type `<Select>` in `AddEntityDialog`:

```
Built-in
  Prop
  SpawnPoint
  GroundPlane
World types
  FallingCrate      ← from @graph EntityType
  HeavyBarrel
```

- World types sorted alphabetically
- Selecting world type uses type's component list + defaults for spawn
- `@id suffix` field unchanged (user picks instance id)

---

## Open for Architect

1. **Patch kind for type create:** New `defineType` vs composite of graph node insert — TRL-C deferred this; spec must choose wire format.
2. **Update vs create:** v1 is create-only; disable button when entity already `conformsTo` a world-defined type, or show "Save as new type" always (design recommends **always create new** in v1; re-type is separate wedge).
3. **Props tab secondary entry:** Optional — Schema-only is sufficient for v1 AC.
4. **Ops log entry kind:** Suggest `defineType` row in EntityOpsPanel — `{name} · 3 components`.
5. **Reload / ontology refresh:** After save, `loadOntology` must hot-reload world types without full page refresh — UX expects immediate Add entity listing.

---

## Do's and Don'ts

**Do**

- Keep the action in Schema tab — authors think "type" when promoting composition
- Show exactly which components and durable defaults will be written
- Default "Apply to this entity" on so the instance immediately reflects the new type
- Reuse `AddEntityDialog` patterns (preview block, zod validation, toast)

**Don't**

- Auto-save types on every prop edit (explicit dialog only)
- Allow Player/Ground promotion
- Hide realtime omission — explain why position isn't on the type
- Fork dialog styling — stay on shadcn Dialog + Form stack
