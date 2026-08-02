---
version: 1
name: GameMaker scripts (Phase 6)
parent: TRL-121
issue: TRL-134
impl: TRL-135
status: queue-ready
labels: spec, gamemaker-model, scripts
---

# Spec: Named scripts — reusable action lists + `script` refs

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 6  
**Impl:** TRL-135 (blocked on this spec)  
**Depends on:** Phase 0 event substrate (TRL-123) — `runActions`, full action DSL including `with` (TRL-129)

---

## Summary

Add **named, reusable action lists** authored as `@type: Script` meta nodes in the world JSON-LD. Event handlers (and other scripts) invoke them with **`{ "script": "<id>" }`**. Execution reuses **`runActions`** — same authority, formula scope, and multiplayer discipline as inline handlers. v1 is **static catalog from file** (no Trellis durable scripts, no parameters).

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Script storage | **Same JSON-LD file** as entities/rooms | One game project — GM model |
| Script node | **`@type: Script`**, `@id: script:<name>` | Meta node like `Room`, not an ECS entity |
| Body field | **`actions: EventAction[]`** | Same finite DSL as event handlers |
| Invoke action | **`{ "script": "<id>" \| expr }`** in `runActions` | Proposal action table |
| Catalog module | **`scriptCatalog.ts`** — parse, install, lookup | Mirrors `roomCatalog.ts` |
| Id normalization | Accept `"pickup"` or `"script:pickup"` → **`script:pickup`** | Consistent with room ids |
| Nested scripts | **Allowed** — script body may contain `{ "script": "…" }` | GM script calling script |
| Recursion guard | **Max depth 16**; warn-skip unknown id | Prevent infinite loops; no cycle analysis v1 |
| Script parameters | **Out of scope v1** | No `script:foo(a,b)` — use formulas on `self` |
| Authority | **Inherited from caller** — no new policy | `runActions` per-action checks unchanged (`isOwner`, `session.isHost` for `goto_room`) |
| `self` / `other` | **Passed through** `opts` to nested `runActions` | Script runs in invoking entity's context |
| Dynamic id | Formula string on `script` field evaluates then normalizes | `"= 'script:' + Tag.name"` etc. |
| Load integration | **`WorldShell`**: `parseScriptCatalog(doc)` after `loadOntology` | Catalog cleared on world reload |
| `loadOntology` | Skip `@type: Script` nodes in entity pass | `isScriptMetaNode()` guard |
| Play lifecycle | Catalog is static — **no runtime reset** | Unlike alarms/events state |
| Demo world | **`static/games/scripts-demo.jsonld`** | Key invokes named scripts |
| E2E | **`e2e/scripts-demo.spec.ts`** — paused scheduler probe | Deterministic |
| Workbench Scripts rail | **Out of scope** | TRL-137 |

---

## Data model

### Script node (JSON-LD meta — not an Entity)

```jsonc
{
  "@id": "script:reset-fuses",
  "@type": "Script",
  "title": "Reset all fuses",
  "actions": [
    {
      "with": "Fuse",
      "do": [{ "set": "Render.color", "to": "#ff6600" }]
    }
  ]
}
```

| Field | Type | Notes |
| ----- | ---- | ----- |
| `@id` | `script:<slug>` | Canonical id passed to `{ "script": "…" }` |
| `title` | string | UI/debug (optional) |
| `actions` | `EventAction[]` | Ordered handler body — same DSL as `events.create` etc. |

### `ScriptAction` (`schema.ts`)

```ts
export interface ScriptAction {
  script: unknown; // script id string or formula
}

export type EventAction =
  | SetAction
  | SpawnAction
  | DestroyAction
  | IfAction
  | AlarmAction
  | ScoreAction
  | SfxAction
  | WithAction
  | GotoRoomAction
  | ScriptAction;
```

---

## Runtime

### Script catalog (`scriptCatalog.ts` — new)

```ts
export type ScriptDef = {
  id: string;
  title?: string;
  actions: EventAction[];
};

export function normalizeScriptId(id: string): string;
export function parseScriptCatalog(doc: JsonLdDoc): Map<string, ScriptDef> | null;
export function installScriptCatalog(catalog: Map<string, ScriptDef> | null): void;
export function getScriptCatalog(): Map<string, ScriptDef> | null;
export function getScriptActions(id: string): EventAction[] | null;
export function clearScriptCatalog(): void;
export function isScriptMetaNode(node: JsonLdNode): boolean;
```

**Parse rules:**

1. Walk `@graph`; collect nodes where `@type === 'Script'` and `@id` present.
2. Require `actions` to be an array; warn-skip malformed nodes.
3. Return `null` when zero scripts (no catalog overhead for worlds without scripts).

**Validation (warn-only v1):**

- Unknown action keys in script body → existing `runActions` ignores unrecognized shapes.
- Duplicate `@id` → last wins with console warning.

### `script` action in `runActions` (`eventSystem.ts`)

```ts
} else if ('script' in action) {
  const scriptId = normalizeScriptId(String(evalValue(action.script, entity, ctx, other)));
  const actions = getScriptActions(scriptId);
  if (!actions) {
    console.warn(`[events] script: unknown "${scriptId}"`);
    continue;
  }
  const depth = (opts?.scriptDepth ?? 0) + 1;
  if (depth > MAX_SCRIPT_DEPTH) {
    console.warn(`[events] script: max depth exceeded at "${scriptId}"`);
    continue;
  }
  runActions(entity, actions, ctx, { ...opts, scriptDepth: depth });
}
```

Extend `runActions` opts:

```ts
opts?: { other?: Entity; scriptDepth?: number }
```

Export **`MAX_SCRIPT_DEPTH = 16`** for tests.

### `WorldShell.svelte` integration

After ontology load (same pattern as rooms):

```ts
const doc = await source();
const entities = await loadOntology(() => Promise.resolve(doc));
const scripts = parseScriptCatalog(doc);
if (scripts) installScriptCatalog(scripts);
else clearScriptCatalog();
```

Worlds without scripts: `clearScriptCatalog()` on reload.

### `loadOntology.ts`

Add `isScriptMetaNode(node)` to the entity-pass skip list alongside `Room` meta nodes.

---

## Demo world — `static/games/scripts-demo.jsonld`

| Piece | Role |
| ----- | ---- |
| `script:bump-score` | `{ "score": 1 }` |
| `script:reset-fuses` | `{ "with": "Fuse", "do": [{ "set": "Render.color", "to": "#ff6600" }] }` |
| `script:combo` | Nested: calls `script:bump-score` then `script:reset-fuses` |
| `type:Fuse` | Orange box (same pattern as input-demo) |
| Player `keydown` **`e`** | `{ "script": "script:bump-score" }` |
| Player `keydown` **`r`** | `{ "script": "script:combo" }` |
| Ground + spawn + ambient | Boot |

Load: `?game=scripts-demo&mode=play`

---

## E2E — `e2e/scripts-demo.spec.ts`

1. `primeCollabStorage`, goto `?game=scripts-demo&mode=play`
2. Pause scheduler; `world.isOwner = () => true`
3. Simulate key **`e`** via `input.drainKeydown('e')` + `inputEventSystem` tick (or direct `runActions` with script action)
4. Assert `score.value === 1`
5. Simulate key **`r`** (combo script)
6. Assert score incremented again **and** all `Fuse` entities have `Render.color === '#ff6600'`
7. `world.restorePlayState()` — score/fuse state restored

Regression: `e2e/input-demo.spec.ts` unchanged (inline `with` still works).

---

## Files

| File | Change |
| ---- | ------ |
| `docs/artifacts/gamemaker_scripts_spec.md` | **This spec** |
| `src/lib/engine/ontology/schema.ts` | `ScriptAction` |
| `src/lib/engine/ontology/scriptCatalog.ts` | **New** — parse + lookup |
| `src/lib/engine/ontology/loadOntology.ts` | Skip Script meta nodes |
| `src/lib/engine/systems/eventSystem.ts` | `script` branch + `scriptDepth` opts |
| `src/lib/ui/WorldShell.svelte` | Install catalog on load |
| `static/games/scripts-demo.jsonld` | **New** |
| `e2e/scripts-demo.spec.ts` | **New** |

**Out of scope:** script parameters/args; Trellis-backed script assets; Workbench script editor; hot-reload script edits in play.

---

## Acceptance criteria

1. `@type: Script` nodes parse into catalog; `@id` + `actions` required.
2. Event handlers can **`{ "script": "script:<name>" }`** — executes catalog body via `runActions`.
3. Nested script refs work; depth **> 16** warn-skips without stack overflow.
4. Unknown script id warn-skips; inline actions continue.
5. `static/games/scripts-demo.jsonld` — E bumps score, R runs combo (score + fuse reset).
6. `pnpm check` passes.
7. `PW_REUSE=1 pnpm test:e2e e2e/scripts-demo.spec.ts` passes.
8. `PW_REUSE=1 pnpm test:e2e e2e/input-demo.spec.ts` — no regression.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/scripts-demo.spec.ts
PW_REUSE=1 pnpm test:e2e e2e/input-demo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| P6b | Script parameters / local bindings |
| P6c | Trellis durable script assets |
| UI | Workbench Scripts rail + action list editor (TRL-137) |
| Harden | Cycle detection beyond depth cap |
