---
version: alpha
name: Design System Unification
description: Design artifact for TRL-75 — unified shadcn token vocabulary, utilities-first migration, tweakcn-compatible swappable themes
colors:
  background: "oklch(0.145 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.205 0 0)"
  card-foreground: "oklch(0.985 0 0)"
  primary: "oklch(0.922 0 0)"
  primary-foreground: "oklch(0.205 0 0)"
  secondary: "oklch(0.269 0 0)"
  muted: "oklch(0.269 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  accent: "oklch(0.269 0 0)"
  destructive: "oklch(0.704 0.191 22.216)"
  border: "oklch(1 0 0 / 10%)"
  input: "oklch(1 0 0 / 15%)"
  ring: "oklch(0.556 0 0)"
  viewport: "oklch(0.1 0 0)"
  viewport-grid: "oklch(0.18 0 0)"
  accent-spawn: "oklch(0.75 0 0)"
  accent-entity: "oklch(0.65 0 0)"
  success: "oklch(0.696 0.17 162.48)"
  play-go: "oklch(0.62 0.19 145)"
typography:
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.02em
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  float-inset: 12px
  doc-bar-height: 32px
  status-bar-height: 22px
  left-panel-width: 280px
  right-panel-width: 320px
components:
  doc-bar:
    backgroundColor: "{colors.card}"
    color: "{colors.foreground}"
    minHeight: "calc({spacing.doc-bar-height} + 20px)"
  glass-panel:
    backgroundColor: "color-mix(in srgb, {colors.secondary} 68%, transparent)"
    borderRadius: "{rounded.lg}"
    backdropFilter: "blur(20px)"
  chrome-pill:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.pill}"
  settings-appearance:
    location: "SettingsPanel → Shell tab → Appearance section"
    fields: "color mode segment, theme preset select"
  theme-preset-card:
    size: "72px swatch + label"
    selectedRing: "2px {colors.ring}"
---

# Design: Design System Unification

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-75  
**Scope:** [design_system_unification_scope.md](./design_system_unification_scope.md)  
**Mock:** [design_system_unification_mockup.html](./design_system_unification_mockup.html)  
**Inherits:** [appshell_ui_foundation_design.md](./appshell_ui_foundation_design.md) — reconciles to current neutral Geist chrome in `src/app.css`

---

## Overview

Collapse the **dual token vocabulary** (shadcn + bespoke shell) into one **shadcn-canonical, tweakcn-compatible** system. UI chrome only — viewport grid and 3D materials stay separate.

**Audience:** builder-engineers and agents authoring worlds; future theme importers via tweakcn export blocks.

**Emotional tone:** precision instrument panel. Theme switching is a **developer preference**, not a marketing surface — controls live in Settings, not the doc bar. Preset cards use small swatches; no full-screen theme gallery in v1.

**Phases this design covers:** token unification (0), theme infra UX (1), migration rules for components (2). Phase 3 in-app editor is **out of scope** — paste-import path only.

## Colors

### Normative layers (post Phase 0)

| Layer | CSS variables | Tailwind (via `@theme inline`) | Role |
|-------|---------------|--------------------------------|------|
| **shadcn core** | `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, … | `bg-background`, `text-foreground`, `bg-card`, … | All UI surfaces, text, focus |
| **App extensions** | `--viewport`, `--viewport-grid`, `--accent-spawn`, `--accent-entity`, `--success`, `--play-go`, panel sizing | `bg-viewport`, `text-accent-entity`, … | Viewport well, semantic accents, layout |
| **Computed utilities** | `--surface-glass` (from `secondary` + alpha) | via `.glass-panel` `@utility` | Floating panels |
| **Retired aliases (Phase 0 only)** | `--surface`, `--text`, `--text-muted`, `--surface-raised`, … | map to shadcn equivalents | Thin aliases until Phase 2 complete |

### Shell → canonical retirement map

| Legacy shell token | Canonical source | Utility (target) |
|--------------------|------------------|------------------|
| `--surface` | `--background` | `bg-background` |
| `--surface-raised` | `--card` | `bg-card` |
| `--surface-overlay` | `--secondary` | `bg-secondary` |
| `--text` | `--foreground` | `text-foreground` |
| `--text-muted` | `--muted-foreground` | `text-muted-foreground` |
| `--text-mono` | new `--text-mono` extension | `text-text-mono` |
| `--border-focus` | `--ring` | `ring-ring` |
| `--primary-muted` | `color-mix(primary 12%)` | `bg-primary/12` |
| `--accent-play` | `--primary` | `bg-primary` |
| `--rounded-sm/md/lg` | `--radius-sm/md/lg` | `rounded-sm` etc. |

Semantic accents (`--accent-spawn`, `--accent-entity`, `--accent-link`, `--accent-selection`) remain **named extensions** — not in stock shadcn, but required by scene markers and inspector affordances.

### Theme presets (Phase 1 validation)

Two presets ship in design + mock:

| ID | Label | Notes |
|----|-------|-------|
| `default` | Default | Current neutral oklch grayscale (light + dark blocks) |
| `violet-bloom` | Violet Bloom | tweakcn-style preset — purple primary, warmer card, distinct ring |

Each preset = full shadcn token block under `[data-theme="…"]` with `.dark` variant. **tweakcn export paste** replaces or appends to registry — no custom JSON schema in v1.

## Typography

Unchanged from current shell: **Geist** UI, **Geist Mono** for inspector labels and doc-bar chips. Theme presets may override `--font-sans` / `--font-mono` when imported from tweakcn; app extensions `--font-ui` / `--font-mono` alias those.

| Level | Font | Size | Usage |
|-------|------|------|-------|
| UI body | Geist | 13px | Panels, buttons, fields |
| Label | Geist | 11px | Section labels, tab text |
| Mono | Geist Mono | 10–12px | Inspector field labels, mapping tables, score chip |

## Layout

No shell layout changes. Theme controls add one **Appearance** section to existing Settings → Shell tab (~120px vertical).

```
SettingsPanel (right panel, Settings tab)
├── Input | Camera | Shell  (existing tabs)
└── Shell tab
    ├── Appearance          ← NEW
    │   ├── Color mode      (Light | Dark | System)
    │   └── Theme preset    (card grid or select)
    ├── Shell chrome        (existing: stats HUD)
    └── (future) Import     ← collapsed <details> "Import tweakcn theme"
```

**Persistence:** `localStorage` keys `theme` + `mode` (mode-watcher convention). SSR: no flash via `ModeWatcher` + inline script in `+layout.svelte` (Architect).

**DOM contract:** `<html data-theme="default" class="dark">` — `data-theme` selects preset; `.dark` selects color mode within preset (or system-derived).

## Elevation & Depth

Existing patterns preserved; tokens only:

| Pattern | Class / utility | Token deps |
|---------|-----------------|------------|
| Viewport well | `bg-viewport` | `--viewport`, `--viewport-grid` |
| Doc bar | `bg-card` | `--card` |
| Floating panel | `.glass-panel` | `--secondary` glass mix, `--border` |
| Bottom chrome | `.chrome-pill` | `--secondary`, `--border` |
| Inspector accordion | shadcn Accordion | `--card`, `--border`, `--muted-foreground` |

Inset hierarchy unchanged — theme swap must not alter panel float positions or z-index stack.

## Shapes

Radii flow from shadcn `--radius` + extensions `--radius-sm/md/lg`. tweakcn imports may change `--radius`; app `--rounded-*` aliases retire to `--radius-*` in Phase 0.

## Components

| Component | Anatomy | States | Maps to codebase |
|-----------|---------|--------|------------------|
| **Appearance section** | Section label + 2 field rows | default | New block in `SettingsPanel.svelte` Shell tab |
| **Color mode control** | `ToggleGroup` 3 segments: Light, Dark, System | light / dark / system | `mode-watcher` + theme store; mirrors shadcn Sonner `theme={mode.current}` |
| **Theme preset picker** | Horizontal row of preset cards (swatch + name) or `Select` on narrow widths | default, selected (ring), hover | New `ThemePresetPicker.svelte`; registry in `src/lib/ui/theme/` |
| **Preset swatch** | 24×24 rounded square, 4-quadrant color sample (bg, primary, card, border) | selected: `ring-2 ring-ring` | Mock + future component |
| **Import tweakcn** | `<details>` + monospace `<textarea>` + Apply button | closed default; invalid shows toast error | Phase 1 optional; validates token keys against shadcn set |
| **Doc bar** | Scene selector, mode tabs, presence | unchanged | `DocBar.svelte` — migrate colors to utilities |
| **Glass panel** | blur + border | unchanged geometry | `app.css` `.glass-panel` → `@utility glass-panel` |
| **Inspector field** | label + control row | unchanged | `InspectorField.svelte` — `text-muted-foreground` not `var(--text-muted)` |

## Interaction matrix

| Input | States | Output |
|-------|--------|--------|
| Color mode → Light | `class` removes `.dark` on `<html>` | All chrome re-renders with light token block for active `data-theme` |
| Color mode → Dark | adds `.dark` | Dark token block |
| Color mode → System | mode-watcher follows `prefers-color-scheme` | Toggles `.dark` automatically |
| Theme preset card click | `data-theme` attribute updates | CSS cascade swaps full token block; `localStorage.theme` persists |
| Import tweakcn → Apply | textarea has `:root { … }` block | Parser extracts vars; registers as `custom-<slug>`; selects it; toast success/fail |
| Page load | read storage + system | No flash: inline head script sets `data-theme` + `class` before paint |
| Play mode | theme controls hidden (settings panel hidden) | No mid-play theme change — acceptable |

## Accessibility

- **Focus order:** Settings tab → Shell sub-tab → Appearance fields → preset cards (roving tabindex on card grid).
- **Labels:** Color mode `ToggleGroup` `aria-label="Color mode"`. Preset grid `aria-label="Theme preset"`. Each card `aria-label="{preset name}"` + `aria-pressed` when selected.
- **Motion:** Theme switch is instant CSS var swap — no transition on colors. `prefers-reduced-motion` unchanged from global `app.css` rule.
- **Contrast:** Imported tweakcn presets are user-supplied — v1 does not validate WCAG; show non-blocking warning toast if primary/background contrast &lt; 4.5:1 (Architect optional AC).

## Migration rules (Phase 2)

**Utilities-first, tokens always:**

| Keep `<style>` | Migrate to utilities |
|----------------|----------------------|
| `::-webkit-color-swatch`, `backdrop-filter` pairs | `flex`, `gap`, `padding`, `min-h-0`, `overflow-auto` |
| `:global(.inspector-label-text)` shadcn overrides | `bg-card`, `text-foreground`, `border-border` |
| Complex `calc()` grid (doc-bar optical padding) | Simple rows/cols |
| `.glass-panel` / `.chrome-pill` | Move to `@utility` in `app.css` — single definition |

**Never:** raw hex in components; new `--surface` / `--text` references after Phase 0.

**Order:** leaf components first (`DocBar`, `StatusBar`, `ShellModeTabs`) → panels (`SettingsPanel`, `EntityList`) → scene overlays last.

## Do's and Don'ts

**Do**

- Expose every token through `@theme inline`.
- Keep tweakcn blocks copy-paste compatible (standard shadcn var names, oklch).
- Use shadcn `ToggleGroup` / `Select` for appearance controls.
- Alias legacy shell vars during Phase 0–2 transition.

**Don't**

- Put theme picker in doc bar or play-mode HUD.
- Touch `src/lib/components/ui/*` vendored primitives.
- Theme-sync 3D materials (`artStyles.ts`) in this wedge.
- Build in-app color editor (Phase 3 optional).

## Open for Architect

1. **Theme store API:** `setTheme(id)`, `setMode('light'|'dark'|'system')`, `registerTheme(block)`, `themes: Record<string, ThemeMeta>`.
2. **tweakcn parser scope:** Accept `:root` and `[data-theme]` blocks; strip comments; warn on unknown keys; require `--background` + `--foreground` minimum.
3. **Phase split:** Recommend 3 spec children — TRL-75/0 tokens, TRL-75/1 infra, TRL-75/2 component migration checklist (39 files ordered).
4. **Light mode tokens:** Design includes light blocks for `default` + `violet-bloom` in mock CSS — Architect copies values into `app.css`.
5. **Import UI:** Ship collapsed `<details>` in Shell tab or defer to Phase 1.1 — non-blocking; preset picker is required.

## Handoff checklist

- [x] `docs/artifacts/design_system_unification_design.md` (this file)
- [x] `docs/artifacts/design_system_unification_mockup.html` (interactive theme + mode)
- [ ] Trellis design issue TRL-76 (create on graph if CLI available)
