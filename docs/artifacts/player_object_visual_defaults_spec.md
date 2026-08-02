---
version: 1
name: Player object visual defaults (GameMaker pattern)
parent: TRL-176
status: implemented
---

# Spec: Player object visual defaults

**Parent impl:** TRL-176\
**Epic:** TRL-147 (Player avatar)\
**Builds on:** TRL-149 skinned default, TRL-155 data-driven Player defaults\
**Pattern:** [gamemaker-model.md](../plans/gamemaker-model.md)

## Thesis

In GameMaker you assign a sprite on `obj_player`. Here the Player `EntityType`
exposes world-overridable **visual defaults** (`SkinnedMesh.mesh` +
`Mesh3DAnimator.catalog`) authored in Objects via Assets pick. Composition stays
builtin-locked; `buildPlayer` already reads type defaults via `typeBag`.

## Policy

| API                                    | Behavior                                 |
| -------------------------------------- | ---------------------------------------- |
| `isEditableObjectType('Player')`       | **false** — cannot add/remove components |
| `canEditTypeDefaults('Player')`        | **true**                                 |
| `canEditTypeDefaultField('Player', …)` | allowlist only (below)                   |

### Allowlist

- `SkinnedMesh.mesh`, `anchor`, `rig`, `forwardYaw`, `capsuleRadiusScale`,
  `capsuleHeightScale`
- `Mesh3DAnimator.catalog`, `clip`

## Persist + live sync

1. `world.setTypeDefault('Player', …)` succeeds for allowlisted fields →
   `defineType` durable patch.
2. Live `entity:player/*` bags are patched locally (no durable patch on
   ephemeral player ids). Type definition is the source of truth for reload /
   new joins.
3. World JSON-LD may include `type:Player` with `defaults` (see
   `static/games/player-avatar-override.jsonld`).

## Authoring UX

1. Objects → select **Player**
2. Hint: “Visual defaults apply to the avatar this world spawns…”
3. SkinnedMesh → Browse assets → pick GLB
4. Play / reload uses the override

## Non-goals

- Retarget pipeline, pose-hull colliders
- Making player instances durable Things
- Editing Player motor / Physics composition via Objects

## Test plan

| Check              | Assertion                                     |
| ------------------ | --------------------------------------------- |
| Policy smoke       | allowlist + composition lock                  |
| Live sync e2e      | setTypeDefault → local player mesh updates    |
| World override e2e | `?game=player-avatar-override` → `player.glb` |
| Regression         | default worlds still mannequin                |
