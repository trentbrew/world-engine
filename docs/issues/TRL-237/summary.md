# TRL-237 — Spec: Terrain ground dirt/patch overlay (blend)

Parent: [[issue:TRL-236]] · Proposal: [[issue:TRL-236]] · Follow-on: [[issue:TRL-235]]

**Repo:** `~/TURTLE/Projects/Sandbox/museum-oss`

## Problem

TRL-235 gave `Terrain` grass blades scattered onto its heightmap, but the terrain surface still
renders its own vertex-color elevation ramp (`colorLow→colorHigh`) with no ground texture. Meadow's
grass field shows the **ground treatment** the blades grow out of — a grass tint with lush↔dry patches
and procedural **dirt** — painted by `makeGroundMaterial` (`render/grass/materials/groundMaterial.ts`)
via the world-XZ `groundDirt(vGndXZ)` mask.

Design fork resolved to **B**: add the dirt + patches **over** the elevation ramp (keep the ramp), not
swap it out.

## Approach

When `Terrain.grass.enabled`, patch the terrain's existing `MeshStandardMaterial` (which keeps
`vertexColors: true`) with an `onBeforeCompile` that:

1. carries world XZ (`vGndXZ`) from the vertex shader,
2. injects `GROUND_MASK_GLSL` / `GROUND_MASK_UNIFORMS` (`groundDirt()`, `_gmFbm`) and the grass ground
   uniforms (from the same `createGrassFieldUniforms().surface` the blades use),
3. after `<color_fragment>` (so the vertex-color ramp is the base), blends:
   - lush/dry patches: `diffuse.rgb = mix(diffuse.rgb, mix(uPatchLush, uPatchDry, pt), uPatchStrength)`
   - dirt: `diffuse.rgb = mix(diffuse.rgb, uDirtColor, _dirt)`

No wholesale material swap; the collider (trimesh) and the terrain geometry / vertex-color ramp are
unchanged. Blades (TRL-235) untouched. Absent/disabled `grass` → terrain renders exactly as today.

```mermaid
flowchart LR
  A[Terrain.grass.enabled] --> B{terrain material onBeforeCompile}
  B --> C[vertex: vGndXZ = world XZ]
  C --> D[GROUND_MASK_GLSL: groundDirt/_gmFbm]
  D --> E[color base = vertex ramp (vColor)]
  E --> F[+ lush/dry patch tint]
  F --> G[+ dirt (uDirtColor * groundDirt)]
  G --> H[grass blades on top (TRL-235)]
```

## Files (Executor deps)

| File | Change |
| ---- | ------ |
| `src/lib/engine/render/terrain/terrain.ts` | Add `onBeforeCompile` injection of ground-mask GLSL + uniforms + blend (grass-enabled) |
| `src/lib/engine/render/views/TerrainView.svelte` | Pass the grass uniforms / enable flag to the terrain material when `grass.enabled` |
| `src/lib/engine/render/grass/shaders/groundMask.ts` | **Unchanged** — reuse `GROUND_MASK_GLSL`/`UNIFORMS` |
| `src/lib/engine/render/grass/terrainGrass.ts` | (optional) expose uniforms / ground-material helper |

**New primitives:** the shader blend + a `scripts/terrain-dirt-smoke.ts`. No new behavior systems.

## Acceptance criteria

```text
test:bash -lc "source ~/.nvm/nvm.sh && nvm use 22 >/dev/null 2>&1 && cd /Users/trentbrew/TURTLE/Projects/Sandbox/museum-oss && pnpm check"
test:bash -lc "source ~/.nvm/nvm.sh && nvm use 22 >/dev/null 2>&1 && cd /Users/trentbrew/TURTLE/Projects/Sandbox/museum-oss && pnpm test:terrain-dirt"
test:bash -lc "cd /Users/trentbrew/TURTLE/Projects/Sandbox/museum-oss && grep -q 'groundDirt' src/lib/engine/render/terrain/terrain.ts"
```

Behavioral: `grass.enabled` → terrain surface shows dirt + lush/dry patches over the vertex ramp
(smoke asserts the ground-mask blend path is present and `pnpm check`); `grass` absent/disabled →
original terrain material; collider + geometry unchanged.
