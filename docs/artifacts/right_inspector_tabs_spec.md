---
version: 1
name: Graph-Native Right Inspector Tabs
parent: TRL-35
design: docs/artifacts/right_inspector_tabs_design.md
mock: docs/artifacts/right_inspector_tabs_mockup.html
status: queue-ready
---

# Spec: Graph-Native Right Inspector Tabs

**Parent:** TRL-35 (Proposal) · TRL-36 (Design)  
**Design:** [right_inspector_tabs_design.md](./right_inspector_tabs_design.md)  
**Mock:** [right_inspector_tabs_mockup.html](./right_inspector_tabs_mockup.html)  
**Extends:** TRL-28 § Right panel (additive — tabs below existing header)

---

## Summary

Add a **four-tab inspector** to the right panel: **Props**, **Schema**, **Graph**, **Ops**. Tabs sit **below** the existing header (type + id badge when entity selected; `Scene` when not). **Properties** tab wraps current `SceneInspector` / `EntityAttributes` accordions with zero field-edit regression. **Schema** is read-only from the ontology registry. **Graph** and **Ops** ship as **functional v1 stubs** (local data, honest empty states) — not deferred placeholders.

---

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Tab state shape | `ui.sceneInspectorTab` + `ui.entityInspectorTab`, both `RightInspectorTab` | Separate memory per context; scene defaults `properties`, entity defaults `properties` on first select from scene |
| Entity switch while on Schema/Graph/Ops | **Keep** current entity tab | User stays on lens; only reset to Props when deselecting to Scene |
| Deselect to Scene | Force `sceneInspectorTab = 'properties'`; disable Schema + Graph | Design matrix |
| Tab UI component | **Custom tablist** — reuse `.panel-tabs` / `.panel-tab` from `LeftPanel.svelte` | Visual parity; no shadcn Tabs in v1 |
| Tab labels | `Props` · `Schema` · `Graph` · `Ops` with `title` tooltips for full names | Fits 280px |
| Header | **Keep shipped header** (type title + id badge) — design mock short-id-only is superseded | RightPanel already evolved; tabs go under header |
| Schema source | **`getType()` / `getComponent()` registry** | `loadOntology` already merges world-file `EntityType` / `ComponentSchema` nodes |
| Unknown type | Empty state: "No EntityType in ontology — instance-only entity" | No crash on untyped entities |
| Graph v1 | **Local scan** — (1) flat facts from `entity.components`, (2) `other('entity:…')` regex on string field values | No EQL / Trellis query in v1 |
| Graph refs navigation | **Defer** click-to-select; mono `@id` text only | Phase C+ per design |
| Ops v1 | **In-memory ring buffer** on `durableSession` fed from successful local durable writes + `DurableStore.subscribe` patches | Reuse existing subscribe poll; filter by `entityId` in UI |
| Ops static mode | Same empty state as trellis offline | Copy from design artifact |
| Ops scene mode | Tab **enabled**; body shows offline empty state (no world-scoped log) | Stable tab strip |
| Play mode | Right panel hidden — unchanged | `AppShell.playing` |
| Persist tabs across reload | **No** — session-only | Design don't |

---

## State (`ui.svelte.ts`)

```ts
export type RightInspectorTab = 'properties' | 'schema' | 'graph' | 'ops';

// In UIState:
sceneInspectorTab = $state<RightInspectorTab>('properties');
entityInspectorTab = $state<RightInspectorTab>('properties');
```

**Selection side-effects** (implement in `RightPanel.svelte` `$effect` or `world` select handler):

| Event | Tab behavior |
| ----- | ------------ |
| `world.select(null)` | `sceneInspectorTab = 'properties'` |
| `world.select(id)` from null | Keep `entityInspectorTab` (may stay on Schema if user had switched before deselect — **optional**: reset to `properties` only when coming from scene; spec: **keep entity tab memory** across select/deselect/reslect) |

**Clarification:** entity tab memory persists for the session even if user deselects and reselects same entity.

---

## Ops log (`durable/session.svelte.ts`)

```ts
export type DurableOpEntry = {
  id: string;           // crypto.randomUUID or monotonic
  kind: 'update';
  entityId: string;
  component: string;
  field: string;
  value: unknown;
  at: number;           // Date.now()
};

// durableSession.ops = $state<DurableOpEntry[]>([])  // max 50, newest first
export function recordDurableOp(patch: DurablePatch): void;
```

**Writers:**

1. After successful `world.setField` durable path (host confirm) — record op
2. `connectDurableSync` subscribe callback — record each remote patch (dedupe: skip if same entity+component+field+value as head within 100ms)

**Readers:** `EntityOpsPanel` filters `durableSession.ops` where `entityId === selected.id`.

---

## Component map

| File | Action |
| ---- | ------ |
| `ui.svelte.ts` | Add `RightInspectorTab`, `sceneInspectorTab`, `entityInspectorTab` |
| `RightPanel.svelte` | Tab bar + tabpanel routing; preserve header |
| `EntitySchemaPanel.svelte` | **New** — read-only shadcn accordions |
| `EntityGraphPanel.svelte` | **New** — Facts + References accordions |
| `EntityOpsPanel.svelte` | **New** — timeline list + empty states |
| `InspectorEmptyState.svelte` | **New** — title + hint (optional, can inline) |
| `durable/session.svelte.ts` | Ops ring buffer + `recordDurableOp` |
| `world.svelte.ts` | Call `recordDurableOp` after durable write success (minimal hook) |
| `SceneInspector.svelte` | No structural change — rendered inside Props tabpanel |
| `EntityAttributes.svelte` | No structural change — rendered inside Props tabpanel |

**Extract shared tab CSS:** optional `inspector-tabs.css` or duplicate LeftPanel rules in RightPanel (prefer **shared class names** `.panel-tabs` / `.panel-tab` — can live in `app.css` or RightPanel scoped with `:global`).

---

## RightPanel behavior

```
┌─────────────────────────────┐
│ GroundPlane  [main]         │  header (existing)
├─────────────────────────────┤
│ Props Schema Graph Ops      │  tablist
├─────────────────────────────┤
│ [active tabpanel — scroll]  │
└─────────────────────────────┘
```

| Context | Active tab source | Disabled tabs |
| ------- | ----------------- | ------------- |
| Scene | `ui.sceneInspectorTab` | Schema, Graph |
| Entity | `ui.entityInspectorTab` | none |

| Tab | Scene body | Entity body |
| --- | ---------- | ----------- |
| Props | `SceneInspector` | `EntityAttributes embedded` |
| Schema | disabled | `EntitySchemaPanel` |
| Graph | disabled | `EntityGraphPanel` |
| Ops | `EntityOpsPanel` (no selection → empty copy) | `EntityOpsPanel` filtered |

**Scene Ops tab:** render offline empty state (no entity filter).

**A11y:** `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-disabled` on disabled tabs, `hidden` on inactive panels.

---

## EntitySchemaPanel

Accordions (shadcn, type=`multiple`, default all open):

1. **Type · {typeName}** — `conformsTo`, registry type name, component list from `getType(entity.type)`
2. **Per component** on entity — fields from `getComponent(name)` with columns: name · type · sync badge

**Empty:** entity has no `type` or `getType` returns undefined → single empty state message.

---

## EntityGraphPanel

Accordions:

1. **References** — scan all string values in `entity.components` for `/other\s*\(\s*['"](entity:[^'"]+)['"]\s*\)/g`; list unique ids; empty → "No outgoing other() references"
2. **Facts** — rows `Component.field` → JSON-stringified value for each key in entity.components; skip derived formula strings starting with `=`

---

## EntityOpsPanel

| Condition | UI |
| --------- | -- |
| `durableSession.mode !== 'trellis'` OR `!durableSession.connected` | Empty: "No ops log" + hint about `?durable=trellis` |
| Entity selected, trellis live, no ops for entity | Empty: "No ops recorded for this entity" |
| Entity selected, ops exist | Reverse-chron list: `update` · `Component.field` · value preview · relative time |

Row markup per design (`ops-row` left border). Op id truncated in `title` tooltip optional.

---

## Regression guards

- Field edit in Props tab unchanged (`ComponentFieldInput`, durable gate-before-apply)
- Play mode hides entire right panel
- Left panel tabs unaffected
- Panel resize (`ui.rightPanelWidth`) still works

---

## Out of scope (follow-up issues)

- Click Graph ref → `world.select(id)`
- Incoming references (reverse edges)
- Trellis native op-log API (op hash display from server)
- World-scoped Ops in scene mode
- shadcn Tabs migration
- Persist tab choice to sessionStorage

---

## Test plan (manual)

1. Edit mode, no selection → Props shows SceneInspector; Schema+Graph disabled; Ops empty state
2. Select ground entity → Props default; edit color still works
3. Schema tab → GroundPlane type + Ground/Transform field specs with sync badges
4. Graph tab → Facts rows for Ground.size/color; References empty unless formula fields
5. `?durable=trellis` + edit color → Ops tab shows update row
6. Enter play → right panel gone; exit restores tab state

---

## Acceptance criteria (issue)

1. `pnpm check` passes
2. Right panel shows 4-tab bar below header in edit mode
3. Scene context disables Schema and Graph tabs
4. Entity Props tab matches pre-tab field editing behavior
5. Schema tab renders read-only type + component schemas from registry
6. Graph tab renders Facts + References accordions with empty states
7. Ops tab renders durable offline empty state; shows filtered ops when trellis live + edits recorded
