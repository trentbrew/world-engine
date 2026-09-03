# TRL-234 — Journal

## 2026-09-02 — Spec authored (Architect)

Repo: `~/TURTLE/Projects/Sandbox/museum-oss`.

**Origin:** Strategist feasibility answer on "render meadow GrassField on terrain heightmap" →
recommendation **Pathway 1 (Terrain-owned grass)**; Pathway 2 (cross-entity ground ref) tracked as
follow-on.

**Key finding (feasibility + gap):** `render/grass/scatter.ts` samples the scatter mesh's **world-space**
vertices (`buildSurfaceSampler` → `samplePoint`), so blades inherit surface height automatically. The
only blocker is wiring: a `GrassField` cannot scatter onto another entity's mesh (flat plane or named
`groundMesh` inside its own `.glb`). Solution: let `Terrain` own its grass, scattering onto its own
displaced mesh.

**Decisions baked into spec:**
- `Terrain` gains an optional `grass` sub-config; **default off** (additive / flag-off).
- Reuse `scatterBlades`/`scatterFlowers` + grass params/materials — no new shader.
- **Rejected** the heightmap-delegation alternative: blades are baked as world-space instances at build
  time (no per-vertex shader displacement), so a shader-sampled height texture wouldn't move them.
- Design cautions carried: segment density (~0.47u cells) + slope lean (`tilt`) + play-only wind.

**Children:** proposal [[issue:TRL-233]]; spec [[issue:TRL-234]]. Handoff next: executor.
