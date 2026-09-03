# TRL-253 — Journal

## 2026-09-03 — Spec authored (Architect)

Repo: `~/TURTLE/Projects/Sandbox/museum-oss`.

**Origin:** TRL-251 proposal (strategist next-wedge) — the tracked follow-on
from TRL-233 ("cross-entity ground-reference"), now that TRL-234/235
(Terrain-owned grass) is closed.

**Key finding:** `createTerrainGrass(surface, …)` is already surface-agnostic —
the only missing piece is *obtaining* another entity's mesh, since views own
their meshes privately (no registry, no entity-id tagging). Spec resolves this
with a per-scene surface registry (publish on mount / remove on unmount) plus
`resolveScatterSurface(entityId)`, warn-and-skip on missing surfaces, and
geometry-revision-driven respawns.

**Teach:** when a helper already takes the dependency as a parameter (here: a
`Mesh`), the spec question is never "how to scatter" but "how the caller gets
hold of the argument" — lookup, lifecycle, and rebuild triggers are the whole
contract.
