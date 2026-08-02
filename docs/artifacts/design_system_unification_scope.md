# Design System Unification — Scope

**Goal:** collapse the current Tailwind + vanilla-CSS hybrid into a single,
standardized Tailwind-token system with first-class support for multiple
swappable UI themes (tweakcn-style).

**Target reference:** [tweakcn](https://github.com/jnsahaj/tweakcn) — a visual
editor for shadcn/ui CSS-variable themes (colors in oklch, radius, fonts,
shadows) that exports a token block you paste into your global stylesheet.

---

## 1. Diagnosis — what's actually causing the pain

The friction isn't simply "Tailwind vs vanilla CSS." The repo already runs
**Tailwind v4 (CSS-config) + shadcn-svelte** with ~60 vendored UI primitives.
The real problem is **two parallel token vocabularies plus styling that bypasses
the utility layer**:

### a) Two token systems in `src/app.css`

| Layer | Examples | Consumed by | Exposed to Tailwind? |
|---|---|---|---|
| **shadcn tokens** | `--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring` | Tailwind utilities (`bg-background`, `text-foreground`) via `@theme inline` | ✅ yes |
| **bespoke "shell" tokens** | `--surface`, `--surface-overlay`, `--text`, `--text-muted`, `--accent-entity`, `--accent-spawn`, `--rounded-*`, `--spacing-*`, panel sizing | hand-written `<style>` blocks (`var(--text)`) | ❌ no |

The shell layer *partially aliases* the shadcn layer
(`--surface: var(--background)`, `--text: var(--foreground)`), so a single color
decision can live in **two names across two systems**. Debugging means tracing
which vocabulary a value came from and which layer overrode it.

### b) ~39 components carry vanilla `<style>` blocks

39 non-vendored `.svelte` files (in `src/lib/ui` and `src/lib/scene`) have
`<style>` blocks. They are mostly **layout** (flexbox/sizing/overflow) plus
**color refs into the shell tokens**. They bypass Tailwind utilities entirely,
so the same visual decision is expressed in two idioms depending on the file.
(The vendored `src/lib/components/ui/*` are shadcn-managed and already
token-driven — leave them alone.)

### c) Theming is effectively non-functional today

- `:root` is **hardcoded dark** — there is no light token block and `.dark` only
  sets `color-scheme`.
- `mode-watcher` is installed **but never mounted** (`ModeWatcher` appears in no
  component; `+layout.svelte` doesn't render it).
- No `data-theme`, no theme registry, no persistence. There is currently **no
  path to a second theme**.

---

## 2. Target state

1. **One token vocabulary** — the standard shadcn set, extended with the handful
   of genuinely app-specific tokens (`--viewport`, `--viewport-grid`, panel
   sizing, spacing, fonts). *All* of it exposed through `@theme inline`, so every
   token is reachable both as a Tailwind utility **and** as a `var()`.
2. **Utilities-first components** — `<style>` reserved only for what utilities
   can't cleanly express (`::-webkit-*` pseudo-elements, a few `:global`
   shadcn overrides, genuinely complex layout).
3. **Swappable themes** — each theme is a token block scoped by
   `[data-theme="…"]` (× `.dark` variant), in the **exact shadcn shape tweakcn
   exports** — so tweakcn presets can be imported/exported directly. Driven by a
   small theme store + `mode-watcher` for persistence/SSR.

Because the project already uses canonical shadcn token names, **tweakcn theme
exports are drop-in compatible** the moment the bespoke shell layer is retired.

---

## 3. Migration plan (phased, incremental, shippable)

### Phase 0 — Token unification *(foundation; ~half day; low risk, reversible)*
- Fold the shell tokens onto the shadcn set; add the truly-app-specific ones as
  named extensions (`--viewport`, sizing, spacing, fonts).
- Expose the full set via `@theme inline` so everything becomes a utility.
- Keep the old `--surface`/`--text`/… names as thin aliases initially → **nothing
  breaks**, but every value now has one source of truth and a utility form.
- **This is the highest-leverage step and the unlock for everything else.**

### Phase 1 — Theme infrastructure *(~1 day)*
- Mount `ModeWatcher` in `+layout.svelte`.
- Add a **light** token block + finish the `.dark` block.
- Add `[data-theme]` switching, a small theme registry, and persistence.
- Validate with two themes: current default + one imported tweakcn preset.

### Phase 2 — Component migration *(the bulk; ~2–4 days, fully incremental)*
- Convert `<style>` blocks to utilities, leaf/smallest components first.
- Pragmatic rule (not utility purism): **utilities-first, vanilla allowed for
  layout when it's genuinely clearer, tokens always.** Keep `.glass-panel` /
  `.chrome-pill` as `@utility` or component classes.
- Ships file-by-file; no big-bang cutover.

### Phase 3 — Polish & guardrails *(optional / ongoing)*
- Remove the dead shell-token aliases once Phase 2 is done.
- Optional in-app tweakcn-style theme editor (or just adopt their export format).
- Lint rule to block new raw hex / off-token vanilla color.

---

## 4. Sizing & risk

| Phase | Effort | Risk | Reversible? |
|---|---|---|---|
| 0 Token unification | ~½ day | Low | Yes |
| 1 Theme infra | ~1 day | Low | Yes |
| 2 Component migration | ~2–4 days (39 files, many tiny) | Low, incremental | Per-file |
| 3 Polish/tooling | optional | Low | — |

**Notes & boundaries**
- Don't touch vendored `components/ui/*` (regenerate-able, already token-driven).
- 3D / Threlte material colors (`artStyles.ts`, scene materials) are a **separate
  concern** from UI chrome — out of scope unless you also want theme-driven scene
  colors (could be a Phase 4).
- Recommend pragmatic mixing over 100% utility purity — layout-heavy blocks stay
  readable in vanilla as long as they consume unified tokens.

---

## 5. Decisions

1. **How far? → Full migration (Phases 0–2, locked).** Unify tokens, stand up
   multi-theme infra, *and* convert all ~39 component `<style>` blocks to
   utilities. Phase 2 ships incrementally, leaf-first.
2. **Theme-drive the 3D scene? → No (locked).** UI chrome only. Threlte material
   colors / `artStyles.ts` / scene palette stay out of scope. (Could become a
   future Phase 4 if desired.)
3. **tweakcn integration depth → open.** Default: consume tweakcn's export
   format (presets paste straight into the token blocks). An in-app editor is a
   later, optional add.

**Status:** scoped, not started. Resume here when ready to begin Phase 0.
