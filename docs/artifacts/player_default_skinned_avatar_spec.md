---
version: 1
name: Default Player avatar — Character mannequin + locomotion clips (A+B)
parent: TRL-147
status: queue-ready
---

# Spec: Default Player avatar = Character mannequin + locomotion clips (A+B)

**Parent proposal:** TRL-147\
**Related:** [skinned_mesh_animation_spec.md](./skinned_mesh_animation_spec.md)
(Player adopt was deferred v1), Character type, `playInputState.locomotion`\
**Out of scope:** Jump clip choreography, root-motion player motor, per-game
avatar picker UI, merging `Character` into `Player`, deleting capsule primitive
path.

---

## Problem

`buildPlayer` still ships `Render: { mesh: 'primitive:capsule' }`. The Character
stack (`SkinnedMesh` + `Mesh3DAnimator` + mannequin + mesh2motion catalog) is
shipped; human wants **A** (visual default) + **B** (locomotion tier → clip).

---

## Architect decisions (closes forks)

| Question                        | Decision                                                                                                                             | Rationale                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Player visual components        | **Replace `Render` with `SkinnedMesh` + `Mesh3DAnimator`** on type + `buildPlayer`                                                   | Matches Character; avoid dual meshes                                  |
| Keep capsule collider?          | **Yes — `Physics.collider: 'capsule'`** unchanged                                                                                    | Motor / GroundSensor / clip casts stay analytic                       |
| Physics without `Render.mesh`   | **`resolveCollider(mesh, pref, scale)` already prefers `colliderPref === 'capsule'`** — callers pass `undefined` mesh when no Render | No need to invent a mesh string                                       |
| GroundSensor `footY`            | **Read `Physics.collider` + defaults; do not require `Render.mesh`**                                                                 | Same capsule dims (`halfHeight 0.25`, `radius 0.32`)                  |
| Capsule feet vs skinned anchor  | **Under `PhysicsBody`, skinned visual local Y = `−(halfHeight + radius)`** so mesh feet sit on capsule bottom                        | `anchor: bottom` alone puts feet at body center (wrong)               |
| `PLAYER_REST_Y`                 | **Unchanged (`0.62`)**                                                                                                               | Still capsule-center rest; visual offset handles feet                 |
| Peer color                      | **`SkinnedMesh.color = colorForClient(id)`** (same HSL as today)                                                                     | Drop `Render.color`                                                   |
| Locomotion → clip map           | See table below                                                                                                                      | Catalog ids verified in `mesh2motion-human.json`                      |
| Who writes clip?                | **Owned local player only** in `playerSystem` (or small helper it calls) when tier changes                                           | Remotes receive via sync                                              |
| `Mesh3DAnimator.clip` sync      | **Promote to `realtime`**                                                                                                            | Peers need tier changes; NPCs owned by host also stream clip when set |
| `rootMotion` on loops           | **`false`** (default)                                                                                                                | Catalog locomotion loops are in-place; Transform motor owns travel    |
| Non-player entities with Render | **Unchanged**                                                                                                                        | Only Player type / spawn path swaps                                   |
| Session rebuild guard           | **Players: require `Player` + `Transform` + (`SkinnedMesh` \|\| `Render`)**                                                          | Backward-compat old pill peers one heartbeat                          |
| Capsule primitive path          | **Keep** for shapes library / props                                                                                                  | Flag-off pattern — not deleted                                        |

### Tier → clip map (B)

| `LocomotionTier` | `Mesh3DAnimator.clip` |
| ---------------- | --------------------- |
| `idle`           | `Idle_Loop`           |
| `walk`           | `Walk_Loop`           |
| `jog`            | `Jog_Fwd_Loop`        |
| `run`            | `Sprint_Loop`         |
| `sprint`         | `Sprint_Loop`         |

`run` and `sprint` share `Sprint_Loop` — catalog has no dedicated `Run_Loop`.
Write only when `clip !== mapped` to avoid redundant patches.

### Jump → clip (follow-up)

| Phase    | `Mesh3DAnimator.clip` | `loop`              |
| -------- | --------------------- | ------------------- |
| Takeoff  | `Jump_Start`          | false (~350ms)      |
| Airborne | `Jump_Loop`           | true                |
| Land     | `Jump_Land`           | false (~280ms hold) |

Locomotion bind skips while airborne / land-hold. Visual facing: skinned player
under PhysicsBody gets `rotation.y = π` so mesh2motion +Z aligns with motor −Z
forward.

---

## Data model

### `Player` type (`spawnPlayer.ts`)

```ts
registerType({
  name: "Player",
  components: [
    "Transform",
    "SkinnedMesh",
    "Mesh3DAnimator",
    "Player",
    "Physics",
    "Jump",
  ],
});
```

### `buildPlayer`

```ts
components: {
  Transform: bag('Transform', { position: spawn }),
  SkinnedMesh: bag('SkinnedMesh', {
    mesh: '/models/characters/mannequin.glb',
    anchor: 'bottom',
    rig: 'human',
    color
  }),
  Mesh3DAnimator: bag('Mesh3DAnimator', {
    catalog: 'catalog:mesh2motion-human',
    clip: 'Idle_Loop',
    speed: 1,
    loop: true,
    rootMotion: false,
    playing: true
  }),
  Player: bag('Player', { speed: 4, color }),
  Physics: bag('Physics', {
    body: 'kinematicPosition',
    collider: 'capsule',
    mass: 70,
    gravityScale: 0
  }),
  Jump: bag('Jump')
}
```

### Registry — `Mesh3DAnimator.clip`

```ts
clip: { t: 'string', sync: 'realtime', default: 'Idle_Loop' }
```

Update `docs/ontology.md` Player type row + Mesh3DAnimator sync column.

---

## Physics / footing touchpoints

| File                                                          | Change                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PhysicsBody.svelte`                                          | When no `Render`, still resolve capsule from `physics.collider`; do not infer `primitiveKind` from missing mesh. Mount skinned children with **capsule foot offset** on the visual group (local Y `−(0.25*sy + 0.32*max(sx,sz))` using current scale). Prefer applying on the existing local-player `visualRoot` (or equivalent wrapper for all Player+Physics+SkinnedMesh). |
| `GroundSensor.svelte`                                         | `footY`: `resolveCollider(undefined, physics.collider ?? 'capsule', scale)` (or pass `Render.mesh` only if present).                                                                                                                                                                                                                                                         |
| `colliderShape.ts`                                            | No API change required if callers pass `colliderPref: 'capsule'`.                                                                                                                                                                                                                                                                                                            |
| `entityFootprint.ts` / `placementSession.ts` / `gridUnits.ts` | Only if they size **Player** ghosts from `Render.mesh` — prefer SkinnedMesh / capsule fallback for player ids; do not break Prop capsules.                                                                                                                                                                                                                                   |

---

## Net session touchpoints

| Site                       | New condition                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `#addRemote` player branch | Rebuild if missing `Player` \|\| `Transform` \|\| (`SkinnedMesh` && `Mesh3DAnimator` \|\| `Render`) — accept either visual generation |
| `#announcePlayer`          | Same guard before rebuild                                                                                                             |
| Non-player remote spawn    | Still require `Render` + `Transform` (unchanged)                                                                                      |

Realtime state stream must include `Mesh3DAnimator.clip` after sync promotion
(existing patch machinery — verify clip is emitted for owned players).

---

## Locomotion bind (B)

**Location:** `playerSystem.ts` (preferred — already owns local player
movement + has locomotion sample) or
`src/lib/engine/player/playerLocomotionClips.ts` imported from it.

```ts
const TIER_CLIP: Record<LocomotionTier, string> = {
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  jog: "Jog_Fwd_Loop",
  run: "Sprint_Loop",
  sprint: "Sprint_Loop",
};
```

Each owned-player tick (play mode):

1. Read current tier from movement sample / `playInputState.locomotion.tier`.
2. Map → target clip.
3. If `entity.components.Mesh3DAnimator?.clip !== target`, set `clip` on the bag
   (same path other systems use for realtime fields so net patch picks it up —
   prefer `world.setField` / existing mutator if that is what streams state).

**Gates:** only `world.isOwner(entity.id)` and
`'Mesh3DAnimator' in entity.components`. No writes in edit mode if motor is
frozen — match existing play-mode gate in `playerSystem`.

**Edit-mode idle:** spawned players should idle (`Idle_Loop`); locomotion bind
inactive until play.

---

## Docs

| File                                            | Change                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `docs/ontology.md`                              | Player type components; Mesh3DAnimator.clip sync realtime; note Player visual is SkinnedMesh |
| `docs/artifacts/skinned_mesh_animation_spec.md` | Mark “Player may later adopt…” as **done** via TRL-147; link this spec                       |

---

## Verification

### Manual

1. `?game=blank` (or any world): enter play — local avatar is mannequin, not
   pill.
2. Stand still → `Idle_Loop`; WASD walk / jog / sprint → matching clips; face
   yaw still works.
3. Jump / land / slopes: feet stay on ground (capsule rest + foot offset).
4. Second tab same room: peer is mannequin with moving clips + distinct tint.

### Automated

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts
```

**New e2e** `e2e/player-skinned-avatar.spec.ts`:

| Test           | Assertion                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Default visual | After load + play, local `entity:player/*` has `SkinnedMesh.mesh` containing `mannequin` and **no** `Render` (or no `primitive:capsule`) |
| Idle clip      | At rest, `Mesh3DAnimator.clip === 'Idle_Loop'`                                                                                           |
| Move clip      | Drive movement (keyboard helper / probe); assert clip becomes a locomotion loop (`Walk_Loop` \|\| `Jog_Fwd_Loop` \|\| `Sprint_Loop`)     |

Update smokes that hard-code player `Render: capsule`:

- `scripts/player-clip-smoke.ts`
- `scripts/platform-velocity-smoke.ts`

Keep capsule **collider** assertions; swap visual bag to SkinnedMesh where the
entity is a Player stand-in.

---

## Files to create / modify

| File                                             | Action                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/lib/engine/player/spawnPlayer.ts`           | **Modify** — type + `buildPlayer` bag                                                         |
| `src/lib/engine/ontology/registry.ts`            | **Modify** — `Mesh3DAnimator.clip` → realtime (Player type registration stays in spawnPlayer) |
| `src/lib/engine/player/playerSystem.ts`          | **Modify** — tier → clip bind                                                                 |
| `src/lib/engine/player/playerLocomotionClips.ts` | **Create** (optional helper — map + apply)                                                    |
| `src/lib/engine/render/PhysicsBody.svelte`       | **Modify** — no-Render capsule resolve + foot offset for skinned player                       |
| `src/lib/engine/render/GroundSensor.svelte`      | **Modify** — footY without Render                                                             |
| `src/lib/engine/net/session.svelte.ts`           | **Modify** — visual guards                                                                    |
| `docs/ontology.md`                               | **Modify**                                                                                    |
| `docs/artifacts/skinned_mesh_animation_spec.md`  | **Modify** — pointer to this shipped adopt                                                    |
| `e2e/player-skinned-avatar.spec.ts`              | **Create**                                                                                    |
| `scripts/player-clip-smoke.ts`                   | **Modify** if it constructs Player with Render                                                |
| `scripts/platform-velocity-smoke.ts`             | **Modify** if same                                                                            |

---

## Acceptance criteria

1. `Player` type + `buildPlayer` use `SkinnedMesh` + `Mesh3DAnimator` (mannequin
   defaults); **no** `Render` on the spawn bag; `Physics.collider` remains
   `capsule`.
2. Under PhysicsBody, skinned player mesh feet align to capsule bottom via local
   Y offset `−(halfHeight + radius)`.
3. `GroundSensor` / collider resolve work with no `Render.mesh`.
4. Locomotion tier → clip map applied owner-only in play;
   idle/walk/jog/(run|sprint) as table above.
5. `Mesh3DAnimator.clip` is `realtime`; peers show matching clips.
6. Session announce/addRemote accepts SkinnedMesh players (and still tolerates
   legacy Render bags).
7. `docs/ontology.md` updated; skinned-mesh spec notes Player adopt shipped.
8. `test:pnpm check`
9. `test:PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts`

**Explicitly NOT in this wedge:** jump/fall clips, crouch, swim, root-motion
locomotion, deleting `primitive:capsule` from the asset library.
