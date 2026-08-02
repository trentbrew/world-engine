---
version: 1
name: Skinned mesh animation (generative characters)
status: draft
labels: spec, animation, rigging, threlte, mesh2motion
related: blender-mcp sandbox, mesh2motion-app, UAL
---

# Spec: Skinned mesh animation — `SkinnedMesh`, `Mesh3DAnimator`, clip catalogs

**Goal:** Let agents and authors place **animated 3D characters** in JSON-LD
worlds without hand-rigging — acquire mesh (Sketchfab / Hyper3D), rig + bind
clips (Mesh2Motion or UAL), ship GLB to `static/models/`, reference by **clip
name** in world data.

**Research context:** Explored in `blender-mcp` sandbox (Blender MCP, Quaternius
UAL, Mesh2Motion TypeScript app). This spec ports the conclusions into
the engine's data-first ontology.

---

## Summary

| Layer           | Responsibility                                              |
| --------------- | ----------------------------------------------------------- |
| **Acquisition** | Sketchfab API, Hyper3D — mesh-only GLB                      |
| **Prep**        | Mesh2Motion (rig + skin + export) or Blender MCP sidecar    |
| **Catalog**     | JSON manifest of clip names → metadata (not curve data)     |
| **Ontology**    | `SkinnedMesh` + `Mesh3DAnimator` components on entities     |
| **Runtime**     | `SkinnedMeshView` — Threlte `GLTF` + Three `AnimationMixer` |
| **Agents**      | world-author MCP: `clip`, `catalog`, `mesh` fields          |

Animation is **data** (clip id + catalog ref), same pattern as `Sprite` +
`Animator` for 2D.

---

## Pipeline

```
┌──────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Acquire      │───►│ Normalize   │───►│ Rig + clips      │───►│ the engine │
│ Sketchfab    │    │ GLB, scale  │    │ Mesh2Motion / UAL│    │ JSON-LD entity   │
│ Hyper3D      │    │ 1u = 1m     │    │ export GLB       │    │ SkinnedMesh      │
└──────────────┘    └─────────────┘    └──────────────────┘    └─────────────────┘
```

### Canonical human rig (v1)

Pick **one** skeleton contract for preset clips:

| Source                          | Bones                                     | Clip count               | Notes                               |
| ------------------------------- | ----------------------------------------- | ------------------------ | ----------------------------------- |
| **mesh2motion-human** (default) | M2M human rig (`root` → `pelvis` → spine) | 164 (88 base + 76 addon) | Same Three.js stack; `RigConfig.ts` |
| **ual-standard**                | UE-style 65-bone                          | 43                       | Quaternius UAL; retarget at import  |
| **mixamo**                      | mixamorig:*                               | external                 | M2M retarget module already maps    |

**Decision (v1):** `mesh2motion-human` as default catalog. UAL/Mixamo are
import-time retarget targets, not runtime mixing.

### Acquisition notes

| Source                                            | Output                             | Gotcha                                         |
| ------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| [Sketchfab API](https://sketchfab.com/developers) | Often rigged GLB, variable quality | Per-model license; filter CC/downloadable      |
| [Hyper3D](https://hyper3d.ai)                     | Mesh-only GLB typical              | Always route through Mesh2Motion human rig     |
| Blender MCP                                       | Search/download/generate + export  | Kitchen, not runtime — see `blender-mcp` tools |

---

## Data model

### Design: mirror `Sprite` + `Animator`

2D already splits **what to draw** from **how it moves**:

| 2D (existing)                         | 3D (proposed)                                 |
| ------------------------------------- | --------------------------------------------- |
| `Sprite` — texture, frame rect        | `SkinnedMesh` — GLB url, anchor, rig hint     |
| `Animator` — fps, frameCount, columns | `Mesh3DAnimator` — clip, catalog, speed, loop |

### `SkinnedMesh` component

```ts
registerComponent({
  name: "SkinnedMesh",
  fields: {
    mesh: { t: "ref", default: "/models/characters/mannequin.glb" },
    anchor: { t: "string", default: "bottom" }, // same semantics as Render.anchor
    rig: { t: "string", default: "human" }, // catalog key / rig family
    color: { t: "color", default: "#ffffff" }, // optional tint; toon pass
    castShadow: { t: "boolean", default: true },
    receiveShadow: { t: "boolean", default: true },
  },
});
```

| Field                          | Type    | Sync    | Meaning                                                                    |
| ------------------------------ | ------- | ------- | -------------------------------------------------------------------------- |
| `mesh`                         | ref     | durable | Path under `static/` — skinned GLB with skeleton + optional embedded clips |
| `anchor`                       | string  | durable | `origin` \| `bottom` \| `center` — same as `Render`                        |
| `rig`                          | string  | durable | Rig family for catalog lookup (`human`, `fox`, …)                          |
| `color`                        | color   | durable | Material tint (optional)                                                   |
| `castShadow` / `receiveShadow` | boolean | durable | Shadow flags                                                               |

**GLB expectations:**

- Contains `SkinnedMesh` + `Skeleton` (exported from Mesh2Motion or UAL)
- May embed animation clips **or** rely on external catalog GLBs (see below)
- Units: **1 Blender/M2M unit = 1 meter** (matches `WorldProfile.unit`)

### `Mesh3DAnimator` component

```ts
registerComponent({
  name: "Mesh3DAnimator",
  fields: {
    catalog: { t: "ref", default: "catalog:mesh2motion-human" },
    clip: { t: "string", default: "Idle_Loop" },
    speed: { t: "number", default: 1 },
    loop: { t: "boolean", default: true },
    rootMotion: { t: "boolean", default: false },
    playing: { t: "boolean", sync: "realtime", default: true },
  },
});
```

| Field        | Type    | Sync     | Meaning                                            |
| ------------ | ------- | -------- | -------------------------------------------------- |
| `catalog`    | ref     | durable  | Clip manifest id (see catalogs)                    |
| `clip`       | string  | durable  | Clip name within catalog (`Walk_Loop`, `Angry`, …) |
| `speed`      | number  | durable  | Playback rate multiplier                           |
| `loop`       | boolean | durable  | Loop clip or play once                             |
| `rootMotion` | boolean | durable  | Use `_RM` variant / root bone translation          |
| `playing`    | boolean | realtime | Pause/resume; owner can toggle over network        |

**Clip resolution order:**

1. Clip embedded in entity's `mesh` GLB (by name)
2. Else load from catalog's `packs` (shared GLB files; each clip names its
   `file` key)
3. Else fallback: `Idle_Loop` if present, else T-pose static

### `Character` entity type

```ts
registerType({
  name: "Character",
  components: ["Transform", "SkinnedMesh", "Mesh3DAnimator"],
});
```

`Player` adopts `SkinnedMesh` + `Mesh3DAnimator` (mannequin) instead of
`primitive:capsule` — **shipped** via
[player_default_skinned_avatar_spec.md](./player_default_skinned_avatar_spec.md)
(TRL-147/148/149). Capsule remains the analytic collider only.

### Provenance (optional `json` bag)

For agent traceability, entities may include a durable `meta` component or
inline `@json` extension (future). Suggested shape:

```json
"meta": {
  "acquiredFrom": "sketchfab:abc123",
  "generatedBy": "hyper3d:job_xyz",
  "riggedBy": "mesh2motion",
  "rigVersion": "2026.1"
}
```

Not required for runtime v1.

---

## Clip catalogs

Catalogs are **JSON manifests** in `static/catalogs/` — not embedded in
ontology. Agents read catalogs to know valid `clip` values.

Example: `static/catalogs/mesh2motion-human.json` (see repo file).

```json
{
  "@id": "catalog:mesh2motion-human",
  "rig": "human",
  "source": "mesh2motion",
  "rootBone": "root",
  "hipBone": "pelvis",
  "packs": {
    "base": "/catalogs/animations/human-base-animations.glb",
    "addon": "/catalogs/animations/human-addon-animations.glb"
  },
  "clips": [
    {
      "id": "Idle_Loop",
      "category": "locomotion",
      "file": "base",
      "dur": 3.125,
      "loop": true
    },
    {
      "id": "Roll_RM",
      "category": "action",
      "file": "base",
      "dur": 1.833,
      "loop": false,
      "rootMotion": true
    }
  ]
}
```

`rootBone` (not `hipBone`) carries locomotion travel — root-motion clips
translate `root`; `pelvis` only holds the in-place body bob. Locomotion **loops
are in-place** (no `_RM` variant); root motion exists only on discrete moves
(`Roll_RM`, `Dodge_*_RM`, `Sword_Attack_RM`, climbs, jumps).

**v1 rule:** `clips[].id` must match Three.js `AnimationClip.name` in the source
GLBs — verified 2026-07-06 by parsing the GLB animation chunks (164 clips: 88
base + 76 addon).

Catalogs are **durable world-adjacent data** — loaded at runtime by url, not
synced per-entity.

---

## Runtime (`SkinnedMeshView`)

New view registered alongside `MeshView`:

```ts
registerView("SkinnedMesh", SkinnedMeshView);
```

### Responsibilities

1. Load `SkinnedMesh.mesh` via `@threlte/extras` `GLTF`
2. Resolve `Mesh3DAnimator.clip` via catalog loader
3. Create `AnimationMixer` on the skinned root
4. Advance mixer in `useTask` with `delta * speed`
5. Apply `anchor` offset (reuse `meshAnchor.ts`)
6. Honor `playing` — zero weight when false
7. **Root motion (shipped, Phase 2):** if `rootMotion: true`, the view reads the
   `root` bone's per-frame travel **in the mesh's own frame**
   (`object.worldToLocal` of the bone's world position — folds in the GLB's
   baked armature orientation), maps it to world via the mesh's world quaternion
   (so **entity rotation steers** the travel), and adds the XZ delta to
   `Transform.position`. The bone's XZ is zeroed every frame on all clients so
   the mesh stays centred; only the owner writes the delta (peers receive it via
   sync) and only in **play mode**. Loop wraps (action time resets) are skipped
   so the clip's end→start jump never teleports. Never the hips (`pelvis`),
   which only carry in-place bob.

### Clip loader service

`src/lib/engine/animation/clipCatalog.ts`:

- `loadCatalog(ref: string): Promise<ClipCatalog>`
- `resolveClip(catalog, clipId): Promise<AnimationClip>` — cache by file+name
- Lazy-load animation GLBs; dedupe across entities sharing a catalog

### Sync policy

| Field                                    | Wire?        | Notes                                                   |
| ---------------------------------------- | ------------ | ------------------------------------------------------- |
| `SkinnedMesh.*`                          | once (spawn) | durable                                                 |
| `Mesh3DAnimator.catalog/clip/speed/loop` | once         | durable                                                 |
| `Mesh3DAnimator.playing`                 | yes          | realtime — for networked emotes                         |
| Mixer time                               | **no**       | derived locally from `playing` + `speed` + global clock |

Do **not** sync per-bone transforms. Peers infer pose from `clip` + shared time
(acceptable v1) or from `playing` + clip change events.

---

## World example

`static/games/animated-npc-demo.jsonld`:

```json
{
  "@id": "entity:npc/guard",
  "@type": "Thing",
  "conformsTo": "Character",
  "components": {
    "Transform": { "position": [0, 0, 0] },
    "SkinnedMesh": {
      "mesh": "/models/characters/mannequin.glb",
      "anchor": "bottom",
      "rig": "human"
    },
    "Mesh3DAnimator": {
      "catalog": "catalog:mesh2motion-human",
      "clip": "Idle_Loop",
      "loop": true
    }
  }
}
```

Event-driven clip change (existing action DSL extension — Phase 2):

```json
"events": {
  "create": [{ "set": "Mesh3DAnimator.clip", "to": "Idle_Loop" }],
  "alarm0": [{ "set": "Mesh3DAnimator.clip", "to": "Walk_Loop" }]
}
```

---

## Import pipeline (POC)

Proof-of-concept vertical slice — no engine code required until Phase 1 view
exists.

### Step A — Export from Mesh2Motion

1. `cd blender-mcp/mesh2motion-app && npm run dev`
2. **Use Your Model** → upload GLB (Sketchfab download or Hyper3D export)
3. Human skeleton → edit → weight → pick clips → **Download GLB**
4. Save to `static/models/characters/<name>.glb`

### Step B — Copy catalog animations (one-time)

```bash
cp mesh2motion-app/static/animations/human-base-animations.glb \
   ./static/catalogs/animations/
cp mesh2motion-app/static/animations/human-addon-animations.glb \
   ./static/catalogs/animations/
```

### Step C — World + dev

```bash
# repo root
pnpm dev
# open http://localhost:9292/?game=animated-npc-demo
```

### Step D — Agent path (shipped, Phase 3)

`scripts/world-author-mcp.mjs` now carries these tools (backed by read-only
`/api/animation/{catalogs,clips}` routes + `animationCatalogApi.ts`):

| Tool                       | Purpose                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `animation_list_catalogs`  | List catalogs under `static/catalogs/` (id, rig, clip count)                                        |
| `animation_list_clips`     | Clips in a catalog — the valid `Mesh3DAnimator.clip` values                                         |
| `world_set_character_clip` | Set a Character's clip, **validated** against its catalog (rejects unknown clips, lists valid ones) |

An agent can also `world_spawn_entity` a `Character` directly (empty bags
resolve to schema defaults at load → default mannequin + `Idle_Loop`). In the
editor, **placement detects a rigged GLB** (`isRiggedModel` — skeleton or
embedded clips) and routes it to `world.createCharacter` (animated), while a
static GLB stays a `Prop`. Verified by `e2e/animated-npc-demo.spec.ts` +
`scripts/world-api-smoke.mjs`.

Blender MCP is an **optional** acquisition convenience
(`download_sketchfab_model`, `generate_hyper3d_model_via_text`). The engine
ships a **Blender-free** Sketchfab leg:

### Step E — Sketchfab import (shipped, Phase 4)

```bash
# Search downloadable models (requires SKETCHFAB_API_KEY in root .env)
pnpm import:sketchfab -- --search "low poly character" --limit 8

# Import by UID → static/models/ or static/models/characters/ (rigged auto-route)
pnpm import:sketchfab -- --uid <UID> [--name my-slug]
```

`scripts/sketchfab-import.mjs` downloads a Sketchfab glTF archive, packs to a
single `.glb` via `@gltf-transform/cli`, detects rigged meshes (skeleton or
embedded clips), routes to `characters/` when rigged, and writes a
`.provenance.json` sidecar (license, page URL). **No Blender required.** Hyper3D
generation deferred (no free tier).

**Lean default mannequin** (mesh+skeleton only, clips from catalog packs):

```bash
pnpm assets:lean-mannequin   # mannequin.glb ~600 KB; full export → mannequin.full.glb
```

---

## Implementation phases

| Phase | Deliverable                                                          | Effort |
| ----- | -------------------------------------------------------------------- | ------ |
| **0** | This spec + catalog JSON + demo world stub                           | done   |
| **1** | `SkinnedMesh`, `Mesh3DAnimator`, `SkinnedMeshView`, `clipCatalog.ts` | done   |
| **2** | Root motion, `set` action for clip, play/pause events                | done   |
| **3** | world-author MCP tools, asset dropzone accepts rigged GLB            | done   |
| **4** | Sketchfab import script + lean mannequin + provenance sidecars       | done   |

**Phase 1 acceptance:**

- `?game=animated-npc-demo` shows skinned mannequin in `Idle_Loop`
- Changing `clip` in JSON-LD switches animation after reload
- Two characters can share catalog GLBs without duplicate network payload

---

## Open questions

| Question                                          | Lean                                             | Defer                  |
| ------------------------------------------------- | ------------------------------------------------ | ---------------------- |
| Merge `Render` + `SkinnedMesh`?                   | No — keep separate; props stay on `Render`       | —                      |
| Embed all clips in character GLB vs shared packs? | Shared packs (smaller per-character file)        | Per-export override ok |
| Multiplayer clip sync                             | `clip` durable + `playing` realtime; local mixer | Full state sync never  |
| Physics capsule + skinned mesh                    | Skinned visual child of physics body             | Phase 2                |
| Cascadeur round-trip                              | Out of scope                                     | Blender MCP optional   |

---

## File checklist (Phase 1 impl)

| Path                                                 | Change                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| `src/lib/engine/ontology/registry.ts`                | Register components + `Character` type      |
| `src/lib/engine/render/views/SkinnedMeshView.svelte` | New view                                    |
| `src/lib/engine/render/registerViews.ts`             | `registerView('SkinnedMesh', …)`            |
| `src/lib/engine/animation/clipCatalog.ts`            | Catalog loader                              |
| `static/catalogs/mesh2motion-human.json`             | Manifest                                    |
| `static/games/animated-npc-demo.jsonld`              | Demo world                                  |
| `docs/ontology.md`                                   | Document new components                     |
| `scripts/sketchfab-import.mjs`                       | Sketchfab → static GLB import (Phase 4)     |
| `scripts/lean-mannequin.mjs`                         | Strip embedded clips from default mannequin |
| `static/models/characters/xbot.glb`                 | three.js example rig — smoke asset          |

---

## References

- [Mesh2Motion](https://mesh2motion.org/) — rig + clip export (TypeScript /
  Three.js)
- [Quaternius UAL](https://quaternius.com/animviewer.html) — CC0 clip library
- [Cascadeur docs](https://cascadeur.com/help) — physics polish layer (optional)
- the engine `Sprite` + `Animator` — 2D precedent in `registry.ts`
- blender-mcp sandbox — Blender MCP, UAL preview panel, M2M local dev
