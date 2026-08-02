---
version: 1
name: Rapier2D adoption gate
status: reference
---

# Decision gate: when thin Rapier3D colliders fail

**Context:** Phase 1–4 of 2D support uses **2D-in-3D** — orthographic camera, sprite quads, and **Rapier3D** with thin box/capsule colliders on the play plane. **Rapier2D** is an optional Phase 5 fork.

---

## Stay on Rapier3D (thin colliders) when

- Side-view platformers with **few AABB platforms** and capsule player (current character-controller path).
- Top-down games on the **XZ plane** (already native).
- **2.5D / hybrid** levels mixing 2D sprites with 3D props.
- Collision shapes are **≤ ~50** dynamic bodies and **no tilemap mesh**.

Thin collider recipe:

- `plane: xy` — `Collider cuboid` with small Z depth (e.g. `0.2`) on platforms; player capsule aligned to Y-up gravity.
- `plane: xz` — existing ground + box colliders unchanged.

---

## Adopt Rapier2D when **any** of these hold

| Trigger | Why 3D hacks break down |
| ------- | ------------------------ |
| **Tilemap collision** | Hundreds of merged boxes or per-tile bodies are costly / fragile in 3D |
| **Complex 2D polygons** | Concave level geometry needs 2D decomposition, not thin extrusions |
| **One-way platforms** | Native 2D platform features (collision groups, sensor semantics) cleaner in 2D |
| **Performance ceiling** | Profiling shows physics step > 2ms for 2D-only scenes with 3D backend |
| **Pure 2D shipping target** | No 3D props; maintaining dual Z-lock bugs costs more than a 2D world |

---

## Implementation cost (estimate)

| Item | Effort |
| ---- | ------ |
| `@dimforge/rapier2d-compat` + `PhysicsWorld2D.svelte` | L |
| `Physics2D` component + `PhysicsBody2D.svelte` | M |
| `Thing.svelte` branch on `Physics2D` vs `Physics` | S |
| Inspector + placement (already plane-aware) | S |
| Dual-backend CI / e2e | M |

**Total:** ~1–2 weeks focused; blocks on none of Phase 1–4.

---

## Recommended gate process

1. Ship gameplay with thin 3D colliders + `WorldProfile` + sprites.
2. Add a **tilemap prototype** on 3D colliders; profile physics step.
3. If tile count > **~200** solid cells **or** step time > **2ms**, open Rapier2D wedge.
4. Keep `WorldProfile.dimensions === '2d'` stable — swap physics backend behind `Physics` vs `Physics2D` component presence.

---

## Non-goals for Rapier2D wedge

- Replacing 3D physics for existing 3D worlds
- Canvas2D / Pixi parallel renderer
- Sync protocol changes (still vec3 `Transform` on the wire)
