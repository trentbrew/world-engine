# Scene DSL IR — spatial shell compiler

> **Kind:** design thesis / daydream → buildable  
> **Status:** agreed direction, not scheduled  
> **Not:** a game rules language (JSON-LD + behaviors already own that)  
> **Related:** [naruto_trellis_lexicon.md](./naruto_trellis_lexicon.md), Turtle HQ loft / World Labs skinning

## Thesis

Move from a **pixel raster** (spectrogram metaphor) to a **sealed text DSL / SVG IR**. That cuts the CV failure class: anti-aliasing, color drift, boundary ambiguity.

LLMs and humans get a text-first DSL with finite verbs and explicit math → **syntactic determinism**, human legibility, and Git-diffability.

This IR authors **space** (bounds, elevation, markers). It does not replace the game language; genre rules stay in components, formulas, and behaviors. Optional genre *packs* (`spline` / `grid` / `blastzone`) can extend the shell later without becoming a universal game DSL.

---

## Why this architecture wins

### Zero-hallucination constraints

Sealed verb set (`wall`, `room`, `raise`, `stair`, `marker`, …). An agent writing `.scene` cannot invent unhandled spatial types — valid syntax or lint failure.

### LLM-native

Models emit structured text with far higher fidelity than pixel-exact rasters or uncorrupted binaries.

### Explicit math over spatial guesswork

Wall center from segment endpoints:

\[
(x, z) = \left(\frac{x_1 + x_2}{2},\ \frac{z_1 + z_2}{2}\right)
\]

Compiler derives midpoint transforms, box extents, and yaw from `poly` / `rect` vectors. No flood-fills.

### Verticality

Multi-tier spaces (`raise mezz` at \(y = 3.0\), office slab at \(y = 0.15\)) are hostile to flat pixel maps; one explicit line in `.scene`.

---

## Separation of responsibilities

```text
  [ Human / LLM ]
         │
         ▼
 ┌──────────────┐      ┌──────────────┐
 │ .scene DSL   │ ───► │ .svg View    │  (2D preview / Figma)
 └──────────────┘      └──────────────┘
         │
     (Compile)
         │
         ▼
 ┌──────────────┐      ┌──────────────┐
 │ .jsonld Graph│ ───► │ Runtime      │  (Physics, meshes, ECS)
 └──────────────┘      └──────────────┘
         ▲
         │
 ┌──────────────┐
 │ Photo / Skin │  (Marble / materials on compiled colliders)
 └──────────────┘
```

| Layer | Role |
|-------|------|
| **Law (`.scene`)** | Spatial layout, bounds, elevations, entity markers — source of truth for *space* |
| **View (`.svg`)** | Optional 2D projection for browser / Figma — not the spine |
| **Truth (`.jsonld`)** | Compiled `@graph` the engine loads and syncs |
| **Skin (photos / Marble)** | Aesthetic overlays; never layout authority |

Avoid **raster → SVG autotrace** as the core path. Optional: quantized PNG → structured decode → emit `.scene` (recovery), not Potrace-as-law.

---

## Minimal verb set (v0)

| Verb | Meaning |
|------|---------|
| `scene` | Meta: title, scale, default `wall_h`, `floor_y` |
| `wall` | `poly` or segment list → extruded fixed colliders |
| `room` | Named volume; `rect`; optional `wall_style`, `door`, `raise` |
| `raise` | Slab / deck at explicit `y` |
| `stair` | From point to `raise` target; steps + rise |
| `marker` | Stamp → spawn / portal / plaque / … |
| `stamp` | (later) Catalog prop instance |

Genre packs (later, optional): `spline` / `track`, `grid` / `board`, `blastzone` — still shell, not rules.

---

## Example (law)

```text
scene turtle-hq
  title "Turtle HQ shell"
  wall_h 3.2

wall shell
  poly 0,0  16,0  16,10  0,10
  h = wall_h
  thickness 0.2

room conference
  rect 1,1  5x3.5
  kind meeting
  wall_style glass
  door 3.5,1  facing S

room private-office
  rect 12,6  3.5x3.5
  kind office
  wall_style glass
  door 12,7.5  facing W
  raise 0.15

raise mezz
  rect 0,6  8x4
  y 3.0
  kind deck

marker spawn
  at 2,2
  facing N

marker portal@statue
  at 14,2
  facing W
  target game:rooms-demo
```

Compile → `@graph` of `Room`s, fixed `Physics` wall boxes, `SpawnPoint`, `RoomPortal`, etc. Empty shell — no baked furniture.

---

## Implementation sketch

1. **Parser** — line-oriented or light grammar (Lark / Nearley / hand tokenizer).
2. **Lint** — unknown verbs / missing ids / non-manifold polys fail closed.
3. **Geometry fans** — expand `poly` → wall segments; compute `Transform.position` / `scale` / yaw.
4. **Door subtractors** — carve or split wall segments where `door` overlaps.
5. **Graph emitter** — AST → standard JSON-LD `@graph` under `static/games/`.
6. **(Optional)** SVG projector — same AST → 2D view for humans.
7. **(Optional)** Skin bind — map Marble / materials onto compiled collider ids.

**Prove with one room:** 8 verbs, lint, compile → walkable `?game=` before village-scale HQ.

---

## Non-goals

- Pixel spectrograms as source of truth  
- Universal game rules in `.scene`  
- Photoreal generation as layout authority  
- Autotrace / CV as the compile front door  
