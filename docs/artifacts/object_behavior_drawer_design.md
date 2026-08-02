---
version: alpha
revision: 2
name: Editor contexts — Scene · Object
description: Design artifact — dual editor contexts with Object behavior drawer (clip timeline, alarm chains); adopted from Claude Code artifact
source:
  tool: claude-code
  url: https://claude.ai/code/artifact/aa0e55c7-353a-4bdc-ab30-c3385913a313
  mock: docs/artifacts/object_behavior_drawer_mockup.html
  spec: docs/artifacts/object_context_spec.md
labels: mock-supplied, needs-design-deep
colors:
  ground: "#08080c"
  recess: "#060609"
  panel: "#121218"
  panel2: "#17171e"
  raise: "#1e1e28"
  line: "#282833"
  ink: "#e9e9f1"
  dim: "#8b8b9a"
  faint: "#55555f"
  accent: "#33d6c2"
  accent-ink: "#04211d"
  loco: "#6ea8ff"
  action: "#f5a623"
  combat: "#ff6f6f"
  social: "#b98cff"
  emote: "#ff9ecb"
  magic: "#57d9a3"
typography:
  ui:
    fontFamily: "ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: 13px
  mono:
    fontFamily: "ui-monospace, SF Mono, JetBrains Mono, Menlo, monospace"
    fontSize: 11px
spacing:
  rail-width: 56px
  left-panel: 214px
  right-panel: 232px
  behavior-height: 172px
  viewport-inset: 8px
parent: object_context_spec.md
---

# Design: Editor contexts — Scene · Object

**Status:** Adopted (mock-supplied) — ready for design-critic → architect\
**Parent:** [object_context_spec.md](./object_context_spec.md) (TRL-145 Phase
D)\
**Mock:**
[object_behavior_drawer_mockup.html](./object_behavior_drawer_mockup.html)\
**Source artifact:**
[claude.ai/code/artifact/aa0e55c7…](https://claude.ai/code/artifact/aa0e55c7-353a-4bdc-ab30-c3385913a313)

---

## Overview

Interactive mock of **two editor contexts** toggled via the **left rail** (not
the bottom dock). Scene = room authoring; Object = isolated instance editing for
animatable entities.

| Context    | Enter                            | Left                                   | Center                      | Right                             | Bottom                                       |
| ---------- | -------------------------------- | -------------------------------------- | --------------------------- | --------------------------------- | -------------------------------------------- |
| **Scene**  | Rail → Scene                     | Objects/Rooms/Types tabs + entity tree | Room viewport + gizmo tools | Props/Events/Graph/JSON inspector | **Floating palette** (asset drag strip)      |
| **Object** | Dblclick entity or rail → Object | Clips / Structure tabs                 | Isolated object stage       | Playback / Fields                 | **Behavior shelf** (timeline + alarm chains) |

**Audience:** builder-engineer authoring animated Characters and wiring
alarm-driven clip schedules.

**Emotional tone:** teal accent (`#33d6c2`) signals Object/isolated focus; inset
viewport depth by containment (not floating cards). Category-colored clip
swatches (loco/action/social/…) aid scanability.

---

## Scene context (reference)

Included in mock for **IA contrast** — not re-spec'd here beyond palette
placement:

- **Palette:** transient bottom shelf inside viewport (`/` toggles); drag assets
  → Character vs Prop drop semantics
- **Inspector:** room entity Props tab; hint to dblclick → Object context
- **Entity tree:** dblclick guard → switches to Object context

---

## Object context layout

```
┌ rail ─┬─ left (Clips|Structure) ─┬─ stage ─────────────┬─ right (Playback|Fields) ─┐
│       │                           │  isolated viewport   │  Now playing + sliders   │
│       ├───────────────────────────┴──────────────────────┴──────────────────────────┤
│       │ BEHAVIOR · clip schedule driven by alarms          transport · 5.40s · 1.0× │
│       │ [====Idle====][======Dance======][====Idle====] playhead                      │
│       │ 0.0   1.5   3.0   4.5   6.0   7.5   9.0                                       │
│       │                    │ create │ alarm0 → set clip → alarm1 │ alarm1 → … │      │
└───────┴──────────────────────────────────────────────────────────────────────────────┘
```

Grid:
`#object { grid-template-columns: 214px 1fr 232px; grid-template-rows: 1fr 172px }`

---

## Left panel — Clips / Structure

### Clips tab (D2)

| Element        | Spec                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| Category pills | All + locomotion/action/combat/social/emote/magic (truncated labels ok) |
| Clip row       | Swatch (category color) + mono id + LOOP/ROOT badge + duration          |
| Selection      | `aria-current="true"` on active clip; updates stage + playback panel    |

Data: full m2m-human catalog grouped by animation category (see mock `CATS`
constant).

### Structure tab

Rig tree stub: SkinnedMesh vertex count, Skeleton bone count, root→pelvis,
Material count. Deferred full skeleton UI (out of scope per spec).

---

## Center — Object stage (D1)

- Inset viewport (`margin: 8px`, rounded, recess fill + subtle grid mask)
- Turntable / Orbit tool chips
- Large puppet preview + floating tag: `guard · {clipId}`
- Corner label: `isolated · only this object`

---

## Right panel — Playback (D3)

| Region                 | Content                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| **Now playing**        | Clip id (large mono accent), category · duration · loop/once         |
| **Speed**              | Integrated range slider (118px track, accent thumb)                  |
| **Loop / Root motion** | Pill switches (`role="switch"`)                                      |
| **Mesh3DAnimator**     | Read-only catalog + rig fields                                       |
| **Footnote**           | Picking clip sets `Mesh3DAnimator.clip` — same as durable patch path |

Fields tab: illustrative only in mock (reuse inspector field language at impl).

---

## Behavior shelf (D4) — headline

**Header:** `Behavior · clip schedule driven by alarms` + transport (pause +
clock).

**Body:** two-column grid `1fr 300px`:

### Timeline (left)

| Element      | Treatment                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Track**    | Colored segments proportional to duration (`Idle_Loop` loco-blue, `Dance_Loop` social-purple) |
| **Playhead** | Teal vertical line; animates in edit (respects `prefers-reduced-motion`)                      |
| **Axis**     | 0.0–9.0s tick labels                                                                          |

Static analysis source: guard idle⇄dance loop from `animated-npc-demo.jsonld`.

### Event lanes (right, 300px)

Each row = **trigger chip** + **horizontal action chain**:

| Trigger  | Dot color          | Example chain                              |
| -------- | ------------------ | ------------------------------------------ |
| `create` | social (`k-life`)  | `alarm 0`                                  |
| `alarm0` | action (`k-alarm`) | `set clip → Dance_Loop` → `alarm 1 in 4s`  |
| `alarm1` | action             | `set clip → Idle_Loop` → `alarm 0 in 2.5s` |

- Actions as inline `act` pills: `op` in accent + value mono
- `→` seq separators between actions
- **`+` addact** dashed button at chain end (D4b authoring affordance)

---

## Interaction matrix

| Input                        | Context | Output                                           |
| ---------------------------- | ------- | ------------------------------------------------ |
| Rail → Scene / Object        | any     | swap `.context.on`; update breadcrumb            |
| Dblclick entity (Scene tree) | scene   | enter Object context                             |
| Click clip row               | object  | set `Mesh3DAnimator.clip`; sync stage + playback |
| Clip category pill           | object  | filter library                                   |
| `/`                          | scene   | toggle floating palette expand                   |
| Theme ◐                      | any     | toggle `data-theme` light/dark                   |
| Drag palette card → viewport | scene   | place Character/Prop ghost + toast               |
| `+` on action chain          | object  | add step (D4b — impl wires `setEvents`)          |
| Pause transport              | object  | pause playhead scrub (preview only)              |

---

## Accessibility

- Left rail: `aria-label="Workspaces"`; `aria-current` on active context
- Panel tabs: `role="tablist"` + `aria-selected`
- Switches: `role="switch"` + `aria-checked` + `aria-label`
- Behavior: `aria-label="Behavior"` on section
- `:focus-visible` outline uses `--accent`
- `@media (prefers-reduced-motion: reduce)` disables bob animation + playhead
  rAF

---

## Token notes (YAML ↔ mock `:root`)

Mock uses **teal object accent** (`--accent: #33d6c2`) — distinct from shell
oklch tokens in `editor_shell_cards_design.md`. At impl: either map to existing
`--accent-entity` or introduce `--accent-object` scoped to Object route.

Category clip colors (`--loco`, `--action`, `--social`, …) are **mock-local** —
Architect decides whether to promote to theme or keep component-scoped.

---

## Maps to codebase

| Mock region       | Spec wedge | Component                                                 |
| ----------------- | ---------- | --------------------------------------------------------- |
| Context router    | shell      | Left rail / `railRoute`                                   |
| Scene palette     | scene      | `ScenePalette.svelte` (floating, not docked in this mock) |
| Clip library      | D2         | `ObjectClipLibrary.svelte`                                |
| Object stage      | D1         | `ObjectStageViewport.svelte`                              |
| Playback panel    | D3         | `ObjectPlaybackInspector.svelte`                          |
| Behavior shelf    | D4         | `ObjectBehaviorDrawer.svelte` + strip/lanes               |
| Timeline segments | D4a        | extend `BehaviorScheduleStrip.svelte`                     |
| Action chains     | D4b        | new chain row UI + `setEvents`                            |

---

## Open for Architect

- Scene palette: mock shows **floating inset shelf**; `editor_shell_cards` spec
  says **docked bottom pane** for Scene route — reconcile or flag Scene palette
  as separate from bottom pane slot?
- Behavior height: mock uses fixed `172px` row; wire to `ui.bottomHeight`
  resize?
- Transport scrub: bind to `objectPreviewPlaying` or static analysis only in v1?
- Inline `+` chain editor vs separate composer form (current impl)?

---

## Design verification

- refs: `docs/scratch/object_behavior_drawer_design.html` (source export),
  `docs/artifacts/object_behavior_drawer_mockup.html` (normalized),
  `docs/artifacts/object_context_spec.md`,
  `docs/artifacts/editor_shell_cards_design.md`,
  `static/games/animated-npc-demo.jsonld`
- interaction matrix: 9 rows, 0 empty cells
- a11y: rail `aria-current`, tab roles, switch labels, reduced-motion guard
  documented
- token parity: YAML documents mock `:root` dark theme; light theme via
  `data-theme="light"` in mock
- adoption: frame-runtime stripped; duplicate lane/track JS removed; source URL
  recorded
- mock-supplied: yes — Claude Code artifact
  `aa0e55c7-353a-4bdc-ab30-c3385913a313`

---

## Handoff checklist

- [x] Export saved to `docs/scratch/object_behavior_drawer_design.html`
- [x] Normalized to `docs/artifacts/object_behavior_drawer_mockup.html`
- [x] `docs/artifacts/object_behavior_drawer_design.md` (this file, revision 2)
- [x] `## Design verification` section present
- [ ] Design-critic PASS (macro gate if `needs-design-deep`)
- [ ] Architect sync: palette dock vs float fork; D4 chain UI AC
