---
version: alpha
name: AppShell UI Foundation
description: Design artifact for TRL-23 — shadcn-svelte foundation, left tool rail, viewport-first AppShell, Sonner toasts, form/dialog patterns
colors:
  viewport: "#08080a"
  viewport-grid: "#1a1a22"
  surface: "#111116"
  surface-raised: "#18181f"
  surface-overlay: "#1e1e26"
  text: "#e4e4ea"
  text-muted: "#7a7a8c"
  text-mono: "#a8b4c0"
  primary: "#ff6b6b"
  primary-foreground: "#0a0a0c"
  accent-spawn: "#e8a838"
  accent-entity: "#5b9fd4"
  accent-link: "#7c6cf0"
  success: "#4ade80"
  destructive: "#ef4444"
  border: "#2a2a36"
  border-focus: "#5b9fd4"
  ring: "#5b9fd4"
  muted: "#18181f"
  muted-foreground: "#7a7a8c"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.06em
    textTransform: uppercase
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 3px
  md: 6px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  rail-width: 48px
  inspector-width: 240px
  toolbar-height: 40px
components:
  toolbar:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.border}"
    height: "{spacing.toolbar-height}"
    padding: "0 {spacing.md}"
  rail:
    backgroundColor: "{colors.surface}"
    borderRight: "1px solid {colors.border}"
    width: "{spacing.rail-width}"
  viewport:
    backgroundColor: "{colors.viewport}"
  inspector:
    backgroundColor: "{colors.surface}"
    borderLeft: "1px solid {colors.border}"
    width: "{spacing.inspector-width}"
  rail-button:
    size: 36px
    borderRadius: "{rounded.sm}"
    activeBackground: "{colors.surface-raised}"
    activeBorder: "inset 2px 0 0 {colors.accent-entity}"
  toast:
    backgroundColor: "{colors.surface-raised}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.sm}"
  dialog:
    backgroundColor: "{colors.surface-overlay}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.md}"
    maxWidth: 420px
  input:
    backgroundColor: "{colors.viewport}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.sm}"
    focusRing: "2px {colors.ring}"
---

# Design: AppShell UI Foundation

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-23  
**Mock:** [appshell_ui_foundation_mockup.html](./appshell_ui_foundation_mockup.html)  
**Inherits:** [jsonld_world_hydrator_design.md](./jsonld_world_hydrator_design.md) — extends tokens; reconciles current `app.css` drift back to hydrator palette.

---

## Overview

Establish a **component foundation** before authoring features land (left rail affordances, entity dialogs, formula editor, world settings). Adopt **shadcn-svelte + Tailwind** with tokens mapped to the existing **instrument-panel** aesthetic — not default shadcn zinc/light.

**Audience:** builder-engineer authoring JSON-LD worlds; agents composing entities via data.

**Emotional tone:** viewport hero, chrome as precision tooling. Rail = mode switcher + creation affordances. Inspector = read-mostly dev panel (existing). Toasts = ephemeral system feedback (controller connect, save, errors).

**v1 scope:** shell layout + token theme + component inventory + one reference Dialog+Form. **Not** full inspector rewrite or formula editor.

## Colors

Reconcile `app.css` (currently desaturated) **to hydrator tokens** below — these become the shadcn CSS variable source (`--background`, `--foreground`, `--primary`, etc.).

| Token | Role | shadcn mapping |
| ----- | ---- | -------------- |
| `viewport` | WebGL bleed | `--background` (canvas region only) |
| `surface` / `surface-raised` | Toolbar, rail, inspector, toast | `--card`, `--popover` |
| `surface-overlay` | Dialog backdrop panel | `--background` (modal) |
| `primary` | Destructive/create emphasis, prop tint continuity | `--primary` |
| `accent-entity` | Selection, active rail item, focus ring | `--ring`, `--accent` |
| `accent-link` | File refs, mono links | `--muted-foreground` links |
| `accent-spawn` | Host/net positive states | status dot (host) |
| `success` / `destructive` | Toast variants, validation | Sonner theme |
| `border` / `border-focus` | All chrome separation | `--border`, focus-visible |

**Theme mode:** dark only for v1. No light theme.

## Typography

Unchanged from hydrator design — DM Sans UI, JetBrains Mono for `@id` and JSON.

| Level | Use |
| ----- | --- |
| `title` | Toolbar world filename |
| `label` | Section eyebrows (`ENTITIES`, `ATTRIBUTES`) |
| `ui` | Stats, buttons, form labels |
| `mono` | Entity ids, attribute keys/values, dialog entity id preview |

## Layout

### Desktop (≥768px)

```
┌──┬──────────────────────────────────────────────────────┬──────────┐
│R │ world.jsonld · 4 entities · tick 0 · ● controller   │          │
│A ├──────────────────────────────────────────────────────┤ INSPECTOR│
│I │                                                      │          │
│L │              THRELTE VIEWPORT (hero)                 │ entities │
│  │                                                      │ attrs    │
│48│                                                      │          │
│px│                                                      │  240px   │
└──┴──────────────────────────────────────────────────────┴──────────┘
```

| Region | Width | Collapsible | Notes |
| ------ | ----- | ----------- | ----- |
| **Toolbar** | full width | no | spans all columns |
| **Rail** | 48px fixed | no (v1) | icon-only; tooltips on hover |
| **Viewport** | flex-1 | never | min-width 0; always ≥55% at 1280px |
| **Inspector** | 240px | yes (toolbar btn) | docked **right** (restore TRL-2 intent) |

**Grid:** `toolbar | rail + viewport + inspector` — CSS grid on `AppShell`:

- Row 1: toolbar (col span all)
- Row 2: `[rail][viewport][inspector?]`

**Migration note:** current impl places inspector **left** of viewport; this design **moves inspector right** and inserts rail leftmost.

### Mobile (<768px)

- Rail → bottom tab bar (4 items max) OR collapsible hamburger sheet (Architect: pick sheet for v1)
- Inspector → bottom sheet (max 50vh), toggled from rail "Entities" or toolbar
- Viewport always visible above sheet

### Z-order

| Layer | z-index |
| ----- | ------- |
| Viewport canvas | 0 |
| Toolbar | 10 |
| Rail | 11 |
| Inspector | 12 |
| Dialog overlay | 40 |
| Sonner toasts | 50 |

## Elevation & Depth

- **Inset hierarchy:** rail and inspector use `border` separation only — no drop shadows on docked panels
- **Dialog:** subtle shadow `0 16px 48px rgb(0 0 0 / 0.45)` on overlay panel
- **Toast:** light shadow (Sonner default OK if token-matched)
- **Active rail item:** inset left accent bar (`accent-entity`), not floating pill

## Shapes

- Radii: `sm` (3px) for buttons, inputs, toasts; `md` (6px) for dialogs
- Rail buttons: 36×36px hit target in 48px column
- No pill buttons in chrome — rectangular instrument aesthetic

## Components

### shadcn-svelte inventory (v1 install)

| Component | Purpose | Priority |
| --------- | ------- | -------- |
| `Button` | Toolbar, rail, dialog actions | P0 |
| `Tooltip` | Rail icon labels | P0 |
| `Sonner` + `Toaster` | Replace custom `ToastHost` | P0 |
| `Dialog` | "Add entity" reference pattern | P0 |
| `Input`, `Label` | Form fields | P0 |
| `Form` (formsnap) | Validation reference | P0 |
| `Separator` | Inspector sections | P1 |
| `ScrollArea` | Inspector lists | P1 |
| `Sheet` | Mobile rail (if not deferring) | P2 |

### AppShell anatomy

| Slot | Component | States |
| ---- | --------- | ------ |
| `toolbar` | `WorldToolbar` | default |
| `rail` | `WorldRail` (new) | item active/inactive/disabled |
| `viewport` | `WorldViewport` | loading, ready, error |
| `inspector` | `EntityInspector` | open/closed, empty/selected |
| `toaster` | Sonner host | — |

### WorldRail affordances (v1 placeholders)

| Icon | Label (tooltip) | Action | Active when |
| ---- | --------------- | ------ | ----------- |
| ◉ | World | Focus viewport; deselect | default |
| ◧ | Entities | Toggle inspector | inspector open |
| ＋ | Add entity | Open Dialog | dialog open |
| ⚙ | Settings | Dialog (stub) | — |

Future slots (disabled/ghost in mock): Formula, Graph, Publish.

### Reference Dialog: Add Entity

```
┌ Add entity ────────────────────────┐
│ conformsTo   [ Prop          ▼ ]   │
│ @id suffix   [ crate-c        ]    │
│ preview      entity:prop/crate-c   │
│              ─────────────────     │
│                    [ Cancel ] [Add]│
└────────────────────────────────────┘
```

- `conformsTo`: Select (shadcn) — v1 can be native select styled
- `@id suffix`: Input with zod validation (alphanumeric + hyphen)
- Preview: mono read-only derived id
- Primary button uses `{colors.primary}`; disabled until valid

### Toast patterns (Sonner)

| Event | Variant | Example |
| ----- | ------- | ------- |
| Controller connect | default | "Xbox Controller connected" |
| Controller disconnect | default | "Xbox Controller disconnected" |
| Entity added (future) | success | "entity:prop/crate-c created" |
| Validation error | error | "Invalid entity id" |

Position: bottom-center (matches current). Max 3 visible.

## Interaction matrix

| Input | State | Output |
| ----- | ----- | ------ |
| Rail icon click | — | Toggle mode / open dialog; `aria-pressed` on toggle items |
| Rail icon hover | — | Tooltip after 400ms |
| Toolbar Inspector btn | — | Same as rail Entities (sync pressed state) |
| Dialog Add submit | valid form | Close dialog; toast success (stub); Architect wires engine later |
| Dialog Cancel / Esc | — | Close without mutation |
| Controller connect | — | Sonner toast + toolbar dot (existing) |
| Inspector toggle | open/closed | Grid column animates; `sessionStorage` persist |
| Keyboard | rail focused | Arrow keys move between rail items; Enter activates |
| Tab order | — | skip-link → toolbar → rail → viewport (skip) → inspector list |

## Accessibility

- **Focus order:** skip-link → toolbar controls → rail (roving tabindex) → inspector list → dialog trap when open
- **Rail:** each button `aria-label` = tooltip text; toggle items use `aria-pressed`
- **Dialog:** `aria-labelledby`, focus trap, restore focus on close
- **Toasts:** Sonner `aria-live="polite"`; don't steal focus
- **Motion:** `prefers-reduced-motion: reduce` — disable grid width transition + toast slide; instant open/close
- **Contrast:** text on `surface` ≥ 4.5:1; primary button white on `#ff6b6b` passes for large text — use `{primary-foreground}` dark text on primary bg

## Do's and Don'ts

**Do**

- Map shadcn CSS vars to YAML tokens in one `app.css` / `tailwind.config` location
- Keep viewport ≥55% width at 1280px with inspector open
- Migrate toast first (low risk, establishes Sonner pattern)
- Use Tooltip on every rail icon (no unlabeled icons)

**Don't**

- Ship default shadcn light/zinc theme unmodified
- Rewrite EntityInspector internals in v1 — restyle incrementally only
- Put persistent forms in the rail — rail is icon affordances only
- Block viewport on dialog open (overlay only)

## Open for Architect

- **Tailwind v4 vs v3** with SvelteKit — pick supported shadcn-svelte init path
- **formsnap + superforms + zod** wiring for Add Entity reference (can stub submit handler)
- **Inspector position migration:** left → right — single PR or phased?
- **Mobile rail:** bottom tabs vs Sheet — recommend Sheet for v1 to preserve 4 affordances
- **Select component:** full shadcn Combobox vs styled native `<select>` for v1 Add Entity
- **Token source of truth:** `app.css` `:root` vs `@theme` in Tailwind v4
- **Lane promote path** for `src/lib/components/ui/*` (shadcn copy target)

## Handoff checklist

- [x] `docs/artifacts/appshell_ui_foundation_design.md` (this file)
- [x] `docs/artifacts/appshell_ui_foundation_mockup.html` (self-contained interactive mock)
- [ ] Trellis design issue + `describe` SUMMARY (CLI write failed this session — Strategist/Manager sync TRL-23)
