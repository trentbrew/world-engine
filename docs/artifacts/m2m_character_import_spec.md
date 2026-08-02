---
version: 1
name: M2M human rig standard for imported characters
status: draft
parent: TRL-159
labels: spec, animation, assets, skinned-mesh
related: skinned_mesh_animation_spec.md, TRL-147
---

# Spec: M2M human rig standard for imported characters (TRL-159)

**Decision (pathway B):** Every playable humanoid uses the **mannequin clip
set** (`catalog:mesh2motion-human` — 164 clips, shared packs, locomotion map).
Foreign skeletons are **retargeted at import** via Mesh2Motion; runtime does not
retarget.

**Parent:** TRL-147 (Player / skinned mesh epic)

---

## Problem

Uploading a rigged GLB auto-spawns a `Character`, but `Mesh3DAnimator` clips
bind to **bone names**. Sketchfab / Mixamo exports use incompatible
skeletons → T-pose or garbage deformation with the default catalog.

## Contract

| Item               | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| Canonical skeleton | Mesh2Motion human (`root` → `pelvis` → `spine_01`…)        |
| Canonical catalog  | `catalog:mesh2motion-human`                                |
| Default rest clip  | `Idle_Loop`                                                |
| Retarget tool      | [Mesh2Motion](https://mesh2motion.org/) (human rig export) |
| Units              | 1 export unit = 1 m (`WorldProfile.unit`)                  |

Detection heuristics (shared by audit script + runtime warn):

| Family              | Signal                              |
| ------------------- | ----------------------------------- |
| `mesh2motion-human` | joints include `pelvis` + `spine_*` |
| `mixamo`            | any `mixamorig:*`                   |
| `biped`             | `Bip001_*` (3ds Max)                |
| `custom`            | skin present, none of above         |
| `static`            | no skin                             |

---

## Deliverables

### 1. Audit tooling

| Path                                | Role                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `scripts/character-rig.mjs`         | Parse GLB, classify family, M2M pass/fail              |
| `scripts/audit-characters.mjs`      | Scan `static/models/**/*.glb`, human table or `--json` |
| `scripts/character-audit-smoke.mjs` | CI smoke                                               |
| `pnpm assets:audit-characters`      | npm alias                                              |
| `pnpm test:character-audit`         | smoke alias                                            |

### 2. Runtime mismatch warn

`src/lib/engine/animation/rigFamily.ts` + `SkinnedMeshView` console.warn when
`Mesh3DAnimator.catalog` family ≠ loaded mesh family (dev aid, non-fatal).

### 3. Defaults unified on M2M

- `characterMeshDefaults.ts` — all characters default to `mesh2motion-human`
- `CharacterFemale` type — same catalog (Xbot mesh until retargeted)
- Remove per-rig Mixamo catalog routing for placement (keep `xbot-mixamo.json`
  as reference only)

### 4. Import workflow (human-in-loop)

```bash
# 1. Audit what you have
pnpm assets:audit-characters

# 2. Foreign rig → Mesh2Motion → export human GLB → static/models/characters/

# 3. Optional lean (strip embedded clips, use shared packs)
pnpm assets:lean-mannequin   # pattern for any M2M export

# 4. Re-audit — action should read "ok"
pnpm assets:audit-characters
```

Sketchfab import (`pnpm import:sketchfab`) routes rigged GLBs to `characters/`
but does **not** retarget — run audit after import.

### 5. Batch retarget (manual, post-spec)

Priority uploads needing M2M export:

- `xbot.glb`, `mannequin.glb`, `player.glb`

**Not in scope for executor v1:** automated Mesh2Motion batch (no headless API).

---

## Acceptance criteria

| # | Criterion                                                                          | Verify                |
| - | ---------------------------------------------------------------------------------- | --------------------- |
| 1 | `pnpm test:character-audit` passes                                                 | smoke                 |
| 2 | `pnpm assets:audit-characters` lists every GLB with family + action                | manual                |
| 3 | Mannequin = `ok`; ≥1 foreign rig = `retarget`                                      | smoke asserts         |
| 4 | Loading foreign rig + `mesh2motion-human` catalog logs `[skinned] … mismatch` warn | manual / e2e optional |
| 5 | `pnpm check` clean                                                                 | CI                    |
| 6 | Spec doc committed (`docs/artifacts/m2m_character_import_spec.md`)                 | review                |

**Follow-up (human):** Retarget ≥3 characters in Mesh2Motion; re-audit until
`needsRetarget` count drops; demo in `animated-npc-demo` or new world slice.

---

## Files

| Path                                                 | Change                                |
| ---------------------------------------------------- | ------------------------------------- |
| `scripts/character-rig.mjs`                          | new                                   |
| `scripts/audit-characters.mjs`                       | new                                   |
| `scripts/character-audit-smoke.mjs`                  | new                                   |
| `src/lib/engine/animation/rigFamily.ts`              | new                                   |
| `src/lib/engine/animation/characterMeshDefaults.ts`  | M2M-only defaults                     |
| `src/lib/engine/render/views/SkinnedMeshView.svelte` | mismatch warn                         |
| `src/lib/engine/ontology/registry.ts`                | CharacterFemale → mesh2motion catalog |
| `package.json`                                       | audit scripts                         |

---

## Open questions

| Question                          | Lean                                                |
| --------------------------------- | --------------------------------------------------- |
| Block placement when audit fails? | Warn only v1; hard block in inspector v2            |
| Delete `xbot-mixamo.json`?        | Keep as reference; nothing references it at runtime |
