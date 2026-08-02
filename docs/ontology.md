# Ontology reference

The engine's vocabulary. For the how-to, see [AGENTS.md](../AGENTS.md); this is
the precise reference. Source of truth:
[registry.ts](../src/lib/engine/ontology/registry.ts) and
[schema.ts](../src/lib/engine/ontology/schema.ts).

## Field types

`number` · `string` · `boolean` · `vec3` (`[x,y,z]` or `{x,y,z}`) · `quat`
(`[x,y,z,w]` or `{x,y,z,w}`) · `color` (any CSS color) · `ref` (string or
`{"@id": "..."}`) · `json` (passthrough).

## Sync policies

| policy              | stored? | on the wire?         | computed?                           |
| ------------------- | ------- | -------------------- | ----------------------------------- |
| `durable` (default) | yes     | once (spawn)         | no                                  |
| `realtime`          | yes     | every tick, by owner | no                                  |
| `derived`           | no      | never                | every tick, locally, from a formula |

## Built-in components

| Component          | Field              | Type    | Sync         | Default                            |
| ------------------ | ------------------ | ------- | ------------ | ---------------------------------- |
| **Transform**      | position           | vec3    | realtime     | `[0,0,0]`                          |
|                    | rotation           | quat    | realtime     | —                                  |
|                    | scale              | vec3    | durable      | `[1,1,1]`                          |
| **Render**         | mesh               | ref     | durable      | `primitive:box`                    |
|                    | color              | color   | durable      | `#ff6b6b`                          |
|                    | anchor             | string  | durable      | `origin`                           |
| **Light**          | kind               | string  | durable      | `ambient`                          |
|                    | intensity          | number  | durable      | `1`                                |
| **Marker**         | kind               | string  | durable      | `spawn`                            |
| **Ground**         | size               | number  | durable      | `20`                               |
|                    | color              | color   | durable      | `#0e0e12`                          |
| **Gravity**        | g                  | number  | durable      | `9.8`                              |
|                    | vy                 | number  | realtime     | `0`                                |
|                    | rest               | number  | durable      | `0.5`                              |
| **Player**         | speed              | number  | durable      | `4`                                |
|                    | color              | color   | durable      | per-client                         |
| **SkinnedMesh**    | mesh               | ref     | durable      | `/models/characters/mannequin.glb` |
|                    | anchor             | string  | durable      | `bottom`                           |
|                    | rig                | string  | durable      | `human`                            |
|                    | color              | color   | durable      | `#ffffff`                          |
|                    | forwardYaw         | number  | durable      | `0` (deg; rig facing under motor)  |
|                    | capsuleRadiusScale | number  | durable      | `1` (AABB capsule radius mult.)    |
|                    | capsuleHeightScale | number  | durable      | `1` (AABB capsule height mult.)    |
|                    | castShadow         | boolean | durable      | `true`                             |
|                    | receiveShadow      | boolean | durable      | `true`                             |
| **Mesh3DAnimator** | catalog            | ref     | durable      | `catalog:mesh2motion-human`        |
|                    | clip               | string  | **realtime** | `Idle_Loop`                        |
|                    | speed              | number  | durable      | `1`                                |
|                    | loop               | boolean | durable      | `true`                             |
|                    | rootMotion         | boolean | durable      | `false`                            |
|                    | playing            | boolean | realtime     | `true`                             |

`mesh` is either `primitive:box` (or any `primitive:*`, falls back to a box) or
a `.glb`/`.gltf` URL (loads via `@threlte/extras` GLTF, box fallback on error).

`anchor` (glTF only) aligns the loaded mesh to `Transform.position`:

| value    | meaning                                                                   |
| -------- | ------------------------------------------------------------------------- |
| `origin` | file pivot at `position` (default — no change)                            |
| `bottom` | bbox bottom at `position.y` — ground props; hover via `y > 0`             |
| `center` | bbox center at `position` — matches `primitive:box` + gravity `rest: 0.5` |

## Component → view mapping

Renderable components and the view that draws them (registered in
[render/registerViews.ts](../src/lib/engine/render/registerViews.ts)):

| Component   | View                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Render      | MeshView (box or glTF)                                               |
| SkinnedMesh | SkinnedMeshView (rigged glTF + AnimationMixer; reads Mesh3DAnimator) |
| Ground      | GroundView (plane + grid)                                            |
| Marker      | MarkerView (spawn gizmo)                                             |
| Light       | LightView (ambient/directional)                                      |

`Transform` is consumed by views (placement); it has no view of its own.
Likewise `Mesh3DAnimator` has no view — `SkinnedMeshView` reads it to drive the
mixer, exactly as `SpriteView` reads `Animator`. Clip names resolve against a
catalog under `static/catalogs/` (see
[clipCatalog.ts](../src/lib/engine/animation/clipCatalog.ts) and
[skinned_mesh_animation_spec.md](artifacts/skinned_mesh_animation_spec.md)).
Catalogs may declare a `locomotion` map (`idle`, `walk`, `jog`, `run`, `sprint`,
`jumpStart`, `jumpLoop`, `jumpLand`) so the Player motor binds tiers without
engine hardcoding.

## Built-in types

| Type             | Components                                                    | Defaults                                |
| ---------------- | ------------------------------------------------------------- | --------------------------------------- |
| GroundPlane      | Transform, Ground                                             | —                                       |
| Prop             | Transform, Render                                             | —                                       |
| SpawnPoint       | Transform, Marker                                             | —                                       |
| AmbientLight     | Light                                                         | `Light.kind = ambient`                  |
| DirectionalLight | Light, Transform                                              | `Light.kind = directional`              |
| Player           | Transform, SkinnedMesh, Mesh3DAnimator, Player, Physics, Jump | mannequin + Idle_Loop; capsule collider |
| Character        | Transform, SkinnedMesh, Mesh3DAnimator                        | —                                       |

## Formula language

- **Literals:** numbers, `'strings'`, `true`/`false`.
- **References:** sibling fields (`max`), components by name
  (`Transform.position`), vector members (`.x .y .z .w` on arrays), `t` `dt`
  `tick` `pi`.
- **Functions:**
  `min max abs floor ceil round sqrt sin cos clamp(v,lo,hi)
  vec(x,y,z) other(id)`.
  `other(id)` returns another entity's components.
- **Operators:** `+ - * / %` · `< <= > >= == !=` · `&& || !` · `cond ? a : b`.

## Network message types

Session-level messages over the transport
([transport.ts](../src/lib/engine/net/transport.ts)): `join` · `hello` · `ping`
· `leave` (presence) · `spawn` / `despawn` (entity replication) · `state` (a
`StatePatch` of realtime fields). `id` is always the sender; patches are trusted
only from each entity's owner.

## Engine layout

```
src/lib/engine/
  ontology/   schema, registry, loader, WorldSource (+ sources/trellis)
  runtime/    reactive entity store (world.svelte.ts)
  formula/    expression compiler + evaluator
  systems/    scheduler + behaviors (gravity)
  net/        transport interface, local (BroadcastChannel), relay (Trellis /rt), session
  player/     input, spawnPlayer, movement
  render/     Thing (fractal), component views, access helpers
```
