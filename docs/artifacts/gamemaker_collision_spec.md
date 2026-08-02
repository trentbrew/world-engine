---
version: 1
name: GameMaker collision events (Phase 2)
parent: TRL-121
issue: TRL-126
impl: TRL-127
status: queue-ready
labels: spec, gamemaker-model, collision
---

# Spec: Collision events — `onCollision(other)`, host authority, Collectible migration

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 2  
**Impl:** TRL-127 (blocked on this spec)  
**Depends on:** Phase 0 event substrate (TRL-123) — `runActions`, `despawnRuntime`, `actionScope`

---

## Summary

Generalize pickup/collision into **data-authored collision handlers**: when entity **A** overlaps entity **B**, the **host** runs **A**'s `collision` handler list with **`other`** bound to **B**'s components. Reuse the existing **XZ proximity probe** from `collect.ts` for v1 (Rapier contacts deferred). Migrate **`Collectible`** worlds to collision events; retire **`collectSystem`** from the scheduler.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Detection v1 | **XZ circle proximity** — same math as `collect.ts` | Ships now; proposal open Q#2 (Rapier vs proximity) → **proximity wins for Phase 2** |
| Rapier contacts | **Out of scope v1** | Follow-up wedge after play-mode physics coverage is stable |
| Authority | **Host only** (`session.isHost`) | Proposal authority table; single writer for score/despawn side effects |
| Which entity fires | **The entity carrying the `collision` handler** (self) | GM model: Coin's collision event, not Player's |
| Bidirectional | **Both directions** if both entities have matching handlers | A→B and B→A evaluated independently same tick |
| `with` filter | **`with: "TypeName"`** matches `entity.type` (case-sensitive) | `"Player"` matches local/remote player avatars |
| Handler shape | **Array of rules** `{ "with": "<Type>", "do": [ … ] }` | Multiple collision partners per object |
| Probe radius | **`Collectible.radius` if present**, else **`Collision.radius`**, else **0.5** | Keeps migrated coins unchanged; general colliders get `Collision` |
| `Collision` component | **New** optional `{ radius, mask }` — `mask: "circle_xz"` only in v1 | Non-collectible colliders without Collectible data |
| `other` binding | **`actionScope(entity, ctx, { other: partner.components })`** | Formulas/actions read `other.Transform`, `Collectible.value`, etc. |
| New actions | **`score`** and **`sfx`** join the DSL | Required for Collectible parity |
| `score` action | `{ "score": <expr> }` → `score.add(Number(expr))` on **local client** | Score is local UI state today; host runs handler once per session |
| `sfx` action | `{ "sfx": <expr> }` → `playSfx(String(expr))` | Literal or formula (e.g. `=Collectible.sfx`) |
| System order | **`collisionSystem` after `alarmSystem`, before `eventSystem`** | Discrete contact before step/alarms fire (GM-like start-of-step) |
| Dedup | **No pair dedup within a tick** — if still overlapping, fires every tick | Matches current `collect.ts` + GM continuous collision |
| `collectSystem` | **Remove from scheduler** after migration | Behavior becomes data; component stays for radius/value/sfx |
| Demo worlds | Migrate **`collect.jsonld`** Coin type; add **`collision-demo.jsonld`** minimal wedge | Keep collect-race/parkour on migrated Coin type |
| E2E | **`e2e/collision-demo.spec.ts`** — paused scheduler probe | Deterministic host-side dispatch |
| Play lifecycle | **`resetCollisionState()`** no-op v1 (no module caches) | Hook for future pair dedup / Rapier adapter |

---

## Data model

### `Collision` component (built-in registry)

```ts
registerComponent({
  name: 'Collision',
  fields: {
    radius: { t: 'number', default: 0.5 },
    mask: { t: 'string', default: 'circle_xz' }
  }
});
```

No view. **`Collectible` unchanged** — radius/value/sfx remain authoring data.

### Collision handler types (`schema.ts`)

```ts
export interface CollisionRule {
  /** EntityType name to match (e.g. "Player"). Omit = any overlap partner. */
  with?: string;
  do: EventAction[];
}

export type CollisionHandlers = CollisionRule[];

export type EntityEvents = Partial<
  Record<EventTrigger | AlarmTrigger | 'collision', CollisionHandlers | EventAction[]>
>;
```

**Normative JSON-LD** (Coin pickup):

```jsonc
{
  "@id": "type:Coin",
  "@type": "EntityType",
  "components": ["Transform", "Render", "Collectible"],
  "defaults": {
    "Render": { "color": "#e8c14a" },
    "Transform": { "scale": [0.35, 0.35, 0.35] }
  },
  "events": {
    "collision": [
      {
        "with": "Player",
        "do": [
          { "score": "=Collectible.value" },
          { "sfx": "=Collectible.sfx" },
          { "destroy": "self" }
        ]
      }
    ]
  }
}
```

### New action types (`schema.ts`)

```ts
export interface ScoreAction {
  score: unknown; // number or formula
}

export interface SfxAction {
  sfx: unknown; // string ref or formula
}

export type EventAction =
  | SetAction | SpawnAction | DestroyAction | IfAction | AlarmAction
  | ScoreAction | SfxAction;
```

---

## Runtime

### Probe helper (`collisionProbe.ts` — new, shared)

```ts
export function collisionRadius(entity: Entity): number | null {
  const c = entity.components.Collectible as { radius?: number } | undefined;
  if (c?.radius != null) return Number(c.radius);
  const col = entity.components.Collision as { radius?: number } | undefined;
  if (col?.radius != null) return Number(col.radius);
  return entity.events?.collision ? 0.5 : null;
}

export function xzOverlaps(
  aPos: [number, number, number],
  aRadius: number,
  bPos: [number, number, number],
  bRadius: number
): boolean {
  const dx = aPos[0] - bPos[0];
  const dz = aPos[2] - bPos[2];
  const reach = aRadius + bRadius;
  return dx * dx + dz * dz <= reach * reach;
}
```

**Player probe radius:** use **`0.4`** constant (player capsule-ish) when the player is the moving partner — not a new component in v1.

### `collisionSystem.ts` (new)

```ts
export function collisionSystem(ctx: TickContext): void {
  if (!session.isHost) return;

  const players = world.entities.filter((e) => e.type === 'Player');
  const colliders = world.entities.filter(
    (e) => e.events?.collision && collisionRadius(e) != null
  );

  for (const self of colliders) {
    const rules = normalizeCollisionRules(self.events!.collision!);
    const selfPos = self.components.Transform?.position as [number, number, number] | undefined;
    const selfR = collisionRadius(self);
    if (!selfPos || selfR == null) continue;

    for (const other of players) {
      if (other.id === self.id) continue;
      if (!matchesWith(rules, other.type)) continue;
      const otherPos = other.components.Transform?.position as [number, number, number] | undefined;
      if (!otherPos) continue;
      if (!xzOverlaps(selfPos, selfR, otherPos, PLAYER_COLLIDE_RADIUS)) continue;

      for (const rule of rules) {
        if (rule.with && rule.with !== other.type) continue;
        runActions(self, rule.do, ctx, { other });
      }
    }
  }

  // Optional reverse: player carries collision handler (future — skip v1 unless needed)
}
```

**`runActions` signature change:**

```ts
export function runActions(
  entity: Entity,
  actions: EventAction[],
  ctx: TickContext,
  opts?: { other?: Entity }
): void
```

Pass `other: opts?.other?.components` into `actionScope`.

**`score` / `sfx` branches in `runActions`:**

```ts
} else if ('score' in action) {
  score.add(Number(evalValue(action.score, entity, ctx, opts?.other)));
} else if ('sfx' in action) {
  playSfx(String(evalValue(action.sfx, entity, ctx, opts?.other)));
}
```

Update `evalValue` to accept optional `other` entity for `actionScope` extras.

### Scheduler (`systems/index.ts`)

```ts
scheduler.register(alarmSystem);
scheduler.register(collisionSystem);  // NEW
scheduler.register(eventSystem);
// REMOVE: scheduler.register(collectSystem);
```

Keep `collect.ts` component registration; **export stays** for ontology but system unregistered.

### Collectible migration

| File | Change |
| ---- | ------ |
| `static/games/collect.jsonld` | Add `events.collision` on `type:Coin` (above) |
| `static/games/collect-race.jsonld` | Same Coin type pattern |
| `static/games/parkour.jsonld` | Coin/collectible entities → collision events |
| `src/lib/engine/systems/behaviors/collect.ts` | Remove `collectSystem` export usage from index; add deprecation comment |

**Backward compat:** Worlds with `Collectible` but **no** `events.collision` — **no pickup** after migration. Document in spec; optional dev warning once per world load (out of scope v1).

---

## Demo world — `static/games/collision-demo.jsonld`

Minimal host-verifiable scene:

| Piece | Role |
| ----- | ---- |
| Ground + spawn + player (standard) | Play entry |
| **Coin** instance at `(2, 0.4, 0)` | Migrated Coin type with collision handler |
| Probe moves **Player Transform** into overlap (e2e) instead of WASD |

Load via `?game=collision-demo`.

---

## E2E — `e2e/collision-demo.spec.ts`

Paused scheduler probe (mirror `alarms-demo.spec.ts`):

1. `primeCollabStorage`, goto `?game=collision-demo&mode=play`
2. Force `session.isHost = true` (or host peer)
3. Pause scheduler; snapshot play state
4. Teleport local player Transform adjacent to coin (overlap)
5. Run `collisionSystem` + `eventSystem` one tick
6. Assert `score.value` increased by `Collectible.value`
7. Assert coin entity despawned (`despawnRuntime` path)
8. Restore play state — coin back, score reset optional

---

## Files

| File | Change |
| ---- | ------ |
| `src/lib/engine/ontology/schema.ts` | `CollisionRule`, `ScoreAction`, `SfxAction`, extend `EntityEvents` / `EventAction` |
| `src/lib/engine/ontology/registry.ts` | Register `Collision` component |
| `src/lib/engine/systems/collisionProbe.ts` | **New** — radius + XZ overlap |
| `src/lib/engine/systems/collisionSystem.ts` | **New** — host dispatch |
| `src/lib/engine/systems/eventSystem.ts` | `runActions` + `evalValue` accept `other`; score/sfx actions |
| `src/lib/engine/systems/index.ts` | Register `collisionSystem`; **unregister** `collectSystem` |
| `static/games/collect.jsonld` (+ race, parkour) | Coin collision events |
| `static/games/collision-demo.jsonld` | **New** |
| `e2e/collision-demo.spec.ts` | **New** |

**Out of scope:** Rapier contact events; `with` by component name; collision mask beyond `circle_xz`; Workbench collision rule editor; peer-local collision for non-host entities.

---

## Acceptance criteria

1. `Collision` component registered; `Collectible` unchanged.
2. `events.collision` array of `{ with?, do }` parses from JSON-LD types.
3. Host-only `collisionSystem` fires matching rules on XZ overlap.
4. `other` available in action formulas during collision handlers.
5. `score` and `sfx` actions work in collision handlers.
6. `collect.jsonld` coins pickup via collision events; **`collectSystem` not registered**.
7. `static/games/collision-demo.jsonld` loads and overlaps dispatch.
8. `pnpm check` passes.
9. `PW_REUSE=1 pnpm test:e2e e2e/collision-demo.spec.ts` passes.
10. `PW_REUSE=1 pnpm test:e2e e2e/events-demo.spec.ts e2e/alarms-demo.spec.ts` — no regression.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/collision-demo.spec.ts
PW_REUSE=1 pnpm test:e2e e2e/events-demo.spec.ts e2e/alarms-demo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| P2b | Rapier contact → collision adapter |
| P3 | Input events (TRL-128/129) |
| UI | Events panel collision rules readout |
