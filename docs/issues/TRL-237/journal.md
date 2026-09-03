# TRL-237 — Journal

## 2026-09-02 — Spec authored (Architect)

Follow-on to [[issue:TRL-235]] (Terrain-owned grass, shipped). User chose **design B**: blend meadow
ground dirt + lush/dry patches over the terrain's vertex-color elevation ramp (not a swap).

**Key findings:** the grass ground treatment is world-XZ procedural (`groundDirt(vGndXZ)` +
`GROUND_MASK_GLSL`) and keys off the same `u.surface` uniforms the blades use — so it drapes over the
heightmap with no geometry coupling. Implementation = an `onBeforeCompile` patch on the terrain's
existing `MeshStandardMaterial` (keeps `vertexColors: true`), blending dirt/patches after
`<color_fragment>`.

**Design cautions carried:** avoid double-tinting by keeping the vertex ramp as the grass base; don't
wholesale-swap material; keep the trimesh collider + geometry untouched. Additive/flag-off.

**Children:** proposal [[issue:TRL-236]]; spec [[issue:TRL-237]]. Next: executor.
