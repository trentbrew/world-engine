---
version: 1
name: Save Selection as EntityType
parent: TRL-92
design: docs/artifacts/save_entity_type_design.md
mock: docs/artifacts/save_entity_type_mockup.html
depends: TRL-C
status: queue-ready
---

# Spec: Save Selection as EntityType (TRL-B)

**Parent:** TRL-92 (Proposal) · TRL-93 (Design)  
**Design:** [save_entity_type_design.md](./save_entity_type_design.md)  
**Mock:** [save_entity_type_mockup.html](./save_entity_type_mockup.html)  
**Depends on:** TRL-C (durable component ops — `setEntity`, `#persistToStore`, `durableBagOnly`)

---

## Summary

Promote a configured entity instance to a **world-scoped `EntityType` node** in the `@graph`, persist via the durable tier, hot-register in the runtime ontology, optionally set `conformsTo` on the source entity, and list the new type in **Add entity**.

v1 is **create-only** (no update-in-place). Schema tab footer is the sole entry point.

---

## Architect decisions (closes design forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Patch kind for type create | **`defineType`** discriminant on `DurablePatch` | Atomic graph write; peers + Trellis poll apply one mutation |
| `conformsTo` on source entity | **Bundled in `defineType`** via optional `applyToEntityId` | Single persist + broadcast; avoids new top-level field patch |
| Update existing type | **Out of scope v1** | Always "Save as new type"; collision if name exists |
| Props tab secondary entry | **Defer** | Schema footer sufficient for AC |
| Defaults capture | **`captureTypeDefaults(entity)`** — durable fields + formula `src` strings | Matches `orbit.jsonld` EntityType shape; realtime omitted |
| Built-in vs world types | **`BUILTIN_TYPE_NAMES` frozen set** in registry | Add entity groups Built-in / World types |
| Ontology refresh | **`registerType()` immediately** on local + remote apply | No full page reload |
| Add entity spawn | **Wire `spawnFromType()`** — dialog currently toast-only stub | Design requires world types spawnable |
| Eligibility | **`canSaveAsType(entity)`** helper | Centralizes Player/Ground/scene/spawn-only rules |
| Ops log | **`defineType` kind** — `FallingCrate · 3 components` | EntityOpsPanel summary |

---

## Patch model

Extend `src/lib/engine/ontology/durablePatch.ts`:

```ts
export type DurableDefineTypePatch = {
  kind: 'defineType';
  /** PascalCase type name (no type: prefix) */
  name: string;
  components: string[];
  /** Per-component durable defaults + formula strings (=…) */
  defaults?: Record<string, Record<string, unknown>>;
  /** When set, graph also sets conformsTo on this entity node */
  applyToEntityId?: string;
};

export type DurablePatchKind =
  | ...existing
  | 'defineType';
```

**Graph node written** (matches `loadOntology.registerTypeNode`):

```jsonc
{
  "@id": "type:FallingCrate",
  "@type": "EntityType",
  "components": ["Transform", "Render", "Gravity"],
  "defaults": {
    "Render": { "mesh": "/models/barrel.glb", "color": "#ff6b6b", "anchor": "bottom" },
    "Gravity": { "g": 9.8, "rest": 0.5 }
  }
}
```

### `applyDurablePatchToGraph` (`graphDiff.ts`)

| `defineType` | Effect |
| ------------ | ------ |
| Type node | Upsert `@id: type:{name}` — reject if node exists (Executor pre-check + graph guard) |
| `applyToEntityId` | Set `conformsTo: name` on matching entity node |

### `diffGraphToPatches`

When a new `EntityType` node appears in poll diff → emit `defineType` patch (minimum: apply path; diff emission required for Trellis subscribe).

---

## Capture helpers

**New:** `src/lib/engine/ontology/captureType.ts`

```ts
export function captureTypeFromEntity(entity: Entity): {
  components: string[];
  defaults: Record<string, Record<string, unknown>>;
};

export function canSaveAsType(entity: Entity): { ok: true } | { ok: false; reason: string };
```

### `captureTypeFromEntity`

- `components`: `Object.keys(entity.components).sort()`
- `defaults`: for each component, `durableBagOnly(comp, bag)` **plus** formula fields as `compiled.src` from `entity.formulas?.[comp]`
- Omit empty component bags from `defaults`

### `canSaveAsType`

| Condition | Result |
| --------- | ------ |
| `isPlayerEntity(entity)` | `{ ok: false, reason: 'Player entities cannot become types' }` |
| `isGroundEntity(entity)` | `{ ok: false, reason: 'Ground entities cannot become types' }` |
| `entity.id === SCENE_SETTINGS_ENTITY_ID` | `{ ok: false, reason: 'Scene settings cannot become types' }` |
| No `Render` and only `Transform`+`Marker` (spawn-only) | `{ ok: false, reason: 'Needs a renderable composition' }` |
| Otherwise | `{ ok: true }` |

### Name validation (UI + server-side guard)

- Pattern: `^[A-Z][a-zA-Z0-9]*$`
- Reserved: `BUILTIN_TYPE_NAMES` (`GroundPlane`, `Prop`, `SpawnPoint`, `AmbientLight`, `DirectionalLight`, `Player`)
- Collision: `getType(name)` already registered → error "Type `{name}` already exists"

**New in `registry.ts`:**

```ts
export const BUILTIN_TYPE_NAMES: ReadonlySet<string>;
export function listTypes(): string[];
export function isBuiltinType(name: string): boolean;
export function listWorldTypes(): string[]; // listTypes().filter(!isBuiltinType)
```

---

## WorldRuntime

**New:** `world.saveAsType(entityId, opts): Result`

```ts
type SaveAsTypeOpts = {
  name: string;
  applyToEntity: boolean; // default true — sets conformsTo on source
};
```

Flow:

1. Validate entity + name + collision
2. `captureTypeFromEntity(entity)`
3. Local: `registerType({ name, components, defaults })`
4. If `applyToEntity`: `entity.type = name` (RAM)
5. Build patch:

```ts
{
  kind: 'defineType',
  name,
  components,
  defaults,
  ...(applyToEntity ? { applyToEntityId: entityId } : {})
}
```

6. `#broadcastDurablePatch(patch)` + `#persistToStore(patch)`

**New:** `world.spawnFromType(typeName, suffix): Entity | null`

- Resolve `getType(typeName)`; error if missing
- Build entity via same merge path as `loadOntology.buildEntity` (type defaults + empty inline, assign `@id` from suffix)
- `spawn()` + net hook + select
- Used by `AddEntityDialog` on submit

---

## Remote apply (`applyMutation.ts`)

```ts
case 'defineType':
  registerType({ name, components, defaults });
  if (patch.applyToEntityId) {
    const entity = world.getEntity(patch.applyToEntityId);
    if (entity) entity.type = patch.name;
  }
  world.entities = [...world.entities];
```

Guard: `applyingRemoteDurable` — no write-back (same as TRL-C).

---

## UI

### `EntitySchemaPanel.svelte`

- Sticky **schema-footer** with outline `sm` **Save as type…**
- Disabled + `title` tooltip when `!canSaveAsType(entity).ok`
- Opens `SaveTypeDialog`

### `SaveTypeDialog.svelte` (new)

Per design artifact:

- Fields: type name, component chips (read-only), defaults preview, apply checkbox (default on), preview block
- zod validation mirroring name rules
- Submit → `world.saveAsType()` → toast success → close
- `ui.saveTypeOpen` + `ui.saveTypeEntityId` in `ui.svelte.ts`

### `AddEntityDialog.svelte`

- Type `<Select>`: optgroups **Built-in** / **World types** (`listWorldTypes()`)
- On submit: `world.spawnFromType(conformsTo, suffix)` instead of toast-only
- Dynamic zod: suffix unchanged; `conformsTo` enum extended with world type names

### `EntityOpsPanel.svelte`

- `defineType` row: `{name} · {n} components`

---

## Files (expected touch)

| File | Change |
| ---- | ------ |
| `ontology/durablePatch.ts` | `defineType` union member |
| `ontology/captureType.ts` | **new** — capture + eligibility |
| `ontology/registry.ts` | `listTypes`, `isBuiltinType`, `listWorldTypes`, `BUILTIN_TYPE_NAMES` |
| `durable/graphDiff.ts` | apply + diff `defineType` |
| `runtime/applyMutation.ts` | remote `defineType` |
| `runtime/world.svelte.ts` | `saveAsType`, `spawnFromType` |
| `durable/session.svelte.ts` | ops log `defineType` |
| `ui/SaveTypeDialog.svelte` | **new** |
| `ui/EntitySchemaPanel.svelte` | footer CTA |
| `ui/AddEntityDialog.svelte` | world types + spawn |
| `ui/ui.svelte.ts` | dialog state |
| `ui/EntityOpsPanel.svelte` | `defineType` display |
| `scripts/durable-smoke.ts` | `defineType` persist test |
| `e2e/save-entity-type.spec.ts` | **new** |

---

## Acceptance criteria

1. **`test:pnpm check`** — passes
2. **`test:pnpm test:durable`** — extended:
   - `defineType` writes `EntityType` node; reload preserves type + defaults
   - `applyToEntityId` sets entity `conformsTo` in graph
3. **`test:pnpm test:e2e e2e/save-entity-type.spec.ts`** — new:
   - Select prop with Gravity → Schema → Save as type → name `FallingCrate` → Save
   - Add entity → World types lists `FallingCrate` → spawn with suffix → entity appears in Objects tree with type components
4. **`test:pnpm test:e2e e2e/inspector-components.spec.ts e2e/smoke.spec.ts`** — still pass
5. **Host gate:** non-host save → local RAM + registry ok; Trellis write swallowed (`HostOnlyDurableError`) — match TRL-C
6. **Reserved names:** dialog blocks `Prop` with inline error
7. **Ineligible:** Player entity → Save button disabled with tooltip

**Labels:** `needs-e2e`

---

## Test plan (Executor)

```bash
pnpm check
pnpm test:durable
pnpm test:e2e e2e/save-entity-type.spec.ts
pnpm test:e2e e2e/inspector-components.spec.ts e2e/smoke.spec.ts
# Manual: ?durable=trellis → save type → reload → Add entity still lists type
```

---

## Non-goals (v1)

- Update existing EntityType in place
- ComponentSchema node authoring
- Asset dock / spawn palette integration
- Props tab menu entry
- `defineType` for TRL-B stretch kinds beyond EntityType node

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Registry pollution across world loads | World types overwritten on re-register; same as current `loadOntology` pass |
| Formula defaults in type | Capture formula `src`; exclude realtime fields in UI footnote |
| Add entity stub | Explicit `spawnFromType` AC |
