---
version: 1
name: GameMaker input events + with action (Phase 3)
parent: TRL-121
issue: TRL-128
impl: TRL-129
status: queue-ready
labels: spec, gamemaker-model, input
---

# Spec: Input/key events on owned entities + `with(Type){ do }`

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 3  
**Impl:** TRL-129 (blocked on this spec)  
**Depends on:** Phase 0 event substrate (TRL-123) — `runActions`, owner authority; existing `input.ts` play-mode keyboard

---

## Summary

Add **local-authority keyboard triggers** on entities (`keydown` / `keyup` rule lists) and the **`with` query action** — GameMaker’s `with(obj){ … }` as data. Input handlers run only on the **entity owner** (typically the local player). The **`with` action** iterates matching instances and runs nested actions with each match as **`self`**, gated by **`world.isOwner`** per target (v1: no cross-owner RPC).

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Triggers v1 | **`keydown`** and **`keyup`** — arrays of `{ key, do }` rules | GM Pressed / Released; avoids per-key JSON keys (`key_e`) explosion |
| Continuous held | **`keyheld`** optional v1 — same rule shape, fires every tick while pressed | GM Keyboard (continuous); defer if scope tight — **include in v1** (cheap: reuse `input.pressed`) |
| Authority | **Entity owner only** (`world.isOwner`) | Proposal table: input/key = local client |
| Which entities | Any entity with `events.keydown` / `keyup` / `keyheld` | Not Player-only — props with owner=host work in solo/host sessions |
| Key identity | **Lowercase string** — `e`, `space`, `enter`, `arrowup`, `shift` | Matches `input.ts` `keys` Set normalization |
| Edit / shell | **No dispatch when** `isFormFieldFocused()` **or** scheduler paused | Same guard as movement; shell shortcuts unchanged |
| Play-only | **`inputEventSystem` runs only while sim ticking** (play mode) | Edit mode never fires game input events |
| `with` shape | `{ "with": "<TypeName>", "do": [ … ] }` | Proposal action table; `TypeName` = `entity.type` (strip `type:` prefix) |
| `with` vs spawn | Discriminate at runtime: **`typeof action.with === 'string'`** + **`'do' in action`** | `SpawnAction.with` is a component bag object |
| `with` iteration | All `world.entities` where `entity.type === typeName` | No component query in v1 (Phase 6 may extend) |
| `with` authority | Run `do` **only when `world.isOwner(target.id)`** | Prevents client mutating host-owned world without a network seam |
| Cross-owner gap | **Documented limitation v1** — client key → host Coin use **collision**, not `with` | Ships safe; RPC intent queue is follow-up |
| Nested `with` | **Allowed** — `do` may contain another `with` | Same owner gate each level |
| System placement | **`inputEventSystem` after `playerSystem`, before `alarmSystem`** | Keys captured after movement reads; discrete input before alarms/collision/step |
| Edge detection | Extend **`input.ts`** with per-tick **`pressedEdge()`** / **`releasedEdge()`** queues cleared once per tick | Avoid duplicate keydown if multiple systems poll |
| Demo world | **`static/games/input-demo.jsonld`** | Isolated wedge |
| E2E | **`e2e/input-demo.spec.ts`** — paused scheduler + synthetic key edges | Mirror `alarms-demo.spec.ts` |
| Workbench UI | **Out of scope** — read-only Events panel may omit key rules until cohesion pass | TRL-137 follow-up |

---

## Data model

### Input handler types (`schema.ts`)

```ts
export interface InputRule {
	/** Key name (lowercase), e.g. "e", "space", "arrowup". */
	key: string;
	do: EventAction[];
}

export type InputHandlers = InputRule[];

export interface WithAction {
	/** EntityType name to iterate (e.g. "Coin"). */
	with: string;
	do: EventAction[];
}

export type EntityEvents = Partial<
	Record<EventTrigger, EventAction[]> &
		Record<AlarmTrigger, EventAction[]> & {
			collision?: CollisionHandlers;
			keydown?: InputHandlers;
			keyup?: InputHandlers;
			keyheld?: InputHandlers;
		}
>;

export type EventAction =
	| SetAction
	| SpawnAction
	| DestroyAction
	| IfAction
	| AlarmAction
	| ScoreAction
	| SfxAction
	| WithAction;
```

### Normative JSON-LD (Player presses **E** → local score + sfx)

```jsonc
{
	"@id": "type:Player",
	"@type": "EntityType",
	"components": ["Transform", "Render", "Player", "Jump", "Physics", "GroundSensor"],
	"events": {
		"keydown": [
			{
				"key": "e",
				"do": [
					{ "score": 1 },
					{ "sfx": "Bing" }
				]
			}
		]
	}
}
```

### `with` example (host-owned world — solo / host session)

```jsonc
{
	"@id": "type:ResetSwitch",
	"@type": "EntityType",
	"components": ["Transform", "Render"],
	"events": {
		"keydown": [
			{
				"key": "r",
				"do": [
					{
						"with": "Fuse",
						"do": [{ "set": "Render.color", "to": "#3498db" }]
					}
				]
			}
		]
	}
}
```

When the **host** presses **R** near the switch (or globally — v1 has no focus filter), every **owned** `Fuse` instance resets color.

---

## Runtime

### Input edge API (`input.ts`)

Add tick-scoped edge queues populated in existing `onDown` / `onUp`:

```ts
const pressedThisTick = new Set<string>();
const releasedThisTick = new Set<string>();

function onDown(event: KeyboardEvent) {
	// ... existing ...
	pressedThisTick.add(key);
}

function onUp(event: KeyboardEvent) {
	keys.delete(event.key.toLowerCase());
	releasedThisTick.add(event.key.toLowerCase());
}

/** Keys that transitioned down this tick (cleared after read). */
export function drainPressedEdges(): string[] { /* ... */ }

/** Keys that transitioned up this tick (cleared after read). */
export function drainReleasedEdges(): string[] { /* ... */ }
```

**Contract:** `inputEventSystem` calls **one** drain per tick at system start. Other systems must not drain.

### `runActions` — `with` branch (`eventSystem.ts`)

```ts
} else if ('with' in action && typeof action.with === 'string' && 'do' in action) {
	const typeName = action.with.replace(/^type:/, '');
	for (const target of world.entities) {
		if (target.type !== typeName) continue;
		if (!world.isOwner(target.id)) continue;
		runActions(target, action.do, ctx, opts);
	}
}
```

Place **before** `'set' in action` or after `'if'` — order within switch irrelevant.

### `inputEventSystem.ts` (new)

```ts
export function resetInputEventState(): void {
	/* no module state v1 */
}

export function inputEventSystem(ctx: TickContext): void {
	const pressed = drainPressedEdges();
	const released = drainReleasedEdges();

	for (const entity of world.entities) {
		if (!world.isOwner(entity.id)) continue;
		const events = entity.events;
		if (!events) continue;

		if (events.keydown) {
			for (const rule of events.keydown) {
				if (!pressed.includes(rule.key.toLowerCase())) continue;
				runActions(entity, rule.do, ctx);
			}
		}
		if (events.keyup) {
			for (const rule of events.keyup) {
				if (!released.includes(rule.key.toLowerCase())) continue;
				runActions(entity, rule.do, ctx);
			}
		}
		if (events.keyheld) {
			for (const rule of events.keyheld) {
				if (!input.pressed(rule.key)) continue;
				runActions(entity, rule.do, ctx);
			}
		}
	}
}
```

**Note:** `keydown` rules fire **once per press** even if the entity also has `keyheld` for the same key.

### Scheduler (`systems/index.ts`)

```ts
scheduler.register(playerSystem);
scheduler.register(inputEventSystem); // NEW
scheduler.register(alarmSystem);
```

Call **`resetInputEventState()`** from `stopSimulation()` alongside other resets.

---

## Demo world — `static/games/input-demo.jsonld`

Minimal deterministic scene:

| Piece | Role |
| ----- | ---- |
| Ground + spawn + **Player** with `keydown` **e** → `score += 1`, `sfx: "Bing"` | Primary assertion |
| **Fuse** instance (blue cube) + **ResetSwitch** type with `keydown` **r** → `with: "Fuse"` → reset color | Exercises `with` on host-owned entities |
| Load via `?game=input-demo` | |

E2E forces `world.isOwner = () => true` (alarms pattern) and injects key edges via new test hook:

```ts
// input.ts — test-only export
export function __testInjectKeyEdge(kind: 'down' | 'up', key: string): void
```

Guard with `import.meta.env.DEV` or expose only when `globalThis.__PLAYWRIGHT__` if preferred.

---

## E2E — `e2e/input-demo.spec.ts`

1. `primeCollabStorage`, goto `?game=input-demo&mode=play`
2. Pause scheduler; `world.isOwner = () => true`; snapshot play state
3. Record initial `score.value`
4. `__testInjectKeyEdge('down', 'e')` → run `inputEventSystem` once
5. Assert score increased by 1
6. Tint Fuse red via `set` probe; inject `keydown r` on switch entity path OR global key `r` with switch handler on player — **prefer dedicated ResetSwitch entity** with its own events and owner=host; inject `r` while host
7. Assert Fuse color restored to blue
8. Restore play state

---

## Files

| File | Change |
| ---- | ---- |
| `docs/artifacts/gamemaker_input_spec.md` | **This spec** |
| `src/lib/engine/ontology/schema.ts` | `InputRule`, `InputHandlers`, `WithAction`; extend `EntityEvents` / `EventAction` |
| `src/lib/engine/player/input.ts` | Edge queues + drains; optional `__testInjectKeyEdge` |
| `src/lib/engine/systems/inputEventSystem.ts` | **New** — keydown/keyup/keyheld dispatch |
| `src/lib/engine/systems/eventSystem.ts` | `with` branch in `runActions` |
| `src/lib/engine/systems/index.ts` | Register `inputEventSystem`; reset on stop |
| `static/games/input-demo.jsonld` | **New** |
| `e2e/input-demo.spec.ts` | **New** |

**Out of scope:** gamepad button events; key repeat OS behavior; focus/raycast “use key only near object”; cross-owner RPC for `with`; Workbench key-rule editor; shell shortcut collision remapping.

---

## Acceptance criteria

1. `InputRule`, `WithAction`, and `keydown` / `keyup` / `keyheld` keys parse on `EntityEvents`.
2. `inputEventSystem` fires matching rules only for **`world.isOwner`** entities.
3. Keydown fires once per press edge; keyup once per release; keyheld every tick while held.
4. **`with` action** runs nested `do` on each type match where **`world.isOwner(target)`**.
5. `static/games/input-demo.jsonld` loads; E key bumps score; R + `with` resets Fuse color (host/solo).
6. `pnpm check` passes.
7. `PW_REUSE=1 pnpm test:e2e e2e/input-demo.spec.ts` passes.
8. `PW_REUSE=1 pnpm test:e2e e2e/events-demo.spec.ts e2e/alarms-demo.spec.ts e2e/collision-demo.spec.ts` — no regression.

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/input-demo.spec.ts
PW_REUSE=1 pnpm test:e2e e2e/events-demo.spec.ts e2e/alarms-demo.spec.ts e2e/collision-demo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| P3b | Cross-owner input intent → host RPC for `with` / world mutations |
| P3c | Gamepad face-button input rules |
| UI | Events panel keydown/keyheld rule readout |
| P6 | Named script refs reuse `with` + action lists (TRL-134) |
