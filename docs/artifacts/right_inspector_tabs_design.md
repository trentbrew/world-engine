---
version: alpha
name: Graph-Native Right Inspector Tabs
description: Design artifact for TRL-35 — tabbed right panel exposing Properties, Entity schema, Facts/relationships, and History/ops log
colors:
  viewport: "#0e0e0e"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  surface-overlay: "#242424"
  surface-glass: "color-mix(in srgb, #242424 62%, transparent)"
  text: "#e8e8e8"
  text-muted: "#8a8a8a"
  text-mono: "#a3a3a3"
  primary: "#d4d4d4"
  primary-muted: "#2e2e2e"
  accent-link: "#737373"
  accent-entity: "#a3a3a3"
  success: "#86efac"
  destructive: "#f87171"
  border: "#333333"
  border-focus: "#737373"
  ring: "#737373"
  tab-disabled: "#525252"
typography:
  ui:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 10px
    fontWeight: 500
    letterSpacing: 0.04em
    textTransform: uppercase
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  right-panel-width: 280px
  float-inset: 12px
components:
  right-panel:
    extends: glass-panel
    width: "{spacing.right-panel-width}"
    borderRadius: "{rounded.lg}"
  inspector-header:
    padding: "{spacing.sm} {spacing.md}"
    borderBottom: "1px solid color-mix(in srgb, {colors.border} 50%, transparent)"
    font: "{typography.title}"
  inspector-tabs:
    display: flex
    borderBottom: "1px solid color-mix(in srgb, {colors.border} 50%, transparent)"
    padding: "0 {spacing.sm}"
    overflowX: auto
  inspector-tab:
    fontSize: 11px
    fontWeight: 500
    padding: "8px 10px"
    color: "{colors.text-muted}"
    borderBottom: "2px solid transparent"
  inspector-tab-active:
    color: "{colors.text}"
    borderBottomColor: "{colors.text-muted}"
  inspector-tab-disabled:
    color: "{colors.tab-disabled}"
    opacity: 0.55
    cursor: not-allowed
  accordion-trigger:
    extends: shadcn-accordion
    font: "{typography.label}"
  empty-state:
    padding: "{spacing.md}"
    fontSize: 12px
    color: "{colors.text-muted}"
  ops-row:
    font: "{typography.mono}"
    fontSize: 10px
    borderLeft: "2px solid {colors.border}"
    paddingLeft: "{spacing.sm}"
---

# Design: Graph-Native Right Inspector Tabs

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-35 (Proposal) · TRL-28 (Spline shell parent)  
**Mock:** [right_inspector_tabs_mockup.html](./right_inspector_tabs_mockup.html)

---

## Overview

The right panel graduates from a **property bag** to a **graph-native inspector** aligned with Trellis semantics: instance values, type/schema, relationships, and provenance — without leaving the Spline-style floating shell.

**Audience:** builder-engineer editing JSON-LD worlds; needs fast field edits (Properties) plus read-only context (Schema, Graph) and audit trail (Ops) when durable tier is live.

**Brand posture:** same creative-tool density as left panel (`Objects | Assets`). Tabs are **compact text labels** — not a second doc bar. Accordion sections inside each tab carry detail; tabs only switch *lens*.

**Phasing (design covers full IA; impl slices):**

| Phase | Tab | v1 depth |
| ----- | --- | -------- |
| A | Properties | Migrate current SceneInspector + EntityAttributes accordions |
| B | Schema | Read-only EntityType + ComponentSchema from ontology |
| C | Graph | Stub + empty state; full EAV/relationship list later |
| D | Ops | Stub + durable-gated timeline; static mode empty state |

---

## Colors

Extends `app.css` neutral dark tokens — **no new palette fork**. Tab active indicator uses `{colors.text-muted}` underline (matches shipped left panel), not violet, until TRL-28 token migration lands.

| Token | Role |
| ----- | ---- |
| `surface-glass` | Right panel background (existing `.glass-panel`) |
| `text-muted` | Inactive tab, accordion triggers, empty states |
| `text` | Active tab, field values |
| `accent-link` | Clickable entity refs in Graph tab |
| `border` | Tab bar, accordion dividers, ops row markers |
| `tab-disabled` | Scene-mode disabled tabs (Schema, Graph, Ops) |

---

## Typography

- **Inspector header:** 13px semibold — entity short id (`main`) or `Scene`
- **Tab labels:** 11px medium — `Props` · `Schema` · `Graph` · `Ops` (full words in `title` tooltip)
- **Accordion triggers:** 10px mono uppercase (existing Properties pattern)
- **Schema / Graph / Ops body:** 11px mono for ids, keys, timestamps; 12px sans for descriptions

---

## Layout

### Panel anatomy (desktop, edit mode)

```
┌──────────────────────────────┐
│ main                         │  ← inspector-header (entity short id)
├──────────────────────────────┤
│ Props Schema Graph Ops       │  ← inspector-tabs (scroll-x if needed)
├──────────────────────────────┤
│                              │
│  [tab body — scroll-y]       │  ← shadcn accordions or read-only lists
│                              │
└──────────────────────────────┘
```

| Region | Behavior |
| ------ | -------- |
| **Header** | Always visible. `Scene` when nothing selected; else last path segment of `@id` |
| **Tab bar** | Below header, above body. Mirrors `.panel-tabs` from `LeftPanel.svelte` |
| **Body** | `flex: 1; overflow-y: auto; min-height: 0` |

**Width:** `--right-panel-width` (280px). Four tabs at ~11px + 10px padding fit without icons in v1. If localization grows labels, allow horizontal scroll on tab bar (no wrap).

### Scene context (no entity selected)

| Tab | State | Body |
| --- | ----- | ---- |
| **Props** | Active (default) | Current `SceneInspector` accordions |
| **Schema** | Disabled | N/A — tab `disabled`, `aria-disabled="true"` |
| **Graph** | Disabled | N/A |
| **Ops** | Enabled | World-level ops stub OR empty "No durable history" (Architect: world-scoped vs disabled — **recommend enabled with empty state** so tab strip layout stays stable) |

**Decision:** Keep all four tabs visible always; disable Schema + Graph in scene mode. Ops shows world-level message.

### Entity context (entity selected)

| Tab | Default | Body |
| --- | ------- | ---- |
| **Props** | **Default tab** on first select | `EntityAttributes` accordions (Entity + components) |
| **Schema** | Available | Read-only type + component schemas |
| **Graph** | Available (Phase C stub OK) | Facts list or placeholder |
| **Ops** | Available | Entity-scoped op log or offline empty state |

**Tab persistence:** Remember last tab per context (`scene` vs `entity`) in `ui` state. On entity switch, stay on current tab if valid; reset to Props only when coming from Scene context.

### Play mode

Unchanged — entire right panel hidden (`AppShell` `.playing`).

---

## Elevation & Depth

Single glass panel; tab bar is an inset divider (no second card). Accordion chevrons from shadcn — no custom chevron row.

Ops timeline uses **left border accent** on each row (2px `border`) — no card-per-op in v1.

---

## Shapes

- Tab underline: 2px bottom border, `-1px` margin overlap (match left panel)
- Accordion: existing shadcn rounded triggers
- Graph entity links: pill-less inline mono with underline on hover

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **RightPanel** | header + tabs + body slot | scene / entity | `RightPanel.svelte` — orchestrator |
| **InspectorTabs** | 4-button tablist | active, disabled, focus | **New** `InspectorTabs.svelte` or inline in RightPanel |
| **PropertiesTab** | SceneInspector OR EntityAttributes | scene / entity | Existing components, no layout wrapper change |
| **SchemaTab** | Accordion: Type · Components · Fields | loading, empty-type | **New** `EntitySchemaPanel.svelte` |
| **GraphTab** | Accordion: Outgoing refs · Incoming refs · Attributes | stub, empty | **New** `EntityGraphPanel.svelte` (Phase C) |
| **OpsTab** | Vertical timeline list | offline, empty, populated | **New** `EntityOpsPanel.svelte` (Phase D) |
| **EmptyState** | icon optional + title + hint | — | Shared snippet / small component |

### Schema tab content (Phase B)

Read-only accordions:

1. **Type** — `conformsTo`, type `@id`, component list from `EntityType`
2. **Per component** — fields with `{ t, sync, default }` from `ComponentSchema`
3. **Unknown type** — single empty state: "No EntityType in ontology — instance-only entity"

### Graph tab content (Phase C — design now, stub impl OK)

Accordions:

1. **References** — formula `other('entity:…')` deps (derived from field scan)
2. **Facts** — flat EAV rows `entity → attr → value` (read-only)
3. **Empty** — "No cross-entity relationships" when none

Each ref row: mono `@id` + jump action (select entity in viewport) — **Phase C+**; stub text in v1.

### Ops tab content (Phase D — design now, stub impl OK)

When `durableSession.mode !== 'trellis'` or offline:

```
No ops log
Durable history requires ?durable=trellis and a running Trellis server.
```

When live: reverse-chronological list:

```
update  Ground.color  #ff14c0   2m ago
update  Ground.size   24        5m ago
```

Row anatomy: `op kind` · `attribute key` · `value preview` · relative time. Host-only writes badge optional (defer).

---

## Interaction matrix

| Input | Context | Output |
| ----- | ------- | ------ |
| Select entity (viewport/tree) | edit | Header → short id; default tab Props unless user was on Schema/Graph/Ops |
| Deselect (empty viewport) | edit | Header → Scene; tab → Props; Schema+Graph disabled |
| Click **Props** tab | any valid | Show Properties body |
| Click **Schema** tab | entity | Show read-only schema accordions |
| Click **Schema** tab | scene | No-op (disabled) |
| Click **Graph** tab | entity | Show graph stub/list |
| Click **Ops** tab | entity + durable live | Show entity ops (Phase D) |
| Click **Ops** tab | static mode | Offline empty state |
| Edit field in Props | entity | Unchanged — `ComponentFieldInput` + durable write path |
| Enter Play | — | Right panel hides |
| `Escape` in play | — | Exit play (unchanged) |

**Keyboard:** Arrow keys within tablist (roving tabindex). `Home`/`End` first/last tab. Disabled tabs skipped.

---

## Accessibility

- **Focus order:** left panel → right panel header → tablist → tab panel → accordions → fields
- **Tablist:** `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` linking to `role="tabpanel"` bodies
- **Disabled tabs:** `aria-disabled="true"`, removed from roving index, `tabindex="-1"`
- **Header:** `aria-label="Inspector"` on `<aside>`; header text is visible label
- **Empty states:** plain text; no live region on tab switch (avoid noise)
- **Motion:** tab body crossfade 120ms opacity (match current `.inspector-body.entity`); `prefers-reduced-motion: reduce` → instant swap

---

## Do's and Don'ts

**Do**

- Reuse left panel tab CSS classes (`.panel-tabs`, `.panel-tab`) for visual parity
- Default to **Props** tab — zero regression for field editing
- Keep accordions **inside** tabs, not tabs inside accordions
- Show honest empty/offline states for Ops and Graph
- Gate Schema/Graph on entity selection

**Don't**

- Don't use four full words if they clip — abbreviate with `title` tooltips
- Don't open Settings or modals from tab bar
- Don't show Ops as disabled in static mode — show explain empty state instead
- Don't persist tab choice across game reload (session-only is fine)

---

## Open for Architect

1. **`ui.rightTab` type:** `'properties' | 'schema' | 'graph' | 'ops'` + separate `sceneTab` / `entityTab` memory vs single field with reset rules
2. **Scene-mode Ops:** world-scoped log vs empty-only — design recommends empty-only in Phase D unless world ops API exists
3. **Schema source:** registry-only vs merged `@graph` ComponentSchema nodes from world file
4. **Graph Phase C:** field-scan for `other()` vs Trellis EQL query — spec the minimal v1
5. **Ops Phase D:** poll vs subscribe from `DurableStore`; entity filter on op stream
6. **shadcn Tabs vs custom tablist:** custom matches left panel today; Tabs component optional if it fits 280px

---

## Handoff checklist

- [x] `docs/artifacts/right_inspector_tabs_design.md` (this file)
- [x] `docs/artifacts/right_inspector_tabs_mockup.html`
- [ ] Architect spec with phased AC (A/B required, C/D stub AC)
- [ ] Update TRL-28 spec § Right panel to reference tab model (additive, not replace header)
