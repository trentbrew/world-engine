---
version: 1
name: WorldProfile — 2D/3D world switch
status: implemented
---

# Spec: WorldProfile component

**Runtime:** `src/lib/engine/world/worldProfile.ts`, `worldProfile.svelte.ts`  
**Demo world:** `static/games/platformer2d.jsonld` (`?game=platformer2d`)

---

## Summary

`WorldProfile` is a **durable, world-level component** on `entity:world/profile` that switches dimension semantics without forking the entity graph or network layer.

---

## Data model

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `dimensions` | `'3d' \| '2d'` | `'3d'` | When `'2d'`, play mode uses orthographic 2D follow camera |
| `plane` | `'xy' \| 'xz'` | `'xz'` | `xy` = side-view; `xz` = top-down (existing 3D ground plane) |
| `unit` | `'meter' \| 'pixel'` | `'meter'` | Sprite sizing uses `pixelsPerUnit` when `pixel` |
| `pixelsPerUnit` | number | `64` | World units per texture pixel |
| `gravity` | vec3 | `[0, -9.81, 0]` | Passed to Rapier `World` in play mode |

Optional sibling component **`Camera2D`** on the same entity tunes play follow (dead zone, zoom).

---

## Runtime flow

1. `loadOntology` merges `WorldProfile` schema (built-in in `registry.ts`).
2. `worldProfile.hydrate(entities)` in `WorldShell` parses `entity:world/profile`.
3. When `dimensions === '2d'`, viewer projection defaults to **orthographic**.
4. Subsystems read `worldProfile.profile`:
   - `PhysicsWorld` — gravity vector
   - `placementRaycast` — plane normal (`xy` → Z=0, `xz` → Y=0)
   - `playerSystem` — horizontal axis on `xy` plane (A/D only; jump/gravity handle Y)
   - `WorldScene` — backdrop orientation, 2D play camera

---

## Authoring example

```jsonc
{
  "@id": "entity:world/profile",
  "@type": "Thing",
  "components": {
    "WorldProfile": {
      "dimensions": "2d",
      "plane": "xy",
      "unit": "pixel",
      "pixelsPerUnit": 64,
      "gravity": { "x": 0, "y": -20, "z": 0 }
    },
    "Camera2D": { "zoom": 52, "deadZoneX": 1.5 }
  }
}
```

---

## Acceptance

- [x] Built-in `WorldProfile` + `Camera2D` schemas registered
- [x] `worldProfile` singleton hydrated on world load
- [x] Missing profile entity → 3D defaults (backward compatible)
- [x] `platformer2d` demo world loads via `?game=platformer2d`
