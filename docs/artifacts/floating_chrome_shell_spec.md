---
version: 1
name: Floating Viewport Chrome
parent: floating-chrome-shell (design)
design: docs/artifacts/floating_chrome_shell_design.md
mock: docs/artifacts/floating_chrome_shell_mockup.html
status: queue-ready
---

# Spec: Floating Viewport Chrome

**Parent:** AppShell evolution (post–TRL-23 foundation)  
**Design:** [floating_chrome_shell_design.md](./floating_chrome_shell_design.md)  
**Mock:** [floating_chrome_shell_mockup.html](./floating_chrome_shell_mockup.html)

---

## Summary

Refactor **`AppShell`** from docked left columns (rail + sidebar shrink viewport) to **full-bleed viewport** with **floating glass chrome**: rail pill (always visible desktop), sidebar panel (entities/assets), attributes panel (existing top-right float). Toolbar remains **docked**. No new rail affordances; no inspector field changes.

---

## Architect decisions (closes design open questions)

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| PR scope | **Single PR** — layout + glass styling together | Avoid half-migrated docked/glass mix |
| Route on inspector close | **Preserve `ui.railRoute`** | Sidebar hides; reopening inspector restores same panel (entities vs assets) |
| Mobile | **Defer** — keep existing `@media (max-width: 767px)` stacked grid | Desktop-first wedge; no bottom sheet work |
| Grid columns | **Remove** `inspector-open` column template on desktop | Viewport width constant; floats overlay |
| Shared glass | **Extract** optional `.glass-panel` utility or shared CSS block in `app.css` | DRY between rail pill, sidebar, attributes |
| Esc cancel pick | **Defer** | Not blocking layout wedge |

---

## CSS variables (`src/app.css`)

Add to `:root`:

```css
--float-inset: 16px;        /* alias existing --spacing-md if preferred */
--rail-pill-width: 44px;
--sidebar-width: 200px;     /* align with --inspector-width or replace it */
```

**Deprecate for layout:** `--inspector-width` as grid column (may remain as `--sidebar-width` semantic alias).

**Keep:** `--attributes-width`, `--toolbar-height`, `--surface-glass`, `--radius-lg`.

---

## Layout spec (`AppShell.svelte`)

### Desktop (≥768px)

```
grid-template-rows: var(--toolbar-height) 1fr
grid-template-columns: 1fr          /* always — no inspector-open variant */
```

| Layer | Placement | z-index |
| ----- | --------- | ------- |
| `main` (viewport) | grid row 2, col 1, `position: relative` | 0 (canvas inside) |
| `.app-rail-float` | `absolute`; `top/left: var(--float-inset)` | 18 |
| `.app-sidebar-float` | `absolute`; `top: var(--float-inset)`; `left: calc(var(--float-inset) + var(--rail-pill-width) + var(--spacing-sm))` | 19 |
| `.app-attributes-float` | existing top-right | 20 |

**Visibility rules:**

| Element | Condition |
| ------- | --------- |
| Rail pill | always (desktop) |
| Sidebar float | `world.inspectorOpen && ui.railRoute !== 'world'` |
| Attributes float | `world.inspectorOpen` (unchanged) |

**Pointer events:**

- Float **wrappers**: `pointer-events: none`
- Panel **content** (glass inner): `pointer-events: auto`

**Remove:** `.app-shell.inspector-open` grid column rules; `.app-rail` grid column; `.app-entity-list` grid column.

**Move** rail + sidebar snippets inside `.app-viewport` as absolute children (or sibling overlays within viewport cell).

### Mobile (<768px)

**No change** to current behavior in this wedge:

- Rail hidden
- Inspector open → stacked rows (sidebar row + viewport row)
- Attributes bottom-right float

Executor must not regress mobile layout while refactoring desktop.

---

## Glass panel recipe

Apply to rail pill wrapper, sidebar wrapper, and ensure EntityList/AssetsPanel match EntityAttributes:

```css
background: var(--surface-glass);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
border-radius: var(--radius-lg);
box-shadow:
  0 4px 24px rgb(0 0 0 / 0.28),
  inset 0 1px 0 rgb(255 255 255 / 0.04);
```

**Rail pill:** width `var(--rail-pill-width)`; padding `var(--spacing-sm) 0`; flex column; gap 4px.

**Sidebar float:** width `var(--sidebar-width)`; `max-height: calc(100% - var(--float-inset) * 2)`.

---

## Component changes

| File | Change |
| ---- | ------ |
| `AppShell.svelte` | Single-column body; rail + sidebar absolute in viewport; enter/exit transitions |
| `WorldRail.svelte` | Remove full-height `.rail` dock styles (`border-right`, `height: 100%`); root is pill content only — glass wrapper lives in AppShell |
| `EntityList.svelte` | Remove `border-right`, solid `surface` dock; transparent/glass — shell provides chrome |
| `AssetsPanel.svelte` | Same as EntityList |
| `EntityAttributes.svelte` | No position change; may drop duplicate outer glass if AppShell wrapper added (avoid double border) |
| `WorldShell.svelte` | No snippet signature change |

---

## Motion

Sidebar + attributes when appearing/disappearing:

```css
transition: opacity 180ms ease, transform 180ms ease;
/* hidden */ opacity: 0; transform: translateY(4px); pointer-events: none;
/* visible */ opacity: 1; transform: translateY(0);
```

Rail pill: **no** enter animation.

```css
@media (prefers-reduced-motion: reduce) {
  .app-sidebar-float, .app-attributes-float { transition: none; }
}
```

Use `{#if}` with transition or CSS class toggle — either acceptable if motion AC met.

---

## Interaction (unchanged logic — verify after layout move)

| Input | Expected |
| ----- | -------- |
| Rail World | `railRoute='world'`; deselect; sidebar hidden if inspector closed |
| Rail Entities | toggle inspector; `railRoute='entities'` |
| Rail Assets | open inspector; `railRoute='assets'` |
| Toolbar Inspector | sync with entities rail behavior |
| Viewport click | does **not** close floats |

---

## Accessibility

- Rail pill: `nav[aria-label="Tool rail"]` — preserve
- Sidebar: `role="complementary"` + `aria-label="Entity list"` or `"Asset library"` based on route
- Attributes: `aria-label="Entity attributes"` — preserve
- Focus order unchanged per design
- Hidden floats: `aria-hidden="true"` when not visible OR remove from tab order via `{#if}` (preferred)

---

## Acceptance criteria

1. **`pnpm check`** — 0 errors  
2. **`pnpm build`** — succeeds  
3. **Viewport width stable:** On desktop (≥768px), toggling inspector open/closed does **not** change `.app-viewport` computed width (manual: DevTools → compare before/after)  
4. **Grid:** `.app-body` uses `grid-template-columns: 1fr` only on desktop — no `inspector-open` multi-column template  
5. **Rail pill:** Visible top-left over canvas; glass styling; 44px wide; Lucide icons unchanged  
6. **Sidebar float:** Visible when inspector open AND route is `entities` or `assets`; positioned left of attributes with 8px gap after rail pill  
7. **Glass parity:** EntityList and AssetsPanel visually match attributes glass (blur, border, radius, shadow) — no docked `border-right` column  
8. **Z-index stack:** rail 18 < sidebar 19 < attributes 20  
9. **Pointer events:** Clicks pass through float wrapper gaps to canvas; panel buttons/list items remain clickable  
10. **Motion:** Sidebar/attributes fade+slide 180ms; instant when `prefers-reduced-motion: reduce`  
11. **Mobile regression:** At `<768px`, inspector toggle still usable (stacked layout preserved)  
12. **Existing flows:** Entity selection, add-entity dialog, asset pick from mesh field still work after layout change  

---

## Verification script (manual QA)

1. Open `/?game=` default world at 1280×800  
2. Note viewport canvas element width → toggle Inspector → width **unchanged**  
3. Rail pill visible; click Entities → sidebar appears with glass  
4. Click Assets → sidebar shows asset library  
5. Click World → sidebar hides (inspector still open) or per route rules  
6. Select entity → attributes float visible top-right  
7. Click canvas → entity pick still works; floats stay open  
8. Open mock side-by-side: [floating_chrome_shell_mockup.html](./floating_chrome_shell_mockup.html)

---

## Out of scope

- Toolbar float  
- Merging rail into sidebar  
- Mobile bottom sheet / floating rail on mobile  
- Esc to cancel asset pick  
- e2e tests (none exist yet for this app)

---

## Handoff checklist

- [x] `docs/artifacts/floating_chrome_shell_spec.md` (this file)
- [ ] Trellis spec issue (CLI failed — Strategist sync)
- [ ] Impl child queued for Executor
