---
version: 1
name: Editable locomotion bindings (Mesh3DAnimator override channel)
parent: TRL-197
status: queue-ready
---

# Spec: Editable locomotion bindings

**Parent proposal:** TRL-197\
**Epic:** TRL-147 (Player avatar)\
**Builds on:** TRL-155/156/157 (catalog `locomotion` map), TRL-176 (Player
visual defaults allowlist)\
**Out of scope:** per-instance entity overrides, retargeting, new locomotion
tiers, fake UI without playback effect.

---

## Problem

Objects Events shows Idle → Idle_Loop as a **read-only** catalog dump. Authors
cannot re-route Walk/Run/Jump clips per type. Catalog-only bindings (TRL-157)
are correct for defaults; type-level overrides are missing.

---

## Architect decisions

| Question                      | Decision                                                                                                                                     | Rationale                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Where does the override live? | **`Mesh3DAnimator.locomotion`** — durable, optional `json`, shape `Partial<LocomotionBindings>`                                              | Mirrors catalog key name; co-located with `catalog`/`clip` |
| Merge order (per key)         | **entity/type override → catalog pack → `M2M_HUMAN_LOCOMOTION`**                                                                             | Authors win; catalog remains SoT for unset keys            |
| Type vs instance              | **Type-level only this wedge** — write via `setTypeDefault`; live players get bag sync like visual defaults                                  | Matches Objects Events authoring model                     |
| Cache                         | Keep `packByCatalog` catalog-pure; merge override at **entity read** into `packByEntity`; invalidate on `catalog` **or** `locomotion` change | Avoids poisoning shared catalog cache                      |
| Empty override                | Omitted field **or** `{}` both mean “catalog only”                                                                                           | No wipe-to-empty                                           |
| Invalid clip ids              | On UI commit: validate against catalog clip list; reject/toast unknown ids                                                                   | Prevent silent T-pose                                      |
| Loop flag                     | `clipLoop` follows **resolved** clip id metadata after merge                                                                                 | Override can point at one-shot or loop clips               |
| Player allowlist              | Add `Mesh3DAnimator.locomotion` to `typeAccess` Player allowlist                                                                             | Builtin Player composition stays locked                    |
| UI surface                    | **TypeBehaviorsPanel** locomotion card — editable selects when type editable; built-ins read-only + Duplicate                                | Do not expose raw JSON in Properties accordion             |
| Events coupling               | Editing locomotion **must not** write create/step/destroy event actions                                                                      | Separate from event `set Mesh3DAnimator.clip`              |
| Keys                          | All 11 `LocomotionBindingKey`s (incl. `doubleJump*`)                                                                                         | Match current `clipCatalog.ts`                             |

---

## Ontology

Add to `Mesh3DAnimator` in `registry.ts`:

```ts
locomotion: {
  t: 'json',
  sync: 'durable'
  // no default — absent = catalog-only
}
```

Value shape:

```ts
Partial<Record<LocomotionBindingKey, string>>;
// e.g. { walk: "Crouch_Fwd_Loop", jumpStart: "Jump_Start" }
```

Unknown keys ignored at merge time. Worlds may author:

```jsonc
"Mesh3DAnimator": {
  "catalog": "catalog:mesh2motion-human",
  "locomotion": { "walk": "Crouch_Fwd_Loop" }
}
```

---

## Runtime

### Resolve pack for entity

1. Base = `getLocomotionBindings(catalogRef)` (existing merge: catalog JSON →
   M2M fallback).
2. Override = `entity.components.Mesh3DAnimator.locomotion` (includes type
   defaults after spawn / `typeBag`).
3. Per key: `override[key] || base.bindings[key]`.
4. `clipLoop(clipId)` from base pack metadata for the **resolved** clip id
   (extend heuristics if needed for overridden one-shots).

### Invalidation

- On `setTypeDefault(..., 'Mesh3DAnimator', 'locomotion', …)` and on `catalog`
  change: clear `packByEntity` for affected players; re-warm; mirror
  `#syncPlayerVisualDefault` pattern.
- Never mutate `packByCatalog` entries with type overrides.

### Hot path

`applyLocomotionClip` / `applyJumpAnimClip` continue to write realtime
`Mesh3DAnimator.clip` + `loop`. Override only changes **which** id is chosen.

---

## UI

| Surface                                 | Behavior                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TypeBehaviorsPanel` locomotion section | Editable `<select>` per binding key when `!readonly` / type editable; options = clips from current catalog                                             |
| Built-in types                          | Keep read-only list + existing Duplicate affordance                                                                                                    |
| Commit                                  | `world.setTypeDefault(typeName, 'Mesh3DAnimator', 'locomotion', nextPartial)` — merge key into partial map; clearing a key removes it from the partial |
| Properties accordion                    | Hide or leave non-editable raw `locomotion` json (Behaviors owns editing)                                                                              |
| Live sync                               | Same as TRL-176: type SoT → patch live `entity:player/*` bags locally                                                                                  |

---

## typeAccess

`PLAYER_VISUAL_DEFAULT_ALLOWLIST` (or equivalent): add
`Mesh3DAnimator.locomotion`.

Custom editable types that already own Mesh3DAnimator get the field via schema
automatically.

---

## File touchpoints

| File                                                       | Change                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/engine/ontology/registry.ts`                      | Add `locomotion` field                                             |
| `src/lib/engine/runtime/typeAccess.ts`                     | Allowlist `locomotion` for Player                                  |
| `src/lib/engine/player/playerLocomotionClips.ts`           | Entity merge + invalidation                                        |
| `src/lib/engine/runtime/world.svelte.ts`                   | Sync on locomotion default change (if not covered by generic path) |
| `src/lib/ui/TypeBehaviorsPanel.svelte`                     | Editable locomotion rows                                           |
| `scripts/player-locomotion-bindings-smoke.ts` or new smoke | Assert override wins over catalog                                  |
| `e2e/player-locomotion-override.spec.ts` (new)             | Set type walk override → play → clip matches                       |
| `e2e/player-skinned-avatar.spec.ts`                        | Regression green                                                   |

---

## Acceptance criteria

Behavioral:

1. Spec field `Mesh3DAnimator.locomotion` is durable optional json
   `Partial<LocomotionBindings>`; empty/`{}`/absent = catalog-only.
2. Runtime merge: override → catalog pack → M2M fallback; `packByCatalog` stays
   catalog-pure.
3. Objects Events locomotion section: editable dropdowns for editable types;
   built-ins remain read-only.
4. Changing Walk binding on an editable type updates live play-mode
   `Mesh3DAnimator.clip` for Player avatar when walking.
5. Editing locomotion does not create/modify type event actions.
6. Invalid clip id on commit is rejected (toast / no persist).

Machine:

```
test:pnpm check
test:pnpm run test:player-locomotion
test:PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts
test:PW_REUSE=1 pnpm test:e2e e2e/player-locomotion-override.spec.ts
```

(Executor may land override coverage in an extended smoke + e2e; if e2e file
name differs, update AC `--test` to match.)

---

## Risks

1. **Cache poisoning** — merging into shared catalog pack → wrong clips for
   other entities.
2. **Catalog swap** — stale override clip ids missing from new catalog →
   validate or warn.
3. **Ontology docs** — `docs/ontology.md` still lists 8 keys; update to 11 when
   touching docs (optional this wedge).
4. **Working tree** — avatar WIP still uncommitted on `main`; Executor should
   land on TRL-198 lane and avoid unrelated shell/events hunks.
