---
version: 1
name: Catalog-driven biped locomotion + data-driven Player defaults
parent: TRL-155
status: queue-ready
---

# Spec: Catalog-driven biped locomotion + data-driven Player defaults

**Parent proposal:** TRL-155\
**Epic:** TRL-147 (Player avatar)\
**Builds on:** TRL-149 (skinned default), TRL-153 (polish + AABB capsule)\
**Out of scope:** quadruped motor, root-motion locomotion, Mixamo retarget
pipeline, avatar picker UI, pose-hull colliders.

---

## Problem

Mannequin + mesh2motion work, but bindings live in engine code:

| Overfit site               | Today                                             |
| -------------------------- | ------------------------------------------------- |
| `buildPlayer`              | Hardcodes mannequin GLB, catalog ref, `Idle_Loop` |
| `playerLocomotionClips.ts` | `TIER_CLIP`, `JUMP_*_CLIP` constants              |
| `PLAYER_REST_Y`            | Fixed `0.62` (pill-era)                           |
| Facing                     | Implicit mannequin +Z export                      |

A new biped GLB + catalog should work by **data only**.

---

## Architect decisions

| Question                     | Decision                                                                                                                                   | Rationale                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Where do clip bindings live? | **`locomotion` map on clip catalog JSON**                                                                                                  | Co-located with clip ids; one file per rig family |
| Tier keys                    | `idle`, `walk`, `jog`, `run`, `sprint`, `jumpStart`, `jumpLoop`, `jumpLand`                                                                | Matches engine `LocomotionTier` + jump phases     |
| Resolver location            | `clipCatalog.ts` — `getLocomotionBindings(catalogRef)`                                                                                     | Single cache; shared by player + future NPCs      |
| Fallback if map missing      | Infer from `clips[].category` tags (`locomotion` / `action`) by **convention names** only as last resort; mannequin catalog ships full map | Avoid silent wrong clips                          |
| Player visual defaults       | **`registerType({ defaults })`** for SkinnedMesh, Mesh3DAnimator, Physics, Jump                                                            | Worlds + inspector see defaults; spawn is thin    |
| `buildPlayer`                | **Color + spawn position only** (via `bag()` + type defaults)                                                                              | Peer tint stays spawn-time                        |
| Motor hints                  | Add **`SkinnedMesh.forwardYaw`** (deg, default `0`)                                                                                        | Per-rig facing without code π hacks               |
| Capsule scale hints          | **`capsuleRadiusScale`**, **`capsuleHeightScale`** (default `1`)                                                                           | Chibi / hero proportions without code             |
| `PLAYER_REST_Y`              | **`capsuleRestCenterY(fit, floorY)`** from fitted capsule; spawn uses analytic default until bounds arrive                                 | TRL-153 AABB fit is source of truth               |
| Async catalog                | **Warm bindings on first clip apply**; sync tick reads cached map                                                                          | No await in hot path after preload                |
| Loop flag                    | Read `loop` from catalog clip entry when setting `Mesh3DAnimator.loop`                                                                     | Drop hardcoded `LOOPING` set                      |

---

## Catalog schema extension

Add optional top-level `locomotion` to `ClipCatalog`:

```jsonc
{
  "@id": "catalog:mesh2motion-human",
  "locomotion": {
    "idle": "Idle_Loop",
    "walk": "Walk_Loop",
    "jog": "Jog_Fwd_Loop",
    "run": "Sprint_Loop",
    "sprint": "Sprint_Loop",
    "jumpStart": "Jump_Start",
    "jumpLoop": "Jump_Loop",
    "jumpLand": "Jump_Land"
  }
}
```

TypeScript (`clipCatalog.ts`):

```ts
export type LocomotionBindingKey =
  | "idle"
  | "walk"
  | "jog"
  | "run"
  | "sprint"
  | "jumpStart"
  | "jumpLoop"
  | "jumpLand";

export interface LocomotionBindings {
  idle: string;
  walk: string;
  jog: string;
  run: string;
  sprint: string;
  jumpStart: string;
  jumpLoop: string;
  jumpLand: string;
}

export interface ClipCatalog {
  // ...existing fields
  locomotion?: Partial<LocomotionBindings>;
}
```

`resolveLocomotionClip(catalog, key): string | undefined` — requires
`locomotion[key]` or returns undefined.

`getLocomotionBindings(ref): Promise<LocomotionBindings>` — loads catalog,
merges partial map with M2M defaults for missing keys (dev ergonomics only when
`@id` is mesh2motion-human).

---

## Player type defaults (`spawnPlayer.ts`)

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
  defaults: {
    SkinnedMesh: {
      mesh: "/models/characters/mannequin.glb",
      anchor: "bottom",
      rig: "human",
      forwardYaw: 0,
      capsuleRadiusScale: 1,
      capsuleHeightScale: 1,
    },
    Mesh3DAnimator: {
      catalog: "catalog:mesh2motion-human",
      clip: "Idle_Loop",
      speed: 1,
      loop: true,
      rootMotion: false,
      playing: true,
    },
    Physics: {
      body: "kinematicPosition",
      collider: "capsule",
      mass: 70,
      gravityScale: 0,
    },
    Jump: {},
  },
});
```

`buildPlayer(clientId, spawn)`:

```ts
components: {
  Transform: bag('Transform', { position: spawn }),
  SkinnedMesh: bag('SkinnedMesh', { color }),
  Mesh3DAnimator: bag('Mesh3DAnimator'),
  Player: bag('Player', { color }),
  Physics: bag('Physics'),
  Jump: bag('Jump')
}
```

---

## SkinnedMesh motor hints (`registry.ts`)

| Field                | Type         | Default | Use                                                    |
| -------------------- | ------------ | ------- | ------------------------------------------------------ |
| `forwardYaw`         | number (deg) | `0`     | Added to motor yaw on skinned visual under PhysicsBody |
| `capsuleRadiusScale` | number       | `1`     | Multiplier on AABB-derived radius                      |
| `capsuleHeightScale` | number       | `1`     | Multiplier on AABB-derived halfHeight                  |

Apply in `capsuleFromBounds` (read scales from entity bag) and player facing
(read `forwardYaw`).

---

## `playerLocomotionClips.ts` refactor

1. Remove exported `TIER_CLIP` / `JUMP_*_CLIP` constants (tests may import
   bindings helper instead).
2. Per-entity cache: `Map<entityId, LocomotionBindings>` warmed via
   `ensureLocomotionBindings(entity)` on first use.
3. `setAnimClip` resolves loop from catalog clip metadata
   (`clips.find(id).loop`).
4. `applyLocomotionClip` / `applyJumpAnimClip` use binding keys, not string
   literals.

---

## Rest height (`spawnPlayer.ts` + `playerCapsuleFit.ts`)

```ts
export function capsuleRestCenterY(
  fit: FittedCapsule,
  floorTopY = 0.05,
): number {
  return floorTopY + fit.radius + fit.halfHeight;
}
```

- `PLAYER_REST_Y` becomes `capsuleRestCenterY(DEFAULT)` for backward compat
  export.
- `spawnPositionFromBase` accepts optional `fit?: FittedCapsule` (default
  `DEFAULT`).

---

## Files

| File                                             | Change                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `static/catalogs/mesh2motion-human.json`         | Add `locomotion` map                          |
| `src/lib/engine/animation/clipCatalog.ts`        | Types + `getLocomotionBindings` + loop lookup |
| `src/lib/engine/player/playerLocomotionClips.ts` | Catalog-driven bindings                       |
| `src/lib/engine/player/spawnPlayer.ts`           | Type defaults; thin `buildPlayer`             |
| `src/lib/engine/ontology/registry.ts`            | SkinnedMesh hint fields                       |
| `src/lib/engine/player/playerCapsuleFit.ts`      | Scale args; `capsuleRestCenterY`              |
| `src/lib/engine/render/PhysicsBody.svelte`       | `forwardYaw` on visual; pass scales to fit    |
| `docs/ontology.md`                               | Document new fields + catalog `locomotion`    |
| `scripts/player-locomotion-bindings-smoke.ts`    | Assert M2M map resolves all keys              |
| `e2e/player-skinned-avatar.spec.ts`              | Still passes (regression)                     |

---

## Acceptance criteria (machine)

```bash
pnpm check
pnpm run test:player-clip
tsx scripts/player-locomotion-bindings-smoke.ts
PW_REUSE=1 pnpm test:e2e e2e/player-skinned-avatar.spec.ts
```

Behavioral:

- Default `?game=` player still mannequin + tier clips unchanged visually.
- Removing `locomotion` from a test catalog causes explicit fallback/warn, not
  silent idle.

---

## Test plan

1. **Smoke:** load `catalog:mesh2motion-human`, assert 8 binding keys resolve to
   existing clip ids.
2. **Unit:** `playerLocomotionClips` with mock bindings — tier hysteresis
   unchanged.
3. **E2e:** existing skinned avatar spec (play mode, clip field present).
4. **Manual:** swap `SkinnedMesh.mesh` + `Mesh3DAnimator.catalog` on Character
   entity in editor — locomotion follows new catalog when map present.
