---
version: 1
name: GameMaker sprites (Phase 4)
parent: TRL-121
issue: TRL-130
impl: TRL-131
status: queue-ready
labels: spec, gamemaker-model, sprites
---

# Spec: Sprite asset — GM alignment, derived frame index, mask; xy renderer path

**Parent proposal:** TRL-121 · [`docs/plans/gamemaker-model.md`](../plans/gamemaker-model.md) Phase 4  
**Impl:** TRL-131 (blocked on this spec)  
**Baseline:** [`sprite_view_2d_spec.md`](sprite_view_2d_spec.md) (EX-SPRITE — **already implemented**)

---

## Summary

Phase 4 does **not** greenfield a renderer — **`Sprite` + `Animator` + `SpriteView`** already ship the **xy (and xz-flat) quad path** (`platformer2d.jsonld`, `SpriteProp`). This spec **closes the GameMaker vocabulary gap**: derived **`frameIndex`** (`image_index`), **`mask`**, event-writable **`fps`** (`frameSpeed`), and a **`sprites-demo`** wedge + e2e. **Separate graph `SpriteAsset` nodes** and **3D mesh billboard** are deferred.

---

## Architect decisions (closes forks)

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Renderer v1 | **Keep `SpriteView.svelte`** — textured `PlaneGeometry` on play plane | EX-SPRITE done; satisfies “xy renderer path” |
| Component split | **Keep `Sprite` + `Animator`** (no merge) | Stable EX-SPRITE; GM maps across two bags |
| GM `frameSpeed` | **`Animator.fps`** — authors/events use `{ "set": "Animator.fps", "to": N }` | Same semantics as GM `image_speed` |
| GM `frameIndex` | **`Animator.frameIndex`** — **`derived`** default `=floor(t * fps) % max(frameCount, 1)` | Proposal: animate without wire cost; readable in inspector/events |
| Frame selection source | **`SpriteView` reads `Animator.frameIndex`** when present; else legacy `scheduler.t` math | Single source of truth after formula pass |
| GM `origin` | **`Sprite.anchor`** (`origin` \| `bottom` \| `center`) | Already shipped |
| GM `frames` | **`Sprite.texture` + `Animator.columns/frameCount/frameWidth/frameHeight`** | Sheet ref + grid metadata |
| **`mask`** | **`Sprite.mask`** enum `box` \| `circle` \| `precise`, default **`box`** | GM vocabulary v1; **no collision change** (still `Collision.radius`) |
| `precise` mask | **Stored only v1** — no pixel-perfect hit test | Follow-up with collision adapter |
| EntityType `"sprite": "sprite:coin"` | **Out of scope v1** | Inline component defaults on `EntityType` suffice |
| 3D mesh path | **Out of scope v1** | 3D games keep `Render`; follow-up **P4b** |
| Demo world | **`static/games/sprites-demo.jsonld`** | Isolated wedge; do not bloat `platformer2d` |
| E2E | **`e2e/sprites-demo.spec.ts`** — paused scheduler + `formulaSystem` ticks | Deterministic frame index |
| Workbench | **Out of scope** — Sprites rail stub stays; atlas editor is TRL-137 | Cohesion follow-up |

---

## GameMaker ↔ engine mapping

| GameMaker | Engine (v1) | Notes |
| --------- | ----------- | ----- |
| sprite / texture | `Sprite.texture` | URL ref |
| origin | `Sprite.anchor` | |
| image_speed | `Animator.fps` | Event `set` target |
| image_index | `Animator.frameIndex` | **derived** |
| frames / sheet | `Animator.frameCount`, `columns`, `frameWidth`, `frameHeight` | |
| static sub-rect | `Sprite.frame` `[x,y,w,h]` | When `frameCount <= 1` |
| mask | `Sprite.mask` | Data-only v1 |
| layer / depth | `Sort.order` or `Sprite.sortKey` | |

---

## Data model changes

### `Sprite` — add `mask` (`registry.ts`)

```ts
registerComponent({
  name: 'Sprite',
  fields: {
    texture: { t: 'ref', default: '/logo.png' },
    frame: { t: 'json', default: [0, 0, 64, 64] },
    anchor: { t: 'string', default: 'bottom' },
    sortKey: { t: 'number', default: 0 },
    flipX: { t: 'boolean', default: false },
    color: { t: 'color', default: '#ffffff' },
    mask: { t: 'string', default: 'box' } // box | circle | precise
  }
});
```

### `Animator` — add derived `frameIndex` (`registry.ts`)

```ts
registerComponent({
  name: 'Animator',
  fields: {
    fps: { t: 'number', default: 8 },
    frameCount: { t: 'number', default: 1 },
    columns: { t: 'number', default: 1 },
    frameWidth: { t: 'number', default: 64 },
    frameHeight: { t: 'number', default: 64 },
    frameIndex: {
      t: 'number',
      sync: 'derived',
      default: '=floor(t * fps) % max(frameCount, 1)'
    }
  }
});
```

**Normative JSON-LD** (animated prop + create slows animation):

```jsonc
{
  "@id": "type:Torch",
  "@type": "EntityType",
  "components": ["Transform", "Sprite", "Animator"],
  "defaults": {
    "Sprite": { "texture": "/logo.png", "anchor": "bottom", "mask": "box" },
    "Animator": { "fps": 8, "frameCount": 4, "columns": 4, "frameWidth": 64, "frameHeight": 64 }
  },
  "events": {
    "create": [{ "set": "Animator.fps", "to": 4 }]
  }
}
```

---

## Runtime

### `SpriteView.svelte`

Replace local `animFrame` derivation:

```ts
const animFrame = $derived.by(() => {
  if (!animator || (animator.frameCount ?? 1) <= 1) return 0;
  const idx = animator.frameIndex;
  if (typeof idx === 'number' && Number.isFinite(idx)) {
    return Math.floor(idx) % Math.max(1, animator.frameCount ?? 1);
  }
  const fps = animator.fps ?? 8;
  const count = animator.frameCount ?? 1;
  return Math.floor(scheduler.t * fps) % count;
});
```

Static `Sprite.frame` path unchanged when no multi-frame `Animator`.

### Formula / events

- **`formulaSystem`** already writes derived fields each tick — no new system.
- **`{ "set": "Animator.fps", "to": <expr> }`** works via existing `applySet` / `applyFieldLocal`.
- **`create`** on `Torch` type in demo verifies event path (fps 8 → 4 after create).

### Scheduler order (unchanged)

Behaviors → input → alarms → collision → events → **formulaSystem** (last). Render reads post-tick component bags.

---

## Demo world — `static/games/sprites-demo.jsonld`

| Piece | Role |
| ----- | ---- |
| `WorldProfile` `2d` / `xy` / `pixelsPerUnit: 64` | True 2D plane |
| Ground + spawn + ambient light | Play entry |
| **`type:Torch`** + **`entity:torch/1`** | 4-frame sheet on `/logo.png`; `create` sets `Animator.fps` to **4** |
| Load via `?game=sprites-demo` | |

---

## E2E — `e2e/sprites-demo.spec.ts`

Paused scheduler probe (mirror `input-demo.spec.ts`):

1. `primeCollabStorage`, goto `?game=sprites-demo&mode=play`
2. Pause scheduler; `world.isOwner = () => true`
3. Resolve `entity:torch/1`; assert `Animator.fps === 4` after load (create fired on first play tick **or** probe runs `eventSystem` once if create not yet fired — document: call `eventSystem` once at t=0 before assert)
4. Run `formulaSystem({ dt: 0.125, t: 0.125, tick: 1 })` → expect `Animator.frameIndex === 1` (floor(0.125*4)%4 with fps=4)
5. Run `formulaSystem({ dt: 0.125, t: 0.25, tick: 2 })` → expect `frameIndex === 2`
6. Assert `Sprite.mask === 'box'`

---

## Files

| File | Change |
| ---- | ------ |
| `docs/artifacts/gamemaker_sprites_spec.md` | **This spec** |
| `src/lib/engine/ontology/registry.ts` | `Sprite.mask`; `Animator.frameIndex` derived |
| `src/lib/engine/render/views/SpriteView.svelte` | Prefer `Animator.frameIndex` |
| `static/games/sprites-demo.jsonld` | **New** |
| `e2e/sprites-demo.spec.ts` | **New** |

**Already done (no impl work):** `registerViews.ts`, `SpriteView` quad + xy plane, `SpriteProp`, `PICKABLE_COMPONENTS`, `platformer2d.jsonld`.

**Out of scope:** `@type: SpriteAsset` graph nodes; 3D `Render` mesh path; mask-driven collision; Workbench atlas UI; `precise` mask rasterization.

---

## Acceptance criteria

1. `Sprite.mask` registered (`box` \| `circle` \| `precise`).
2. `Animator.frameIndex` registered as **derived** with default formula.
3. `SpriteView` uses `Animator.frameIndex` when multi-frame animating.
4. Events can `{ "set": "Animator.fps", "to": N }` (demo `create` handler).
5. `static/games/sprites-demo.jsonld` loads; torch animates metadata correct.
6. `pnpm check` passes.
7. `PW_REUSE=1 pnpm test:e2e e2e/sprites-demo.spec.ts` passes.
8. `PW_REUSE=1 pnpm test:e2e e2e/platformer2d.spec.ts` or smoke — **no regression** on 2D world (if no platformer2d e2e, run `e2e/events-demo.spec.ts` as proxy regression).

---

## Verification

```bash
pnpm check
PW_REUSE=1 pnpm test:e2e e2e/sprites-demo.spec.ts
PW_REUSE=1 pnpm test:e2e e2e/events-demo.spec.ts
```

---

## Follow-ups (not this impl)

| ID | Title |
| -- | ----- |
| P4b | 3D billboard / mesh path for `Sprite` in `dimensions: 3d` worlds |
| P4c | Graph `SpriteAsset` node + EntityType `sprite:` ref |
| P4d | `mask: precise` → collision / pick adapter |
| UI | Workbench Sprites rail — sheet preview, frame scrub (TRL-137) |
