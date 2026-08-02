---
version: 1
name: GameMaker alarms (Phase 1)
parent: TRL-121
issue: TRL-124
impl: TRL-125
status: queue-ready
labels: spec, gamemaker-model, alarms
---

# Spec: Alarms — `Alarm` component, `alarmSystem`, `alarm[n]` trigger, `alarm` action

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 1  
**Impl:** TRL-125 (blocked on this spec)  
**Depends on:** Phase 0 event substrate (TRL-123) — `eventSystem`, `runActions`, owner authority

---

## Summary

Add GameMaker-style **alarms**: per-instance countdown timers that fire **`alarm0`…`alarm11`** event handlers when they reach zero. Authors arm timers with a new **`alarm` action** in the existing action DSL. Timer state is **owner-local runtime** — not durable, not replicated — matching the proposal authority table.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Alarm count | **12 slots** (`0`–`11`), keys `alarm0`…`alarm11` | GM parity; finite, predictable |
| Timer storage | **`Alarm` component** on entity with `t0`…`t11` number fields | Inspectable in debugger; same bag pattern as other components |
| Sync tier | **No wire sync** — runtime-only mutations via `applyFieldLocal` | Proposal: owner-local runtime state; countdowns are not authored rules |
| Field semantics | **Remaining seconds**; **`-1` = disarmed**; **`0` = fire this tick** | Simple author mental model; negative disarm is explicit |
| Authority | **Entity owner only** (`world.isOwner`) | Same as `create`/`step`/`destroy` (Phase 0) |
| System placement | **`alarmSystem` before `eventSystem`** in scheduler | Expired alarms fire before `step` handlers on the same tick |
| Tick integration | Decrement armed timers by `ctx.dt`; on cross to `≤ 0`, fire handler once then set `-1` | GM: alarm at start of step after countdown hits 0 |
| `alarm` action | `{ "alarm": n, "in": <expr> }` — `in` is seconds (formula ok); **`in < 0` disarms** | Matches proposal action table |
| `in: 0` | Arm to **fire next tick** (set remaining `0`, fire on next alarm pass before step) | Avoid same-tick re-entrancy during action list |
| Event keys | Extend `EntityEvents` with optional **`alarm0`…`alarm11`** arrays | JSON-LD keys match GM (`"alarm0": [ … ]`) |
| Handler execution | Reuse **`runActions`** from `eventSystem.ts` | One action interpreter; no fork |
| Component bootstrap | **`ensureAlarm(entity)`** on first arm — add empty `Alarm` bag if missing | Types need not declare `Alarm` unless they want defaults |
| Play lifecycle | **`resetAlarmState()`** on play stop alongside `resetEventState()` | Edit→play cycles start clean |
| Play restore | Alarm timers **not preserved** in play snapshot — reset with runtime overlay | Timers are ephemeral match state |
| Demo world | **`static/games/alarms-demo.jsonld`** (new) | Isolated wedge; do not bloat `events-demo` |
| E2E | **`e2e/alarms-demo.spec.ts`** — scheduler paused probe pattern from `events-demo.spec.ts` | Deterministic without wall-clock |

---

## Data model

### `Alarm` component (built-in registry)

Register in `registry.ts`:

```ts
registerComponent({
  name: 'Alarm',
  fields: Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      `t${i}`,
      { t: 'number', default: -1 }
    ])
  )
});
```

| Field | Type | Default | Meaning |
| ----- | ---- | ------- | ------- |
| `t0`…`t11` | number | `-1` | Seconds until alarm *n* fires; `-1` disarmed |

No view required (invisible runtime state). Optional debug readout in EntityEvents panel is out of scope.

### `EntityEvents` extension (`schema.ts`)

```ts
export type AlarmTrigger =
  | 'alarm0' | 'alarm1' | 'alarm2' | 'alarm3'
  | 'alarm4' | 'alarm5' | 'alarm6' | 'alarm7'
  | 'alarm8' | 'alarm9' | 'alarm10' | 'alarm11';

export type EventTrigger = 'create' | 'step' | 'destroy';
export type EntityEvents = Partial<
  Record<EventTrigger | AlarmTrigger, EventAction[]>
>;
```

### `AlarmAction` (`schema.ts`)

```ts
export interface AlarmAction {
  alarm: number; // 0–11
  in: unknown;   // seconds (literal or formula); < 0 disarms
}

export type EventAction =
  | SetAction | SpawnAction | DestroyAction | IfAction | AlarmAction;
```

### JSON-LD authoring

```jsonc
{
  "@id": "type:Fuse",
  "@type": "EntityType",
  "components": ["Transform", "Render"],
  "events": {
    "create": [{ "alarm": 0, "in": 2.0 }],
    "alarm0": [{ "set": "Render.color", "to": "#ff0000" }, { "destroy": "self" }]
  }
}
```

`loadOntology.ts` already merges `events` from types — no parser change beyond schema typing.

---

## Runtime

### `alarmSystem.ts` (new)

```ts
export function resetAlarmState(): void { /* clear module caches if any */ }

export function alarmSystem(ctx: TickContext): void {
  for (const entity of world.entities) {
    if (!world.isOwner(entity.id)) continue;
    const alarm = entity.components.Alarm;
    if (!alarm) continue;

    for (let n = 0; n < 12; n++) {
      const key = `t${n}` as const;
      const remaining = Number(alarm[key]);
      if (remaining < 0) continue;

      if (remaining === 0) {
        const handler = entity.events?.[`alarm${n}` as AlarmTrigger];
        if (handler) runActions(entity, handler, ctx);
        world.applyFieldLocal(entity.id, 'Alarm', key, -1);
        continue;
      }

      const next = remaining - ctx.dt;
      if (next <= 0) {
        world.applyFieldLocal(entity.id, 'Alarm', key, 0);
      } else {
        world.applyFieldLocal(entity.id, 'Alarm', key, next);
      }
    }
  }
}
```

### `alarm` action (`eventSystem.ts` → `runActions`)

```ts
} else if ('alarm' in action) {
  const n = action.alarm;
  if (n < 0 || n > 11) continue;
  const seconds = Number(evalValue(action.in, entity, ctx));
  ensureAlarm(entity);
  const field = `t${n}`;
  world.applyFieldLocal(entity.id, 'Alarm', field, seconds < 0 ? -1 : seconds);
}
```

Extract `ensureAlarm` to a shared helper (alarm module or eventSystem).

### Scheduler order (`systems/index.ts`)

```ts
scheduler.register(alarmSystem);  // NEW — before eventSystem
scheduler.register(eventSystem);
```

### Play stop

```ts
import { resetAlarmState } from './alarmSystem';
// in stopSimulation():
resetAlarmState();
```

---

## Demo world — `static/games/alarms-demo.jsonld`

Minimal scene proving arm → wait → fire → side effect:

| Entity type | Behavior |
| ----------- | -------- |
| **Fuse** | `create` arms `alarm0` at 1.5s; `alarm0` sets color red then `destroy self`; `destroy` spawns **Puff** (reuse type from events-demo or inline copy) |
| **Fuse instance** | One box at origin |

Load via `?game=alarms-demo`.

---

## E2E — `e2e/alarms-demo.spec.ts`

Follow `events-demo.spec.ts` probe pattern:

1. `primeCollabStorage`, goto `?game=alarms-demo`
2. Pause scheduler, reset play snapshot
3. Drive ticks with fixed `dt` until `alarm0` fires (color change + despawn)
4. Assert **`runActions` path** used (not wall clock)
5. Assert **`destroy` → spawn** still works on alarm-fired destroy (optional Puff check)
6. Assert **`resetAlarmState` / play restore** clears armed timers (fuse re-armed only on fresh create)

---

## Files

| File | Change |
| ---- | ------ |
| `src/lib/engine/ontology/schema.ts` | `AlarmTrigger`, `AlarmAction`, extend `EntityEvents` / `EventAction` |
| `src/lib/engine/ontology/registry.ts` | Register `Alarm` component |
| `src/lib/engine/systems/alarmSystem.ts` | **New** — tick + fire |
| `src/lib/engine/systems/eventSystem.ts` | `alarm` action + `ensureAlarm`; export shared helpers if split |
| `src/lib/engine/systems/index.ts` | Register `alarmSystem`; `resetAlarmState` on stop |
| `static/games/alarms-demo.jsonld` | **New** demo world |
| `e2e/alarms-demo.spec.ts` | **New** runtime verification |

**Out of scope:** Workbench Events tab editing for alarm keys (read-only display ok if trivial); alarm replication; durable alarm authoring.

---

## Acceptance criteria

1. `Alarm` component registered with `t0`…`t11` defaults `-1`.
2. `{ "alarm": n, "in": <seconds> }` arms slot *n* on entity owner; `in < 0` disarms.
3. When timer reaches 0, `alarmN` handler runs once on owner; slot disarms to `-1`.
4. `alarmSystem` runs before `eventSystem` each tick.
5. Non-owners skip alarm tick and fire.
6. `resetAlarmState()` called on play stop.
7. `static/games/alarms-demo.jsonld` loads; fuse arms and self-destructs via alarm.
8. `pnpm check` passes.
9. `PW_REUSE=1 pnpm test:e2e e2e/alarms-demo.spec.ts` passes.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/alarms-demo.spec.ts
```

---

## Follow-ups (not this impl)

| Phase | Title |
| ----- | ----- |
| 2 | Collision events (TRL-126/127) |
| UI | Events panel shows `alarm0`…`alarm11` handlers (TRL-140 follow-up) |
| Harden | Replicate armed alarms for spectator debug (optional realtime tier) |
