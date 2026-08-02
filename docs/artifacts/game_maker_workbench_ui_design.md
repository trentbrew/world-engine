---
version: 1
name: GameMaker Workbench UI
description: Resource rail, contextual inspector events, preview overlays, and a bottom preview tray for the GameMaker-shaped authoring model.
colors:
  surface: var(--card)
  surfaceFloating: color-mix(in srgb, var(--card) 86%, transparent)
  rail: color-mix(in srgb, var(--viewport) 72%, transparent)
  active: var(--primary)
  muted: var(--muted-foreground)
  border: color-mix(in srgb, var(--border) 55%, transparent)
typography:
  label: 11px / 1.2 var(--font-sans)
  mono: 10px / 1.35 var(--font-mono)
rounded:
  panel: var(--radius-md)
  control: var(--radius-sm)
spacing:
  rail: 48px
  panelGap: var(--spacing-sm)
components:
  resourceRail:
    width: "{spacing.rail}"
    background: "{colors.rail}"
    itemState: icon + short label + active indicator
  workbenchDrawer:
    content: current resource list or empty state
    resizable: inherits existing left panel width
  eventInspector:
    location: right inspector Events tab
    rows: trigger card + action summary + edit affordance
  previewOverlay:
    routeMode: SvelteKit shallow state
    close: Escape, close button, browser back
  previewTray:
    position: bottom over viewport
    content: timeline, waveform, texture atlas scrubber, event log
---

## Overview

The Workbench makes the authored game resources visible without replacing the existing editor route. The current editor already has the right ingredients: `AppShell` floats panels over the viewport, `LeftPanel` switches between scene/object/assets/settings content, `RightPanel` inspects the selected entity, and dialogs handle focused actions.

The design moves the left panel from flat tabs to a compact resource rail plus drawer. The rail is the GameMaker mental model: Rooms, Objects, Sprites, Events, Scripts, Assets, and Settings. The drawer shows the active resource collection. The viewport remains central.

## Layout

- Left: 48px resource rail attached to the existing left drawer.
- Center: existing 2D/3D viewport.
- Right: selected thing inspector, with a new Events tab alongside Props, Schema, Graph, Ops, and JSON.
- Bottom: hidden contextual preview tray. It opens only for media/time surfaces.
- Overlay: shallow-routed focused previews for model, texture, and audio assets.

## Components

### Resource Rail

The rail owns navigation between authoring resources. It should be icon-first with compact labels, because the drawer already gives detailed headings. Active state is a vertical indicator and stronger foreground color.

Resource IDs:

- `rooms`
- `objects`
- `sprites`
- `events`
- `scripts`
- `assets`
- `settings`

### Workbench Drawer

The drawer reuses existing content where possible:

- `rooms`: initially current scene/room placeholder and `SceneInspector`.
- `objects`: existing object/entity list.
- `sprites`: sprite/texture oriented subset of assets.
- `events`: event index showing objects/entities with authored handlers.
- `scripts`: reusable action-list placeholder.
- `assets`: existing `AssetsPanel`.
- `settings`: existing `SettingsPanel`.

### Event Inspector

The Events tab is contextual to the selected entity or type. First slice can be read-only: show inherited and inline handlers grouped by trigger (`create`, `step`, `destroy`) and list each action in human-readable form.

Later slices add structured editing rows, trigger add buttons, and action editors.

### Preview Overlay

Asset preview is temporary focus, not navigation away. Use SvelteKit shallow routing later for browser-back dismissal. First slice may use UI state only if shallow routing is too large, but the component anatomy should keep that migration straightforward.

Preview types:

- Model: name, URL, size, placement action, preview viewport placeholder.
- Texture/Sprite: image preview, dimensions when available, future atlas controls.
- Audio: name, URL, size, native audio controls.

### Bottom Preview Tray

The tray is inactive by default. It is reserved for horizontal, time-based tools: animation scrubber, audio waveform, texture frame strip, event trace log. It should not become a second inspector.

## Interaction Matrix

| Input | Target | Result |
| --- | --- | --- |
| Click rail item | Resource rail | Drawer switches resource, selected entity remains unchanged |
| Keyboard Tab | Rail and drawer | Focus moves through rail buttons, then active drawer content |
| Select entity | Viewport or object list | Right inspector updates, Events tab becomes available |
| Click Events tab | Right inspector | Shows grouped event handlers for selected entity/type |
| Click asset preview | Asset item | Opens focused overlay for the asset |
| Escape | Overlay | Closes overlay; future shallow route uses browser history |
| Open bottom tray | Preview/action control | Tray appears above bottom chrome without hiding side panels |

## Accessibility

- Rail is `role="tablist"` or a labelled navigation group with each item as a button.
- Active rail item exposes `aria-current` or `aria-pressed`.
- Events tab follows the current right-panel tab ARIA pattern.
- Overlay uses `role="dialog"`, labelled title, Escape close, and focusable close button.
- Bottom tray has a visible label and does not trap focus.
- Motion is minimal; respect `prefers-reduced-motion`.

## Open for Architect

- First implementation should prefer the existing single route and existing UI state in `src/lib/ui/ui.svelte.ts`.
- Keep the first Events tab read-only; mutation can be a follow-up spec.
- Implement one preview overlay path for all asset kinds, backed by existing `AssetEntry`.
- Add focused e2e coverage for rail switching, Events tab visibility, and asset preview open/close.

## Do's and Don'ts

- Do keep the viewport as the center of gravity.
- Do reuse existing `AssetsPanel`, `SceneInspector`, `EntityList`, and `SettingsPanel`.
- Do make events visible before making them editable.
- Do not create full SvelteKit routes for every editor pane yet.
- Do not put media timelines inside the left drawer.
