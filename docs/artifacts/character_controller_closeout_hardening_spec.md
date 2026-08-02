---
version: 1
name: Character controller closeout hardening
parent: TRL-118
status: queue-ready
---

# Spec: Character Controller Closeout Hardening

**Parent proposal:** TRL-118  
**Epic:** TRL-96  
**Scope:** graph/check closeout for the reviewed character-controller stack  
**Out of scope:** new movement mechanics, retuning gameplay feel, moving-platform authoring UI, network reconciliation.

---

## Problem

The character-controller implementation stack has review-pass evidence:

- TRL-98 ground detection → TRL-108
- TRL-100 jump feel → TRL-116
- TRL-102 velocity motor → TRL-114
- TRL-104 velocity clipping + visual step-lag → TRL-115
- TRL-106 platform velocity inheritance → TRL-117

However, the epic is not graph-clean. `pnpm check` is red at a pre-existing project baseline, and several issue AC/check entries are stale or over-broad. The closeout wedge should make the project shippable without reopening passed gameplay behavior.

---

## Architect Decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Fix or bypass `pnpm check`? | **Fix the current TypeScript errors; do not bypass checks.** | The failing files are unrelated baseline errors, but a green static gate is needed for honest closeout. |
| What about warnings? | Warnings may remain if `pnpm check` exits 0. | The blocking issue is red static verification, not cosmetic warning cleanup. |
| Gameplay behavior changes? | Avoid unless a verification command exposes a regression. | TRL-98/100/102/104/106 already passed review; this is a hardening/closeout wedge. |
| Graph metadata? | Record final verification and close reviewed character-controller slices where the CLI permits. | The graph should reflect review reality without rewriting specs retroactively. |
| Verification shape | Re-run focused smoke/e2e commands used by the reviewed slices plus `pnpm check`. | This preserves the deterministic smoke/browser split established in TRL-104 and TRL-106. |

---

## Required Code Cleanup

### `src/lib/engine/collab/peerEditToasts.ts`

Fix the `DurablePatch` narrowing errors in `describePatch`. The current switch cases access fields such as `component`, `entityId`, and `name` on the full union.

Acceptable approaches:

- Import/use the discriminant type helpers if they already exist.
- Add local type guards that narrow by `patch.op`.
- Refactor `describePatch` to delegate each case through small typed helpers.

Do not widen to `any` unless the source patch type is genuinely unrepresentable.

### `src/lib/scene/viewportNavigation.ts`

Fix the `mouseWheelAction` assignment mismatch. Keep the existing wheel-routing behavior, but type the temporary action so it matches Threlte/Three controls expectations.

Acceptable approaches:

- Import the relevant control type if exported.
- Derive the wheel action type from `controls.mouseButtons.wheel`.
- Use a narrow local alias rather than a broad number cast.

---

## Required Closeout Artifact

Create `docs/artifacts/character_controller_closeout_report.md` with:

- Review evidence table for TRL-98, TRL-100, TRL-102, TRL-104, TRL-106 and review children TRL-108, TRL-116, TRL-114, TRL-115, TRL-117.
- Verification commands run in this closeout wedge and their pass/fail result.
- Any remaining non-blocking warnings or known graph metadata limitations.
- A ship recommendation for TRL-96 if all required checks pass.

---

## Verification Commands

Run:

```bash
pnpm check
pnpm run test:player-clip
pnpm run test:platform-velocity
pnpm test:e2e e2e/movement-motor.spec.ts
pnpm test:e2e e2e/jump-feel.spec.ts
pnpm test:e2e e2e/movement-clip-visual.spec.ts
```

Use the existing e2e wrapper. Reuse a running dev server if available; cold-start only if needed. If Playwright is busy, retry once after the lock clears.

---

## Graph Closeout

After verification:

1. Update `TRL-118` with a closeout summary.
2. Update the implementation issues (`TRL-98`, `TRL-100`, `TRL-102`, `TRL-104`, `TRL-106`) with the final verification artifact path.
3. Close reviewed implementation issues where `trellis issue close --confirm` succeeds.
4. If the CLI cannot close an issue because of stale AC metadata, leave it queued but add a clear description note naming the verified review child and the blocker.
5. Record a milestone: `Character controller closeout verified`.

---

## Acceptance Criteria

1. `pnpm check` exits 0 without suppressing diagnostics or weakening TypeScript/Svelte configuration.
2. `peerEditToasts.ts` and `viewportNavigation.ts` static errors are fixed with typed/narrow changes, not broad `any` casts.
3. `docs/artifacts/character_controller_closeout_report.md` records review evidence, commands, results, residual risks, and ship recommendation.
4. Focused character-controller verification commands pass: `test:player-clip`, `test:platform-velocity`, `movement-motor`, `jump-feel`, and `movement-clip-visual`.
5. Graph state is reconciled as far as the CLI permits: reviewed impl issues are closed or explicitly annotated with why stale AC metadata still prevents closure.
