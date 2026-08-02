---
version: alpha
name: JSON-LD World Hydrator
description: Design artifact for TRL-2 — semantic @graph world definition hydrated into a Threlte viewport with dev inspector
colors:
  viewport: "#08080a"
  viewport-grid: "#1a1a22"
  surface: "#111116"
  surface-raised: "#18181f"
  text: "#e4e4ea"
  text-muted: "#7a7a8c"
  text-mono: "#a8b4c0"
  primary: "#ff6b6b"
  accent-spawn: "#e8a838"
  accent-entity: "#5b9fd4"
  accent-link: "#7c6cf0"
  success: "#4ade80"
  border: "#2a2a36"
  border-focus: "#5b9fd4"
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
  inspector-width: 320px
  toolbar-height: 40px
components:
  toolbar:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.border}"
    height: "{spacing.toolbar-height}"
    padding: "0 {spacing.md}"
  viewport:
    backgroundColor: "{colors.viewport}"
  inspector:
    backgroundColor: "{colors.surface}"
    borderLeft: "1px solid {colors.border}"
    width: "{spacing.inspector-width}"
  entity-row:
    padding: "{spacing.sm} {spacing.md}"
    borderRadius: "{rounded.sm}"
    selectedBackground: "{colors.surface-raised}"
  spawn-gizmo:
    color: "{colors.accent-spawn}"
    opacity: 0.55
  prop-mesh:
    color: "{colors.primary}"
---

# Design: JSON-LD World Hydrator

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-1  
**Mock:** [jsonld_world_hydrator_mockup.html](./jsonld_world_hydrator_mockup.html)

---

## Overview

A **viewport-first dev surface** that proves the semantic-game thesis: a `world.jsonld` `@graph` becomes a live Threlte scene without hand-authored Svelte meshes. The audience is the builder (Trent) experimenting with graph-native game worlds — Powder-adjacent, Trellis-aligned.

Emotional tone: **instrument panel**, not game HUD. Dark, precise, graph-literate. Entity `@id` strings are first-class UI elements (monospace, selectable). The 3D view is the hero; the inspector is a collapsible dev affordance, not a game menu.

**Single job:** Load world → see entities → select one → read its JSON-LD fragment → confirm adding a node to the file would spawn geometry.

## Colors

| Token | Role |
| ----- | ---- |
| `viewport` | Full-bleed WebGL background; near-black so meshes read |
| `viewport-grid` | Subtle ground grid in scene (Three.js GridHelper tone) |
| `surface` / `surface-raised` | Inspector panels, toolbar |
| `primary` | Default `Prop` mesh tint — matches existing `#ff6b6b` box |
| `accent-spawn` | SpawnPoint ring + cylinder gizmo |
| `accent-entity` | Selection outline, focus ring, active entity row |
| `accent-link` | External mesh URL refs, `@context` link affordance |
| `text-mono` | `@id`, attribute keys, raw JSON fragments |

## Typography

- **UI (`ui`):** Inspector labels, toolbar stats, button text
- **Label (`label`):** Section eyebrows — `ENTITIES`, `ATTRIBUTES`, `WORLD`
- **Mono (`mono`):** All semantic identifiers and JSON — never truncate `@id`; wrap or horizontal scroll
- **Title (`title`):** World file basename in toolbar (`world.jsonld`)

Hierarchy: toolbar title → section labels → entity rows → attribute key/value pairs.

## Layout

```
┌─────────────────────────────────────────────────────────────┬──────────┐
│  world.jsonld · 4 entities · tick 0              [◧ Inspector]│          │
├─────────────────────────────────────────────────────────────┤ INSPECTOR│
│                                                             │          │
│                    THRELTE VIEWPORT                         │ ENTITIES │
│                   (OrbitControls)                           │ ──────── │
│                                                             │ ▶ ground │
│         grid · props · spawn gizmo                          │   prop-a │
│                                                             │   spawn  │
│                                                             │          │
│                                                             │ ATTRS    │
│                                                             │ @id …    │
│                                                             │ position │
└─────────────────────────────────────────────────────────────┴──────────┘
```

| Breakpoint | Behavior |
| ---------- | -------- |
| `≥768px` | Inspector docked right, 320px fixed; viewport flex-1 |
| `<768px` | Inspector as bottom sheet (60vh max); toggle via toolbar button |
| All | Canvas always visible; never zero-height viewport |

**Z-order:** Canvas (0) → optional dev grid overlay (1, pointer-events none) → toolbar (10) → inspector (20).

## Elevation & Depth

- **Viewport:** No chrome border; scene bleeds to edges below toolbar
- **Inspector:** Single `border-left` separation — no drop shadow (containment over float)
- **Selected entity:** In-scene outline mesh (Three.js `OutlineEffect` or emissive boost) + raised row in list
- **Spawn gizmo:** Slightly emissive, 55% opacity — reads as "marker" not solid geometry

## Shapes

- UI radii: `sm` (3px) for rows and chips; no pill buttons
- Scene primitives: sharp boxes for props; thin ring (torus) for spawn; infinite plane for ground
- Icon sizing: 16px toolbar icons; 12px chevrons in entity tree

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ------------------ |
| **WorldToolbar** | File ref, entity count, tick, inspector toggle | default, inspector-open | `src/lib/ui/WorldToolbar.svelte` (new) |
| **WorldViewport** | Threlte `<Canvas>` + lights + OrbitControls | loading, ready, error | `src/lib/scene/WorldViewport.svelte` |
| **EntityHydrator** | Dispatches `@type` → child component | per-entity | `src/lib/hydrate/EntityHydrator.svelte` |
| **GroundPlane** | `<T.Mesh>` + plane geom + grid material | static | `src/lib/entities/GroundPlane.svelte` |
| **PropMesh** | Box or glTF from `mesh` ref; `color` attr | static, selected | `src/lib/entities/PropMesh.svelte` |
| **SpawnMarker** | Cylinder + torus ring, accent-spawn | static, selected | `src/lib/entities/SpawnMarker.svelte` |
| **EntityInspector** | Scrollable list + attribute panel | empty, selected, collapsed | `src/lib/ui/EntityInspector.svelte` |
| **JsonLdFragment** | Read-only mono block of selected entity | — | inline in EntityInspector |

### Entity type → visual mapping (normative)

| `@type` | Geometry | Default material | Notes |
| ------- | -------- | ---------------- | ----- |
| `GroundPlane` | Plane 20×20 | GridHelper + dark `#1a1a22` | `receiveShadow`, y=0 |
| `Prop` | Box 1×1×1 or glTF | `color` attr or `{colors.primary}` | `castShadow` |
| `SpawnPoint` | Cylinder r=0.4 h=0.05 + Torus r=0.6 | `{colors.accent-spawn}` @ 0.55 | Non-colliding marker |
| `DirectionalLight` | — | intensity from attrs | Not in entity list |
| `AmbientLight` | — | intensity from attrs | Not in entity list |

Lights are world-level nodes in `@graph` but excluded from the selectable entity list (Architect: filter `@type` ends with `Light`).

## Interaction matrix

| Input | States | Output |
| ----- | ------ | ------ |
| Page load | loading → ready / error | Fetch `static/world.jsonld`, parse `@graph`, hydrate scene |
| Orbit drag (viewport) | ready | Camera orbit (OrbitControls); no entity selection |
| Click entity in 3D | ready, entity hit | Select entity; inspector scrolls to row; outline active |
| Click entity row (inspector) | ready | Select entity; camera optional soft-focus (POC: outline only) |
| Toggle inspector btn | open / closed | Slide inspector; persist preference in `sessionStorage` |
| Keyboard ↑/↓ in entity list | list focused | Move selection; update outline + attribute panel |
| Load error (bad JSON/missing file) | error | Full-viewport message: path, parse error, retry hint |
| Hot reload (dev, future) | ready | Re-fetch world file; diff entities (Architect scope) |

**POC non-goals:** in-scene transform gizmos, inline JSON editing, multiplayer presence.

## Accessibility

- **Focus order:** Skip link → toolbar toggle → entity list (tab) → attribute panel (read-only, skip tab stops on JSON block)
- **Labels:** Inspector toggle `aria-label="Toggle entity inspector"`; entity rows `aria-selected`
- **Live region:** `#world-status` announces "World loaded, N entities" on hydrate complete
- **Motion:** `prefers-reduced-motion: reduce` disables inspector slide transition (instant show/hide); OrbitControls damping unchanged (user-initiated)
- **Contrast:** Text on `surface` ≥ 4.5:1; mono `@id` on raised surface ≥ 4.5:1

## Do's and Don'ts

**Do**

- Show raw `@id` in UI — semantic identity is the point
- Keep viewport ≥70% width on desktop
- Use existing coral prop color for continuity with current skeleton
- Reference glTF assets by URL + optional `contentHash` in inspector

**Don't**

- Gamify the inspector (no health bars, score widgets in POC)
- Embed geometry in JSON-LD — always URL refs or primitive enum
- Block render on inspector; canvas mounts first with loading spinner overlay
- Use generic "Object 1" labels — always `@type` + short id suffix

## Open for Architect

- Confirm `world.jsonld` path: `static/world.jsonld` vs `$lib/assets/world.jsonld`
- `@context` URL: local file `static/game-context.jsonld` or inline minimal context for POC
- Store shape: single `$state` map keyed by `@id` vs normalized `{ entities, selection }`
- glTF loading: `@threlte/extras` `useGltf` vs `<GLTF url={…}>` — pick one pattern
- Selection hit-testing: Threlte interactivity (`interactivity()` + `on:pointerdown`) vs raycast helper
- Error boundary: malformed entity skips with console warn vs hard fail entire world load

## Handoff checklist

- [x] `docs/artifacts/jsonld_world_hydrator_design.md` (this file, DESIGN.md format)
- [x] `docs/artifacts/jsonld_world_hydrator_mockup.html` (self-contained; CSS vars mirror YAML tokens)
- [x] Paths in design issue `describe` SUMMARY
