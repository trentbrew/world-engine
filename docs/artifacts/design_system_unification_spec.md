---
version: 1
name: Design System Unification
parent: TRL-75
design: docs/artifacts/design_system_unification_design.md
mock: docs/artifacts/design_system_unification_mockup.html
scope: docs/artifacts/design_system_unification_scope.md
status: queue-ready
phases:
  - id: phase0
    title: Token unification
    trellis: TRL-76
  - id: phase1
    title: Theme infrastructure
    trellis: TRL-77
  - id: phase2
    title: Component migration
    trellis: TRL-78
---

# Spec: Design System Unification

**Design:** [design_system_unification_design.md](./design_system_unification_design.md)  
**Mock:** [design_system_unification_mockup.html](./design_system_unification_mockup.html)  
**Scope:** [design_system_unification_scope.md](./design_system_unification_scope.md)  
**Trellis:** TRL-75 (proposal) → TRL-76 / TRL-77 / TRL-78 (phased specs)  
**Out of scope:** `src/lib/components/ui/*` (vendored shadcn); 3D materials (`artStyles.ts`, Threlte scene palette); in-app tweakcn color editor (Phase 3)

---

## Summary

Unify **two parallel CSS token vocabularies** into one shadcn-canonical, tweakcn-compatible system; stand up **swappable `[data-theme]` presets** with light/dark via `mode-watcher`; migrate **~40 non-vendored components** from bespoke shell `var(--text)` / `<style>` color refs to Tailwind utilities + unified tokens.

**Ship order:** Phase 0 → Phase 1 → Phase 2 (incremental, each phase independently shippable).

---

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Spec split | **3 child specs** TRL-76/77/78 | Designer recommendation; reversible phases |
| tweakcn import UI | **Defer** to post-Phase-1 follow-up | Preset picker required; paste-import optional |
| WCAG contrast on import | **Defer** | v1 user-supplied presets; no validator |
| Theme control location | **SettingsPanel → Shell → Appearance** | Design locked |
| Default theme id | `default` | Matches `data-theme` in mock |
| Second validation preset | `violet-bloom` | Values from mock CSS |
| Legacy shell aliases | **Keep through Phase 2**; remove Phase 3 | Zero-break migration |
| `.glass-panel` / `.chrome-pill` | Move to `@utility` in Phase 0 | Single source; components use class unchanged |
| `html` attrs | `data-theme` + `.dark` class | Orthogonal preset × mode |
| Persistence keys | `localStorage`: `theme`, `mode` (mode-watcher defaults) | SSR script reads same keys |
| Component migration purity | **Pragmatic** — utilities-first; `<style>` OK for pseudo-elements, `:global` shadcn overrides, complex `calc()` | Design locked |

---

## Phase 0 — Token unification (TRL-76)

### Goal

One source of truth in `src/app.css`: shadcn core + app extensions, all exposed via `@theme inline`. Legacy shell names become **read-only aliases**.

### `src/app.css` — normative token layers

#### 1. shadcn core (`:root` / `.dark`)

Keep existing dark neutral values on `:root` (current behavior). Add **complete light blocks** for `[data-theme="default"]` without `.dark` per mock (`design_system_unification_mockup.html` lines 30–54). Finish `.dark` under `[data-theme="default"].dark` (current `:root` values).

Phase 1 adds `[data-theme="violet-bloom"]` blocks; Phase 0 may stub `data-theme` attribute support with only `default` or prep both — **Phase 0 minimum:** `:root` tokens unchanged visually; extensions + `@theme` only.

#### 2. App extensions (canonical — not aliases)

Add/maintain on theme root:

| Variable | Purpose |
| -------- | ------- |
| `--viewport`, `--viewport-grid` | 3D viewport well + grid |
| `--accent-spawn`, `--accent-entity`, `--accent-link`, `--accent-selection` | Semantic UI accents |
| `--text-mono` | Mono label tint |
| `--success`, `--play-go`, `--play-go-foreground` | Play / success chrome |
| `--surface-glass` | Glass panel computed mix |
| `--doc-bar-height`, `--doc-bar-pad-*`, `--stage-inset`, `--tool-pill-height` | Doc bar optical layout |
| `--left-panel-width`, `--right-panel-width`, `--view-bar-height` | Panel defaults (runtime-overridable) |
| `--gizmo-size`, `--gizmo-well-size`, `--view-toggle-gutter`, `--view-controls-height` | View controls |
| `--status-bar-height`, `--float-inset`, `--popover-width` | Chrome spacing |
| `--font-ui`, `--font-mono` | Alias `--font-sans` / mono when present |
| `--radius-sm`, `--radius-md`, `--radius-lg` | Canonical radii (shadcn `--radius` base) |

#### 3. Legacy aliases (thin — retire Phase 3)

```css
--surface: var(--background);
--surface-raised: var(--card);
--surface-overlay: var(--secondary);
--text: var(--foreground);
--text-muted: var(--muted-foreground);
--border-focus: var(--ring);
--primary-muted: color-mix(in srgb, var(--primary) 12%, transparent);
--accent-play: var(--primary);
--accent-play-foreground: var(--primary-foreground);
--rounded-sm: var(--radius-sm);
--rounded-md: var(--radius-md);
--rounded-lg: var(--radius-lg);
--rounded-pill: 999px;
```

#### 4. `@theme inline` extensions

Expose **all** canonical tokens as Tailwind colors/spacing as applicable:

```css
--color-viewport: var(--viewport);
--color-viewport-grid: var(--viewport-grid);
--color-accent-spawn: var(--accent-spawn);
--color-accent-entity: var(--accent-entity);
--color-accent-link: var(--accent-link);
--color-accent-selection: var(--accent-selection);
--color-text-mono: var(--text-mono);
--color-success: var(--success);
--color-play-go: var(--play-go);
--color-play-go-foreground: var(--play-go-foreground);
/* spacing/radius: mirror existing + extensions */
```

Verify utilities compile: `bg-viewport`, `text-muted-foreground`, `rounded-lg`, etc.

#### 5. Utilities migration

Convert `.glass-panel` and `.chrome-pill` class rules to Tailwind v4 `@utility glass-panel` / `@utility chrome-pill` with identical computed styles.

`html, body` may keep `var(--viewport)` / `var(--foreground)` or switch to `bg-viewport text-foreground` — visual parity required.

### Phase 0 file touch list

| Action | Path |
| ------ | ---- |
| Extend | `src/app.css` — tokens, aliases, `@theme inline`, `@utility` |
| Verify | No component file changes required for ship (aliases preserve behavior) |

### Phase 0 acceptance criteria

- [ ] `pnpm check` passes.
- [ ] `pnpm test:e2e e2e/smoke.spec.ts` passes (no visual regression gate — smoke only).
- [ ] Every app extension token in §2 exists on `:root` and is listed in `@theme inline`.
- [ ] Legacy shell aliases in §3 resolve without duplicate literal colors.
- [ ] `bg-background`, `bg-card`, `bg-viewport`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring` utilities usable in a test class or documented grep.
- [ ] `.glass-panel` / `.chrome-pill` render identically (blur, border, radius) via `@utility`.
- [ ] **No** edits under `src/lib/components/ui/*`.

---

## Phase 1 — Theme infrastructure (TRL-77)

**Depends on:** TRL-76 merged.

### Theme module

New directory `src/lib/ui/theme/`:

| File | Responsibility |
| ---- | -------------- |
| `themes.css` or blocks in `app.css` | `[data-theme="default"]` light/dark + `[data-theme="violet-bloom"]` light/dark — copy values from mock |
| `registry.ts` | `ThemeMeta { id, label, swatchColors }[]` — `default`, `violet-bloom` |
| `theme.svelte.ts` | `themeId`, `setTheme(id)`, sync `document.documentElement.dataset.theme`, `localStorage.theme` |
| `parseTweakcn.ts` | *(stub OK)* export function for future import; not wired to UI in v1 |

### Layout integration

**`src/routes/+layout.svelte`:**

1. Import `ModeWatcher` from `mode-watcher` and render (track class on `<html>`).
2. Inline blocking script in `<svelte:head>` (or `app.html` if needed) sets `data-theme` + `class` from `localStorage` before first paint — pattern from mode-watcher docs.
3. Bind theme store init on mount.

**`src/routes/+layout.ts` or layout script:** optional `ssr` no-flash — follow mode-watcher SvelteKit recipe.

### UI components

| Component | Path | Behavior |
| --------- | ---- | -------- |
| `ThemePresetPicker` | `src/lib/ui/theme/ThemePresetPicker.svelte` | Card grid; `aria-label="Theme preset"`; `aria-pressed` on selected |
| Appearance section | `SettingsPanel.svelte` Shell tab | Section label + color mode `ToggleGroup` + `ThemePresetPicker` |
| Color mode | shadcn `ToggleGroup` | Light / Dark / System; wires `mode-watcher` `mode` store |

Color mode `ToggleGroup`: `aria-label="Color mode"`.

### DOM contract

```html
<html data-theme="default" class="dark">
```

- `data-theme` ∈ registered theme ids.
- `.dark` present iff effective mode is dark (explicit or system).

### Phase 1 file touch list

| Action | Path |
| ------ | ---- |
| Create | `src/lib/ui/theme/*` |
| Extend | `src/app.css` or `themes.css` — preset token blocks |
| Extend | `src/routes/+layout.svelte` — ModeWatcher + init |
| Extend | `src/lib/ui/SettingsPanel.svelte` — Appearance section |
| Verify | `src/lib/components/ui/sonner/sonner.svelte` — `theme={mode.current}` still valid |

### Phase 1 acceptance criteria

- [ ] `pnpm check` passes.
- [ ] `pnpm test:e2e e2e/smoke.spec.ts` passes.
- [ ] **Label `needs-e2e`:** add `e2e/theme.spec.ts` (or extend smoke) — open Settings → Shell → switch preset to `violet-bloom` → assert `document.documentElement.dataset.theme === 'violet-bloom'`.
- [ ] Color mode Light removes `.dark` on `<html>`; Dark adds it; System follows `prefers-color-scheme` (manual or Playwright `emulateMedia`).
- [ ] Reload preserves `theme` + `mode` in `localStorage`.
- [ ] No visible flash of wrong theme on cold load (manual check; script present in layout).
- [ ] Appearance controls **not** in doc bar.
- [ ] tweakcn import `<details>` **absent** or inert stub (deferred).

---

## Phase 2 — Component migration (TRL-78)

**Depends on:** TRL-77 merged.

### Migration rule (normative)

For each file in touch list:

1. Replace `var(--text)` → `var(--foreground)` or Tailwind `text-foreground`.
2. Replace `var(--text-muted)` → `text-muted-foreground`.
3. Replace `var(--surface*)` color refs → shadcn equivalents.
4. Replace layout-only `<style>` with Tailwind utilities on elements where readability is preserved.
5. **Keep** `<style>` for: `::-webkit-*`, `:global(...)`, complex multi-line `calc()` (doc-bar optical padding), backdrop-filter pairs if not in `@utility`.
6. **Never** introduce raw hex or new `--surface`/`--text` references.

### Migration order (40 files)

**Wave 1 — leaf chrome (13)**

1. `src/lib/ui/DocBar.svelte`
2. `src/lib/ui/StatusBar.svelte`
3. `src/lib/ui/ShellModeTabs.svelte`
4. `src/lib/ui/SceneSelector.svelte`
5. `src/lib/ui/RoomPresenceBar.svelte`
6. `src/lib/ui/PlayModeExitButton.svelte`
7. `src/lib/ui/ShareButton.svelte`
8. `src/lib/ui/PeerAvatarStack.svelte`
9. `src/lib/ui/LoadingOverlay.svelte`
10. `src/lib/ui/PanelResizeHandle.svelte`
11. `src/lib/ui/InspectorEmptyState.svelte`
12. `src/lib/ui/InputHud.svelte`
13. `src/lib/ui/UsernameDialog.svelte`

**Wave 2 — popovers + view controls (4)**

14. `src/lib/ui/ViewControls.svelte`
15. `src/lib/ui/OrbitPopover.svelte`
16. `src/lib/ui/CameraPopover.svelte`
17. `src/lib/ui/PeerSelectionLabelOverlay.svelte`

**Wave 3 — panels (11)**

18. `src/lib/ui/LeftPanel.svelte`
19. `src/lib/ui/RightPanel.svelte`
20. `src/lib/ui/SettingsPanel.svelte` *(Appearance from Phase 1 — migrate remaining styles)*
21. `src/lib/ui/EntityList.svelte`
22. `src/lib/ui/AssetsPanel.svelte`
23. `src/lib/ui/AssetItem.svelte`
24. `src/lib/ui/AssetThumbnail.svelte`
25. `src/lib/ui/AssetDropzone.svelte`
26. `src/lib/ui/SceneInspector.svelte`
27. `src/lib/ui/InspectorField.svelte`
28. `src/lib/ui/InspectorAccordion.svelte`

**Wave 4 — entity inspectors (5)**

29. `src/lib/ui/EntityInspector.svelte`
30. `src/lib/ui/EntityAttributes.svelte`
31. `src/lib/ui/EntityOpsPanel.svelte`
32. `src/lib/ui/EntitySchemaPanel.svelte`
33. `src/lib/ui/EntityGraphPanel.svelte`

**Wave 5 — shell layout (2)**

34. `src/lib/ui/AppShell.svelte`
35. `src/lib/ui/WorldShell.svelte`

**Wave 6 — scene fields + viewport (5)**

36. `src/lib/ui/scene/ShadersSceneFields.svelte`
37. `src/lib/ui/scene/CameraSceneFields.svelte`
38. `src/lib/scene/WorldViewport.svelte`
39. `src/lib/scene/PlacementBanner.svelte`
40. `src/lib/scene/PlacementSession.svelte`

Total: 13 + 4 + 11 + 5 + 2 + 5 = **40 files**

### Phase 2 acceptance criteria

- [ ] `pnpm check` passes.
- [ ] `pnpm test:e2e e2e/smoke.spec.ts` passes.
- [ ] `pnpm test:e2e e2e/theme.spec.ts` passes (from Phase 1).
- [ ] Grep: no `var(--text)` or `var(--text-muted)` in `src/lib/ui/**` or `src/lib/scene/**` (exclude `components/ui`).
- [ ] Grep: no `var(--surface` in same paths (aliases unused in components).
- [ ] Each wave file: `<style>` block removed **or** contains only allowed patterns (pseudo, `:global`, calc) — no color literals hex/rgb outside `var(--*)`.
- [ ] Edit + play mode smoke: shell renders; panels toggle; no console errors.
- [ ] Theme switch still works after migration.

### Phase 2 non-goals

- Delete legacy aliases from `app.css` (Phase 3)
- Lint rule for hex (Phase 3)
- tweakcn paste UI

---

## Cross-phase regression

| Check | Command |
| ----- | ------- |
| Types | `pnpm check` |
| Smoke | `pnpm test:e2e e2e/smoke.spec.ts` |
| Theme | `pnpm test:e2e e2e/theme.spec.ts` (Phase 1+) |

---

## Handoff checklist

- [x] Spec artifact at `docs/artifacts/design_system_unification_spec.md`
- [ ] Trellis TRL-76/77/78 created with mirrored AC
- [ ] Impl TRL-79 (Phase 0) queued for Executor
