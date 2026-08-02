---
version: 1
name: Sprite + Animator views (EX-SPRITE)
status: implemented
---

# Spec: Sprite and Animator components

**View:** `src/lib/engine/render/views/SpriteView.svelte`  
**Backlog:** EX-SPRITE in `docs/backlog/threlte-extras.md`

---

## Summary

`Sprite` replaces `Render` for 2D assets: textured quads on the play plane with anchor, tint, flip, and draw order. `Animator` drives sprite-sheet frame selection from `scheduler.t`.

---

## Sprite fields

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `texture` | ref | `/logo.png` | Image URL |
| `frame` | json | `[0,0,64,64]` | `[x, y, w, h]` pixel rect when no Animator |
| `anchor` | string | `bottom` | `origin` \| `bottom` \| `center` |
| `sortKey` | number | `0` | Render order + micro Z offset |
| `flipX` | boolean | `false` | Mirror horizontally |
| `color` | color | `#ffffff` | Tint multiplier |

`Sort.order` overrides `sortKey` when present.

---

## Animator fields

| Field | Type | Default |
| ----- | ---- | ------- |
| `fps` | number | `8` |
| `frameCount` | number | `1` |
| `columns` | number | `1` |
| `frameWidth` | number | `64` |
| `frameHeight` | number | `64` |

Frame index: `floor(t * fps) % frameCount` → grid position via `columns`.

---

## Render implementation

- **Geometry:** `PlaneGeometry` sized by `frame / pixelsPerUnit` from `WorldProfile`.
- **Plane orientation:** `xy` profile → facing +Z; `xz` profile → rotated −90° X (flat on ground).
- **Texture:** `TextureLoader` with `repeat`/`offset` for frame rect; disposes on URL change.
- **Picking:** Same `pickHandlers` as `MeshView`; registered in `outlineRegistry`.

---

## Entity type

`SpriteProp` = `Transform` + `Sprite` (built-in type in `registry.ts`).

---

## Acceptance

- [x] `SpriteView` registered in `registerViews.ts`
- [x] `Sprite` in `PICKABLE_COMPONENTS`
- [x] Animated sheets via `Animator`
- [x] Fallback colored quad on load failure
