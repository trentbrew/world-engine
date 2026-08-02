---
version: 1
name: vec2 ontology decision
status: decided
---

# Decision: vec2 vs vec3 for 2D transforms

---

## Question

Should 2D worlds introduce `Transform2D` with `vec2` position, or keep `Transform` as `vec3` with conventions?

---

## Decision

**Keep `Transform` as vec3; add `vec2` as an optional field type for future 2D-specific components.**

### Rationale

| Concern | vec3 convention | Separate Transform2D |
| ------- | --------------- | -------------------- |
| Multiplayer sync | Already ships `Transform.position` realtime | New field wire format |
| Formula engine | `Transform.position.x/y/z` works today | Duplicate scope paths |
| 3D/2D hybrid (SSX, parallax) | Z = layer depth / sort | Awkward merge |
| Inspector | One transform gizmo path | Second gizmo mode |

### 2D conventions on vec3

| Profile | Position semantics |
| ------- | ------------------ |
| `plane: xy` (side-view) | `[x, y, layer]` — `layer` → `Sort` / `Sprite.sortKey` |
| `plane: xz` (top-down) | `[x, layer, z]` — same as today's ground plane |

**Do not** use free Z movement for gameplay on 2D profiles; `playerSystem` locks non-primary axes per plane.

### vec2 field type (implemented)

Added to `FieldType` for components that are genuinely 2D-native (future `Velocity2D`, UV offsets, camera dead zones as pairs):

- Coercion in `loadOntology.ts` and `setField.ts`
- Inspector `vec2` row in `ComponentFieldInput.svelte`
- Formula helper `vec2(x, y)` in `evaluate.ts`

### When to add Transform2D

Only if inspector/gizmo complexity warrants a dedicated type **and** we accept a migration shim (`Transform2D` → vec3 at load). Not required for Phase 1–4 of 2D support.

---

## Acceptance

- [x] `vec2` in schema + coercion + inspector
- [x] 2D worlds documented to use vec3 `Transform` with plane conventions
- [x] No `Transform2D` type in registry (deferred)
