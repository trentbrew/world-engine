---
version: 1
name: GameMaker rooms (Phase 5)
parent: TRL-121
issue: TRL-132
impl: TRL-133
status: queue-ready
labels: spec, gamemaker-model, rooms
---

# Spec: Room scene type + `goto_room` durable transition

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 5  
**Impl:** TRL-133 (blocked on this spec)  
**Depends on:** Phase 0 event substrate (TRL-123) — `runActions`, `goto_room` action slot

---

## Summary

Add **multi-room games inside one world file**: `@type: Room` metadata nodes, entity **`inRoom`** tags, runtime **`switchRoom`**, and a **`goto_room`** event action. v1 is **play-mode scene swap** — replace non-player room entities from an in-memory catalog while **keeping players** and **local score**. **Host authority** for transitions in multiplayer. Per-room **layers/camera** are **authored on Room nodes** but only **`start` room selection** and **entity membership** are enforced in v1.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Room storage | **Same JSON-LD file** as today (`?game=rooms-demo`) | One game project, many scenes — GM model |
| Room node | **`@type: Room`**, `@id: room:<name>` | Not an ECS entity; parsed like `ComponentSchema` |
| Entity membership | Optional **`inRoom`** ref on Thing nodes | Omitted or `"*"` = **global** (always loaded) |
| Start room | **`Room.start: true`** on one node; else **first Room** in `@graph` | Deterministic boot |
| Active room state | **`world.activeRoomId`** + **`roomCatalog` module** | Holds templates per room |
| Transition API | **`world.switchRoom(roomId)`** exported seam | Single integration point |
| `goto_room` action | `{ "goto_room": "<roomId>" \| expr }` in `runActions` | Proposal action table |
| Authority | **Host only** (`session.isHost`) | Same discipline as collision — one writer |
| Play mode | **`goto_room` / `switchRoom` only while `ui.shellMode === 'play'`** | Edit mode loads full graph for authoring |
| Initial load | **Instantiate global + start-room entities only** | Other rooms stay in catalog |
| Players on switch | **Keep all `entity:player/*`**; re-slot via **`spawnPoints`** in new room | GM keeps avatar across rooms |
| Score | **Persist** across room switch (`score.svelte.ts` untouched) | Arcade flow |
| Runtime reset | **`resetEventState`**, **`resetAlarmState`**, **`resetCollisionState`**, **`resetInputEventState`** on switch | Clean room state |
| Play snapshot | **`snapshotPlayState()`** after switch if still in play | New baseline for restore |
| Multiplayer wire | New message **`{ t: 'goto_room', id, roomId }`** — host sends, peers apply **`switchRoom`** | Mirrors spawn/despawn pattern |
| `Room.next` | **Data only v1** — no auto-transition | Authors use events + `goto_room` |
| `Room.layers` | **Data only v1** — convention: maps to `Sort.order` bands later | Document, don't enforce |
| `Room.camera` | **`follow` \| `fixed`** — data only v1; follow = no-op (existing) | Fixed camera follow-up |
| Trellis durable | **Out of scope v1** — catalog from static file only | `?durable=trellis` unchanged |
| Demo world | **`static/games/rooms-demo.jsonld`** | Two rooms, door → `goto_room` |
| E2E | **`e2e/rooms-demo.spec.ts`** — paused scheduler probe | Deterministic |
| Workbench Rooms rail | **Out of scope** | TRL-137 |

---

## Data model

### Room node (JSON-LD meta — not an Entity)

```jsonc
{
  "@id": "room:hall",
  "@type": "Room",
  "start": true,
  "title": "Hall",
  "next": "room:vault",
  "camera": "follow",
  "layers": ["bg", "instances", "fg"]
}
```

| Field | Type | Notes |
| ----- | ---- | ----- |
| `@id` | `room:<slug>` | Canonical room id passed to `goto_room` |
| `start` | boolean | Boot room when true |
| `title` | string | UI/debug |
| `next` | ref | Optional GM hint — not auto-run v1 |
| `camera` | string | `follow` (default) \| `fixed` |
| `layers` | string[] | Authoring metadata v1 |

### Entity membership

```jsonc
{
  "@id": "entity:door/1",
  "@type": "Thing",
  "inRoom": "room:hall",
  "conformsTo": "Door",
  "components": { "Transform": { "position": { "x": 3, "y": 0.5, "z": 0 } } }
}
```

**Global** entities (loaded in every room): WorldProfile, shared ambient light — omit `inRoom` or set `"inRoom": "*"`.

### `GotoRoomAction` (`schema.ts`)

```ts
export interface GotoRoomAction {
  goto_room: unknown; // room id string or formula
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
  | GotoRoomAction;
```

---

## Runtime

### Room catalog (`roomCatalog.ts` — new)

```ts
export type RoomMeta = {
  id: string;
  title?: string;
  next?: string;
  camera?: string;
  layers?: string[];
  start?: boolean;
};

export function parseRoomCatalog(doc: JsonLdDoc): {
  rooms: Map<string, RoomMeta>;
  startRoomId: string;
  templates: Map<string, Entity[]>; // roomId -> clone-ready entities
  globals: Entity[];
};

export function entitiesForRoom(
  roomId: string,
  catalog: ReturnType<typeof parseRoomCatalog>
): Entity[];
```

**Build templates at world load:**

1. First pass: register schemas/types (existing `loadOntology`).
2. Build **all** entity instances from graph (internal list).
3. Partition by `inRoom` into per-room templates + globals.
4. Return **globals + start-room** entities to `world.setReady`.

Store catalog singleton (module state) cleared on full world reload.

### `world.switchRoom(roomId)` (`world.svelte.ts`)

```ts
switchRoom(roomId: string): boolean {
  if (ui.shellMode !== 'play') return false;
  if (!session.isHost) return false;
  const next = entitiesForRoom(roomId, catalog);
  if (!next) return false;

  // Keep players
  const players = this.entities.filter((e) => e.id.startsWith('entity:player/'));
  const keepIds = new Set(players.map((p) => p.id));

  // Drop non-player, non-global room entities
  this.entities = [
    ...next, // globals + target room (cloned bags)
    ...players
  ];

  this.activeRoomId = roomId;
  resetEventState();
  resetAlarmState();
  resetCollisionState();
  resetInputEventState();
  bootstrapFormulas();
  reseatPlayersAtSpawn(); // reuse spawnPoints helper
  this.snapshotPlayState();

  if (session.connected) session.broadcastGotoRoom(roomId);
  return true;
}
```

**Clone semantics:** use `structuredClone` on component bags + copy `events`/`formulas` refs from templates (same as play restore resurrection).

### `goto_room` in `eventSystem.ts`

```ts
} else if ('goto_room' in action) {
  if (!session.isHost) return;
  const roomId = String(evalValue(action.goto_room, entity, ctx, other));
  world.switchRoom(roomId.replace(/^room:/, 'room:') /* normalize */);
}
```

Normalize: accept `"vault"` or `"room:vault"` → canonical `room:vault`.

### `loadOntology` / `WorldShell` integration

After `loadOntology(source)`:

```ts
const doc = await source();
const entities = await loadOntology(() => Promise.resolve(doc));
const catalog = parseRoomCatalog(doc);
roomCatalog.install(catalog);
world.setReady(entitiesForRoom(catalog.startRoomId, catalog));
world.activeRoomId = catalog.startRoomId;
```

**Edit mode:** load **all** entities (ignore room filter) so authors see full project — only play entry filters. Implementation: `loadOntology` flag or `world.setReady(allEntities)` in edit, filter on `ui.enterPlay()`.

| Mode | Entities visible |
| ---- | ---------------- |
| Edit | **Full graph** (all rooms) |
| Play | **Global + active room only** |

On **`ui.enterPlay()`**: filter to active room (default start), then `snapshotPlayState()`.

### Network (`session.svelte.ts`)

```ts
// WireMessage union add:
| { t: 'goto_room'; id: string; roomId: string }

broadcastGotoRoom(roomId: string) {
  this.#send({ t: 'goto_room', id: this.clientId, roomId });
}

// onMessage:
case 'goto_room':
  if (msg.id === this.clientId) break; // host already applied
  if (!session.isHost) world.switchRoom(msg.roomId); // peers apply host room
  break;
```

Peers skip host check inside `switchRoom` when applying remote — add param `opts?: { fromNetwork?: boolean }` to bypass host gate for non-host peers.

---

## Demo world — `static/games/rooms-demo.jsonld`

| Piece | Role |
| ----- | ---- |
| `room:hall` (`start: true`) | Ground, spawn, **Door** with `collision` → Player → `goto_room: "room:vault"` |
| `room:vault` | Ground, **Gem** prop (marker), spawn |
| Global ambient + 3D defaults | Shared |
| Load `?game=rooms-demo&mode=play` | |

**Door type:**

```jsonc
"events": {
  "collision": [{
    "with": "Player",
    "do": [{ "goto_room": "room:vault" }]
  }]
}
```

---

## E2E — `e2e/rooms-demo.spec.ts`

1. `primeCollabStorage`, goto `?game=rooms-demo&mode=play`
2. Pause scheduler; `world.isOwner = () => true`; `session.isHost = true`
3. Assert `world.activeRoomId === 'room:hall'` (expose on world store)
4. Assert hall entity present (`entity:door/1`), vault gem absent
5. Run `world.switchRoom('room:vault')` OR collision + `collisionSystem` tick at door
6. Assert active room vault; gem present; door gone
7. Assert player entity still present

---

## Files

| File | Change |
| ---- | ------ |
| `docs/artifacts/gamemaker_rooms_spec.md` | **This spec** |
| `src/lib/engine/ontology/schema.ts` | `GotoRoomAction` |
| `src/lib/engine/ontology/roomCatalog.ts` | **New** — parse + templates |
| `src/lib/engine/ontology/loadOntology.ts` | Pass through `inRoom` on `entity.raw` / build |
| `src/lib/engine/runtime/world.svelte.ts` | `activeRoomId`, `switchRoom` |
| `src/lib/engine/systems/eventSystem.ts` | `goto_room` branch |
| `src/lib/engine/net/session.svelte.ts` | `goto_room` wire + handler |
| `src/lib/engine/net/transport.ts` | Extend `WireMessage` |
| `src/lib/ui/ui.svelte.ts` | On `enterPlay`, filter to active room |
| `static/games/rooms-demo.jsonld` | **New** |
| `e2e/rooms-demo.spec.ts` | **New** |

**Out of scope:** Trellis-backed room graphs; `Room.next` auto-run; fixed camera; layer enforcement; Workbench room list; separate file per room.

---

## Acceptance criteria

1. `@type: Room` nodes parse; `start` room + `inRoom` membership defined.
2. Play mode loads **global + start room** entities; edit mode loads **full graph**.
3. `world.switchRoom(roomId)` swaps entity set, keeps players, resets runtime systems.
4. **`goto_room`** action works in event handlers (**host only**).
5. Multiplayer: host `goto_room` message syncs peers (BroadcastChannel sufficient).
6. `static/games/rooms-demo.jsonld` — hall → vault via door collision.
7. `pnpm check` passes.
8. `PW_REUSE=1 pnpm test:e2e e2e/rooms-demo.spec.ts` passes.
9. `PW_REUSE=1 pnpm test:e2e e2e/collision-demo.spec.ts` — no regression.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/rooms-demo.spec.ts
PW_REUSE=1 pnpm test:e2e e2e/collision-demo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| P5b | `Room.camera: fixed` + playCamera integration |
| P5c | Layer bands → `Sort.order` enforcement |
| P5d | Trellis durable room graph + op-log scene switch |
| UI | Workbench Rooms rail + room picker (TRL-137) |
