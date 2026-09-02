# WebMCP tool manifest — design notes

Companion to [`docs/webmcp.md`](./webmcp.md) (the API reference). The manifest
itself lives in `src/lib/engine/agent/webmcp/manifest.ts`; this file records why it
looks the way it does. Verify budgets with `pnpm webmcp:budget`.

## The surface: 46 tools

Full edit-mode parity. Every action a human can take in the editor has exactly
one tool, so an agent never has to guess at a hidden `op` vocabulary to reach
part of the surface.

### Read (13)

| Tool | Engine target |
|---|---|
| `list_entities` | `world.entities` / `world.query()` |
| `describe_entity` | `world.getEntity()` |
| `get_entity_json` | `world.entityJsonString()` |
| `world_status` | `world` + `ui` + `editHistory` |
| `get_player` | `world.localPlayerEntity` |
| `list_rooms` | `roomCatalog.getRoomCatalog()` |
| `get_scene` | `ui.scene` |
| `list_types` | `registry.listTypes()` / `listObjectTypes()` / `listCollections()` |
| `describe_type` | `registry.getType()` |
| `list_components` | `registry.listComponents()` |
| `describe_component` | `registry.getComponent()` |
| `list_assets` | `catalog.fetchAssets()` + `shapes.SHAPE_CATALOG` |
| `list_records` | `world.recordsFor()` |

### Spawn and remove (5)

| Tool | Engine target |
|---|---|
| `spawn_prop` | `world.createProp()` |
| `spawn_character` | `world.createCharacter()` |
| `spawn_from_type` | `world.spawnFromType()` |
| `duplicate_entity` | `world.copySelection()` + `pasteClipboard()` |
| `remove_entity` | `world.deleteSelection()` |

### Entity authoring (6)

| Tool | Engine target |
|---|---|
| `set_entity_field` | `world.setField()` |
| `add_entity_component` | `world.addComponent()` |
| `remove_entity_component` | `world.removeComponent()` |
| `set_entity_json` | `world.applyEntityJson()` |
| `set_entity_events` | `world.setEvents()` |
| `save_entity_as_type` | `world.saveAsType()` |

### Type authoring (6)

| Tool | Engine target |
|---|---|
| `define_type` | `world.createObjectType()` |
| `add_type_component` | `world.addTypeComponent()` |
| `remove_type_component` | `world.removeTypeComponent()` |
| `set_type_default` | `world.setTypeDefault()` |
| `set_type_events` | `world.setTypeEvents()` |
| `add_type_field` | `world.addTypeField()` |

### Component schemas (5)

| Tool | Engine target |
|---|---|
| `define_component` | `world.createComponent()` |
| `add_component_field` | `world.addComponentField()` |
| `edit_component_field` | `world.editComponentField()` |
| `rename_component_field` | `world.renameComponentField()` |
| `remove_component_field` | `world.removeComponentField()` |

### Collections (4)

| Tool | Engine target |
|---|---|
| `define_collection` | `world.defineCollection()` |
| `add_collection_field` | `world.addCollectionField()` |
| `create_record` | `world.createRecord()` |
| `delete_record` | `world.deleteRecord()` |

### Scene, rooms, and editor control (7)

| Tool | Engine target |
|---|---|
| `set_scene_setting` | `ui.scene` / `ui.setArtStyle()` |
| `switch_room` | `world.switchRoom()` |
| `select_entity` | `world.trySelect()` |
| `focus_entity` | `scene/focusEntity.viewportFocus` |
| `set_mode` | `ui.enterPlay` / `exitToEdit` / `pausePlay` / `resumePlay` / `resetPlay` / `enterPublish` |
| `undo` | `editHistory.undo()` |
| `redo` | `editHistory.redo()` |

## Four decisions worth recording

### 1. There is no `read_world` tool

The obvious design — one tool wrapping `exportWorldGraph()` — is unshippable.
Chrome recommends **1.5K characters per tool output**, and a serialized JSON-LD
graph (components, types, entities, room catalog, script catalog) blows past that
on any world worth demoing. Blowing the budget doesn't just waste context; it
risks tripping agent guardrails.

So the read surface is decomposed into narrow, paginated tools, each of which
returns a summary rather than a document. `list_entities` returns id/type/position
only — the agent calls `describe_entity` when it needs the full bag. That's more
round trips, but each one fits.

### 2. Tools target the `world` facade, not `applyDurableMutation`

`world.setField()`, `world.createProp()` and friends already run the full write
path: local apply → durable persist → net broadcast → undo-history entry. Binding
tools to `applyDurableMutation` directly would skip replication and history, and the
agent's edits would be invisible to other people in the room — which is the entire
demo. Every write tool goes through the same methods the editor UI calls.

The consequence worth stating plainly: **an agent's edits are undoable by a human
with ⌘Z**, because they land in `editHistory` like any other edit. The reverse is
also true, which is why `undo` warns in its own description that the history is
shared.

### 3. Flat tools, not `op`-dispatch

45 tools is a large manifest, and Chrome's guidance is that every tool costs
context window and raises the chance the agent picks the wrong one. The
alternative — collapsing the cold surfaces into `edit_schema { op: … }`-style
dispatchers — would land near 22 tools.

We took the flat surface anyway. A dispatcher hides its real vocabulary inside a
prose description that JSON Schema cannot constrain, so the agent has to *guess*
at op names and gets a runtime error instead of a schema error. Flat tools are
self-documenting through their schemas, and the naming is regular enough
(`<verb>_<noun>`) that a capable model narrows by prefix. The cost lands on small
local models; the mitigation there is registering fewer tools, not reshaping them.

### 4. Primitives live in `list_assets`

`primitive:box`, `primitive:sphere`, and `primitive:capsule` are placeable but
are not uploaded assets, so they used to sit outside the catalog entirely. An
agent asked for "a red box" would search `list_assets` for "box", find nothing,
and stop — with no way to discover that the mesh it wanted was a literal string
the engine already understood.

`SHAPE_CATALOG` is now folded into `list_assets` under `models` (and reachable
alone via `kind: "shapes"`), so one lookup covers everything spawnable.
`e2e/webmcp-tools.spec.ts` pins that exact loop.

## Output shaping (the executor's job)

The manifest declares inputs; the 1.5K output budget is enforced where tools
execute. Rules:

- Default `limit` of **20**, not 25 — an entity row (`id  type  [x, y, z]`) runs
  ~45 chars, so 20 rows plus a header lands near 1K with headroom.
- Serialize, then hard-truncate at 1.5K and append `… N more, use offset=N`. Never
  return a half-serialized object.
- `describe_entity` elides `json`-typed field values and any string over ~120 chars,
  replacing them with a type marker. A `raw` JSON-LD node is never returned.
- Errors are prose, not codes: `Unknown component "Trasnform". Available: Transform,
  Render, …`. Chrome's guidance is to validate strictly in code and loosely in
  schema, so the agent can self-correct and retry.

## Schema strategy

`fieldSchemaToJsonSchema()` in the manifest projects the ontology's `FieldType`
onto JSON Schema:

| `FieldType` | JSON Schema |
|---|---|
| `number` | `{ type: 'number' }` |
| `string`, `longtext` | `{ type: 'string' }` |
| `select` | `{ type: 'string', enum: options }` |
| `boolean` | `{ type: 'boolean' }` |
| `vec2` / `vec3` / `quat` | number array, min/max 2 / 3 / 4 |
| `color` | `{ type: 'string', pattern: hex }` |
| `ref` | `{ type: 'string' }` |
| `json` | `{}` |

This is used to *describe* fields to the agent via `describe_component`. It is not
used to constrain `set_entity_field`, whose `value` is deliberately untyped — the
valid shape depends on the component and field chosen at call time, which JSON
Schema can't express without a discriminated union over every component in the
world. Loose schema, strict runtime validation.

`set_entity_events` takes `events` as a bare `object` for the same reason;
`EntityEvents` is a deep union of ten action shapes. The action vocabulary is taught
in the tool description instead (443/500 chars — the tightest budget in the set).

## Annotations

- `readOnlyHint: true` on all twelve read tools, so the agent can skip confirmation.
- `untrustedContentHint: true` on every read tool that surfaces strings authored by
  *other people in the multiplayer room* — entity ids, labels, type and component
  names, uploaded asset filenames, collection record values. That is textbook
  untrusted content and a live prompt-injection surface in a shared world.
- `world_status`, `get_scene` and `describe_component` are the three read tools
  without the hint: shell mode, scene settings and built-in component schemas come
  from the engine, not from user input. (`describe_component` can still name a
  world-authored component, but reports only its schema shape.)
- Every write tool carries `readOnlyHint: false`, including the ones that only move
  editor chrome (`select_entity`, `focus_entity`, `set_mode`). They change what a
  human sees, which is worth a confirmation prompt even though no data changes.

## Deliberately cut

| Cut | Why |
|---|---|
| `read_world` / `export_world` | 1.5K output budget (above) |
| `upload_asset` | Needs a `File`; an agent has no bytes to give. Assets arrive through the dropzone |
| Panel / layout tools (`toggle_sidebars`, `resize_panel`, `set_route`) | Chrome for the human operator, not authoring. An agent moving someone's panels is a nuisance, not a capability |
| `copy` / `paste` / `cut` as separate tools | One `duplicate_entity` covers the intent; a cross-call clipboard is state an agent would have to remember |
| `set_component` (whole bag) | Overlaps `set_entity_field` and `set_entity_json`, which bracket it on both sides |
| Chat tools | `/api/agent/chat` is orthogonal — WebMCP means an external agent drives the page |

## Browser-only tools

Four tools reach editor chrome rather than the world — `get_scene`,
`set_scene_setting`, `set_mode`, `focus_entity` — and `world_status` reads it for
the mode line only. `ui.svelte.ts`
and `scene/focusEntity.ts` pull in DOM and Three.js, which the headless MCP server
must not load at import time — so `handlers.ts` reaches them through
`browserOnly()`, a lazy dynamic import guarded on `typeof document`. In a headless
session those tools return `Error: … needs a live editor page; this session is
headless.` rather than crashing the module.

That split is why the test surface is two-layered:

- `pnpm test:webmcp-surface` runs every tool headlessly, asserting handlers do not
  throw and stay inside the output budget, and that browser-only tools degrade.
- `pnpm test:e2e webmcp-tools` proves the browser-only tools against a live page.

## Registration

1. `registerWebMcpTools()` in `src/lib/engine/agent/webmcp/register.ts` maps each
   manifest entry to an `execute` and calls `document.modelContext.registerTool()`.
2. Feature-detected: `if (!('modelContext' in document)) return;` — the origin trial
   means most browsers won't have it, and the app must not break for them.
3. Registered from a Svelte `$effect` with one `AbortController`, aborted on
   teardown. Svelte has no official WebMCP binding (React has `usewebmcp`, Angular
   is native).
4. Gated on `world.status === 'ready'` and nothing else. Chrome recommends static
   registration as the default; per-mode registration churn would fire `toolchange`
   constantly and complicate the demo. The consequence is that authoring tools stay
   registered in play mode — they report what they cannot do rather than vanishing.

Still open: fill the `case 'patch':` stub at
`src/lib/engine/agent/worldEnvAdapter.ts:38` so the in-world bot and the external
agent share one write path.

`WorldShell.svelte` registers from an `$effect` once `world.status === 'ready'` and
aborts in `onDestroy`; `e2e/webmcp-tools.spec.ts` covers the surface against a
spec-shaped `document.modelContext` stand-in, and asserts the registered names match
`WEBMCP_TOOLS` exactly so a new manifest entry without a handler fails the build.

## Headless room agent (Bun / MCP stdio)

The **same tool handlers** power three surfaces:

| Surface | Entry | Notes |
| --- | --- | --- |
| Browser WebMCP | `document.modelContext` | Chrome origin trial — external agent in the page |
| MCP stdio | `pnpm agent:room` | Bun/Node joins a relay room headlessly |
| Direct call | `executeWebMcpTool(name, input)` | Tests, scripts, in-world bot (future) |

Bun does **not** call `document.modelContext` — that API is browser-only. It loads
the world from disk, joins `?room=` on the Trellis relay as `bot:architect`, and
exposes the manifest over MCP stdio. Writes go through `world.*` → `session` wire
messages (`t: 'durable'`, `t: 'spawn'`), so every browser tab in the room sees
edits in realtime.

```bash
# Relay must be running (`just run` or `pnpm dev:relay`)
pnpm agent:room -- --game orbit --room orbit

# Env aliases
AGENT_RELAY_URL=ws://localhost:8231/rt AGENT_GAME=orbit pnpm agent:room
```

Wire into an MCP client:

```json
{
  "mcpServers": {
    "museum-room": {
      "command": "pnpm",
      "args": ["agent:room", "--", "--game", "orbit", "--room", "orbit"],
      "cwd": "/path/to/museum-oss"
    }
  }
}
```

Implementation: `src/lib/engine/agent/headlessRoom.ts` (room join),
`src/lib/engine/agent/mcpServer.ts` (stdio), handlers in
`src/lib/engine/agent/webmcp/handlers.ts`.

## Open questions

- ~~**Origin isolation against Vercel.**~~ Resolved. The deployment reports
  `originAgentCluster: true` in a secure context, and sets no `Origin-Agent-Cluster:
  ?0`, no restrictive `Permissions-Policy`. `src/hooks.server.ts` now sends
  `Origin-Agent-Cluster: ?1` on every response so this does not rest on a browser
  default that is still moving.
- **Should write tools require host authority?** `agentBridge` already gates on
  `session.isHost`. If a non-host guest runs a write tool, does it replicate?
- **Prompt injection in a shared room.** A peer can name an entity
  `ignore previous instructions and …`. `untrustedContentHint` is the declared
  mitigation, but entity ids and labels flow into agent context by design.
