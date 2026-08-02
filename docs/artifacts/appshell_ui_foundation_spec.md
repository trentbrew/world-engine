---
version: 1
name: AppShell UI Foundation
parent: TRL-23
design: docs/artifacts/appshell_ui_foundation_design.md
mock: docs/artifacts/appshell_ui_foundation_mockup.html
status: queue-ready
---

# Spec: AppShell UI Foundation (shadcn-svelte)

**Parent:** TRL-23  
**Design:** [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md)  
**Mock:** [appshell_ui_foundation_mockup.html](./appshell_ui_foundation_mockup.html)

---

## Summary

Scaffold **shadcn-svelte + Tailwind v4** with tokens mapped to the hydrator instrument-panel palette. Introduce **`AppShell`** layout (`rail | viewport | inspector`), **`WorldRail`** affordances, **Sonner** toasts (replacing custom host), and a reference **`AddEntityDialog`** (formsnap + superforms + zod, stub submit). Migrate inspector **right**; do **not** rewrite `EntityInspector` internals in this wedge.

---

## Architect decisions (closes design open questions)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Tailwind version | **v4** via `@tailwindcss/vite` | Matches Vite 8 stack; shadcn-svelte supports v4 init |
| shadcn init | Official CLI → `src/lib/components/ui/` | Standard path; components are owned source |
| Token source | **`src/app.css`** `:root` — dual layer | shadcn vars (`--background`, `--primary`, …) **plus** engine vars (`--viewport`, `--accent-entity`, …) for non-Tailwind Three.js chrome |
| Inspector position | **Single PR** — move to right | Avoid intermediate layout debt |
| Mobile rail | **Defer Sheet (P2)** | v1: desktop 48px rail only; `<768px` toolbar retains Inspector toggle; no bottom tab bar |
| Add Entity select | **Styled native `<select>`** | P0 speed; Combobox deferred to authoring wedge |
| Form stack | **formsnap + sveltekit-superforms + zod** | shadcn Form pattern; submit stub only |
| Entity mutation | **Stub** — toast success, no graph write | Authoring wedge wires `world` later |

---

## Dependencies (add via pnpm)

```
tailwindcss @tailwindcss/vite
shadcn-svelte (CLI dev workflow)
bits-ui clsx tailwind-merge tailwind-variants
svelte-sonner
formsnap sveltekit-superforms zod
```

Optional P1: `@internationalized/date` only if DatePicker added (skip v1).

---

## File plan

| Action | Path |
| ------ | ---- |
| Modify | `vite.config.ts` — add `@tailwindcss/vite` plugin |
| Modify | `src/app.css` — `@import 'tailwindcss'`, shadcn + engine tokens |
| Add | `src/lib/utils.ts` — `cn()` helper |
| Add | `components.json` — shadcn-svelte config (dark theme) |
| Add | `src/lib/components/ui/*` — Button, Tooltip, Dialog, Input, Label, Form, Sonner, Separator, ScrollArea |
| Add | `src/lib/ui/AppShell.svelte` — grid shell (toolbar slot + rail + main) |
| Add | `src/lib/ui/WorldRail.svelte` — icon rail |
| Add | `src/lib/ui/AddEntityDialog.svelte` — reference dialog + form |
| Modify | `src/lib/ui/WorldShell.svelte` — compose AppShell; drop layout CSS |
| Modify | `src/lib/ui/WorldToolbar.svelte` — shadcn Button; sync inspector pressed state with rail |
| Modify | `src/lib/ui/toast.svelte.ts` — thin wrapper calling `toast` from `svelte-sonner` |
| Remove | `src/lib/ui/ToastHost.svelte` |
| Modify | `src/routes/+layout.svelte` — mount `<Toaster />` once |

---

## Layout spec (`AppShell.svelte`)

### Desktop grid (≥768px)

```
grid-template-rows: var(--toolbar-height) 1fr
grid-template-columns: var(--rail-width) 1fr                    /* inspector closed */
grid-template-columns: var(--rail-width) 1fr var(--inspector-width)  /* open */
```

| Child | Column | Notes |
| ----- | ------ | ----- |
| Toolbar | row 1, span all | unchanged content |
| WorldRail | col 1, row 2 | 48px fixed |
| WorldViewport / error | col 2, row 2 | `min-width: 0` |
| EntityInspector | col 3, row 2 | only when `world.inspectorOpen`; `border-left` |

Explicit `grid-column` placement required (DOM order may differ).

### Mobile (<768px)

- Rail hidden (`display: none` on `WorldRail`)
- Inspector: bottom sheet (`grid-row: 3`, max-height 50vh) — preserve existing behavior
- Viewport: always row 2, full width

### Viewport width AC

At viewport width **1280px** with inspector open, viewport column ≥ **704px** (55% of 1280). Verify in browser devtools during QA.

---

## WorldRail spec

| Item | `aria-label` | Behavior |
| ---- | ------------ | -------- |
| World | "World" | `world.select(null)`; `aria-pressed` true when no selection (optional) |
| Entities | "Entities" | `world.toggleInspector()`; `aria-pressed` = `world.inspectorOpen` |
| Add | "Add entity" | Opens `AddEntityDialog`; not a toggle |
| Settings | "Settings" | `disabled` v1 |

- shadcn **Button** `variant="ghost"` `size="icon"` (36×36)
- shadcn **Tooltip** on each enabled item; `delayDuration={400}`
- Active toggle: `box-shadow: inset 2px 0 0 var(--accent-entity)` via class or data attribute

---

## AddEntityDialog spec

**Schema (zod):**

```ts
z.object({
  conformsTo: z.enum(['Prop', 'SpawnPoint', 'GroundPlane']), // match registry built-ins v1
  suffix: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, hyphens')
})
```

**UI fields:**

- `conformsTo` — native `<select>` styled with Tailwind (not Combobox v1)
- `suffix` — shadcn Input
- `preview` — read-only mono: `entity:{typeLower}/{suffix}` (live derived)

**Submit (stub):**

- Valid → close dialog → `toast.success('entity:prop/{suffix} created')` (Sonner)
- Invalid → inline field errors via formsnap
- Cancel / overlay click / Esc → close, no toast

**No** call to `world` entity APIs in this wedge.

---

## Toast migration

- Remove `ToastHost.svelte`
- `toast.svelte.ts` re-exports Sonner API:

```ts
import { toast } from 'svelte-sonner'
export { toast }
```

- `+layout.svelte`: `<Toaster position="bottom-center" theme="dark" />` with CSS vars matching design
- `input.ts` gamepad connect/disconnect continues calling `toast()` — now Sonner
- Max 3 visible (Sonner default)

---

## Theme / tokens

Map design YAML → CSS in `app.css`:

| Engine token | Value (from design) | shadcn alias |
| ------------ | ------------------- | ------------ |
| `--viewport` | `#08080a` | — (keep for canvas) |
| `--surface` | `#111116` | `--card`, `--secondary` |
| `--primary` | `#ff6b6b` | `--primary` |
| `--accent-entity` | `#5b9fd4` | `--ring`, `--accent` |
| `--border` | `#2a2a36` | `--border` |
| … | see design YAML | … |

**Dark only.** Set `class="dark"` on `<html>` in `+layout.svelte` or use shadcn neutral base with custom properties override.

Reconcile drift: restore hydrator accent colors (current `app.css` is desaturated grayscale).

---

## shadcn components (install list)

**P0 (must ship):** button, tooltip, dialog, input, label, form, sonner  
**P1 (ship if low friction):** separator, scroll-area  
**P2 (defer):** sheet, select, combobox

---

## Non-goals (v1)

- EntityInspector internal refactor to shadcn
- Formula editor, settings dialog content
- Mobile rail / Sheet
- Actual entity creation in runtime graph
- Light theme
- E2e test suite (project has no playwright yet)

---

## Acceptance criteria

1. **`pnpm check`** passes with zero new errors.
2. **`pnpm build`** succeeds.
3. Tailwind v4 processes via Vite; utility classes render in dev.
4. `src/lib/components/ui/button/button.svelte` exists (shadcn installed).
5. **`AppShell`** implements rail-left / viewport-center / inspector-right on desktop; matches mock topology.
6. **`WorldRail`** visible desktop-only; tooltips on all enabled icons.
7. Toolbar **Inspector** button and rail **Entities** stay in sync (`aria-pressed`).
8. **Sonner** replaces custom toast; gamepad connect shows Sonner toast; `ToastHost.svelte` deleted.
9. **AddEntityDialog** opens from rail `+`; zod rejects invalid suffix; valid submit shows success toast and closes.
10. **`app.css`** primary color is `#ff6b6b` (not white); accent-entity `#5b9fd4`.
11. **`prefers-reduced-motion: reduce`** — no inspector width transition (instant toggle).
12. Dialog: focus trap, Esc closes, `aria-labelledby` present.

---

## Test plan (manual QA)

- [ ] `just run` → load world → layout matches mock (rail + viewport + inspector right)
- [ ] Toggle inspector from toolbar and rail — same state
- [ ] Open Add entity → invalid suffix shows error → valid → success toast
- [ ] Plug gamepad → Sonner toast + toolbar indicator
- [ ] 1280px viewport width with inspector open ≥55% center column
- [ ] Mobile 375px — rail hidden, inspector bottom sheet works

---

## Executor notes

- Run shadcn-svelte init interactively or via documented flags; commit `components.json`.
- Migrate incrementally: **toast first**, then AppShell layout, then rail, then dialog.
- Keep `$lib/ui/` for app-composed shells; `$lib/components/ui/` for shadcn primitives.
- Do not edit `.trellis/`.

---

## Handoff checklist

- [x] Spec written with testable AC
- [ ] Trellis spec issue TRL-24 (sync if CLI available)
- [ ] Impl child queued for Executor
