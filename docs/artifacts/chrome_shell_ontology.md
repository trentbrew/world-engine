---
version: 1
name: Chrome Shell Ontology
status: active
---

# Chrome Shell Ontology

Formal contract for **floating editor chrome** — rail, doc bar, side panels,
bottom shelf, and center content wells. All shell surfaces share one geometry
ladder and one glass recipe; opacity tiers signal hierarchy only.

**Canonical implementation:** `src/app.css` (tokens + utilities) ·
`src/lib/ui/AppShell.svelte` (layout) · `src/lib/ui/ui.svelte.ts` (runtime px
constants that must match CSS).

---

## Two-user impact

| User        | What breaks when chrome drifts                                                 |
| ----------- | ------------------------------------------------------------------------------ |
| **Builder** | Misaligned columns feel “broken”; duplicate glass recipes slow every new panel |
| **Player**  | N/A in edit chrome — but inconsistent edit shell erodes trust before play      |

---

## Geometry ladder

All distances derive from two base tokens:

| Token                | Default                         | Role                                                   |
| -------------------- | ------------------------------- | ------------------------------------------------------ |
| `--chrome-edge`      | `var(--float-inset)` (12px)     | Viewport **outer** inset — screen edge → chrome column |
| `--chrome-inner-gap` | `var(--chrome-float-gap)` (6px) | **Between** adjacent chrome cards                      |

Aliases (same value, semantic name):

- `--chrome-rail-gap` = `--chrome-inner-gap` (rail column → first panel / doc
  bar)
- `--chrome-panel-gap` = `--chrome-inner-gap` (panel → center column)

### Vertical bands

```
┌─ viewport top
│  [--chrome-edge--]
│  [ doc bar card  ]  height: --doc-bar-chrome-height
│  [--chrome-inner-gap--]
│  [ left panel    ]  top: --chrome-top-outer
│  [ center well   ]
│  [ bottom shelf  ]  height: --bottom-chrome-height
│  [--chrome-edge--]  bottom outer (--chrome-bottom-outer)
└─ viewport bottom
```

`--chrome-top-outer` = `edge + doc-bar-chrome-height + inner-gap`

### Horizontal alignment (left rail)

All cards in the **content column** (doc bar, left panel, center well left edge)
share the same **card origin**:

```
card-left = chrome-edge + rail-width + chrome-inner-gap
```

Doc bar column starts at `rail-width + chrome-edge` but its **card** uses
`padding-left: chrome-inner-gap` (not `chrome-edge`).

### Rail card

| Token               | Value                    | Notes                        |
| ------------------- | ------------------------ | ---------------------------- |
| `--rail-card-width` | 56px                     | Logo square + nav card width |
| `--rail-width`      | `var(--rail-card-width)` | Runtime column width         |

Logo card and nav card are both `var(--rail-card-width)` square at top; nav card
fills remaining height.

---

## Surface tiers (opacity)

Frosted glass uses `chrome-float-card glass-panel-shell` + an opacity modifier.
Opacity is **card fill only** — borders and blur stay on the shared recipe.

Shell chrome (rail, doc bar, side panels, bottom shelf) shares one mid-tone
`--chrome-fill` (60%) so light and dark modes stay balanced. Center wells stay
lighter so content routes read as inset.

| Modifier                 | Card fill (`::before`)     | Use                               |
| ------------------------ | -------------------------- | --------------------------------- |
| `chrome-opacity-rail`    | `--chrome-fill` (60%)      | Logo + nav stack                  |
| `chrome-opacity-doc-bar` | `--chrome-fill` (60%)      | Doc bar                           |
| `chrome-opacity-panel`   | `--chrome-fill` (60%)      | Left / right panels               |
| `chrome-opacity-bottom`  | `--chrome-fill` (60%)      | Bottom shelf                      |
| `chrome-opacity-main`    | `--chrome-fill-main` (30%) | Center route wells (table, graph) |

**Do not** use `glass-flush` on floating cards — that was the pre-float docked
shell.

### Class recipe (copy-paste)

```html
<div class="chrome-float-card glass-panel-shell chrome-opacity-panel panel-shell">
```

Center content (no AppShell wrapper):

```html
<div class="chrome-float-card glass-panel-shell chrome-opacity-main chrome-main-card">
```

---

## Z-index ladder

| Layer             | z-index | Element                               |
| ----------------- | ------- | ------------------------------------- |
| Canvas            | 0       | `.app-canvas-layer`                   |
| Bottom pane       | 12      | `.app-bottom-pane`                    |
| Side panels       | 15      | `.app-left-panel`, `.app-right-panel` |
| Bottom full-width | 18      | `.app-bottom-pane.full-width`         |
| Rail              | 28      | `.app-rail`                           |
| Doc bar           | 30      | `.app-doc-bar`                        |

---

## Panel interior patterns

Inside any `panel-shell`, use shared dividers:

```css
border-bottom: 1px solid var(--chrome-divider);
```

`--chrome-divider` = `color-mix(in srgb, var(--border) 28%, transparent)`

Section labels: 11px / 500 / `0.06em` tracking / uppercase /
`var(--muted-foreground)` — match `CollectionsPanel` `.section-label`.

---

## Files that must not duplicate shell chrome

| Surface                  | Owner                      | Consumers                                                    |
| ------------------------ | -------------------------- | ------------------------------------------------------------ |
| Left / right panel glass | `AppShell` `.panel-shell`  | Panel snippets only — no extra wrapper                       |
| Doc bar glass            | `AppShell` `.doc-bar-card` | `DocBar.svelte` content only                                 |
| Bottom glass             | `BottomPane.svelte`        | Uses `chrome-opacity-bottom`                                 |
| Center wells             | Route components           | `CollectionTable`, `GraphViewport` use `chrome-opacity-main` |

---

## Runtime constants (`ui.svelte.ts`)

Must stay in sync with CSS:

```ts
VIEWPORT_FLOAT_INSET = 12; // --float-inset
CHROME_FLOAT_GAP = 6; // --chrome-float-gap
RAIL_CARD_WIDTH = 56; // --rail-card-width
```

---

## Verification

1. `pnpm check` — 0 errors
2. Collections route @ 1280×800: doc bar left edge aligns with left panel left
   edge (±0px)
3. Rail logo width === nav card width === `--rail-card-width`
4. Side panel, center well, bottom shelf share `--radius-md` corner radius
5. No `glass-flush` on `AppShell` floating cards

---

## Out of scope

- Mobile bottom sheet rail
- Play-mode toolbar float (uses `chrome-pill` utility separately)
- Per-theme glass blur tuning
