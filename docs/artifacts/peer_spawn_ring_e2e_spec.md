---
version: 1
name: MP spawn ring Playwright e2e
parent: TRL-40
spec: TRL-41
status: queue-ready
---

# Spec: MP spawn ring Playwright e2e

**Parent proposal:** TRL-40 · **Epic:** TRL-29 (peer spawn ring)  
**Problem:** TRL-29 fixed stacked peer spawns in `spawnPoints.ts`, but verification relied on inline tsx smoke only. No Playwright test proves two real browser tabs land on distinct XZ positions in the same room.

---

## Summary

Add `e2e/peer-spawn-ring.spec.ts`: two pages in one Playwright `context`, shared `room` query param, both in play mode on `?game=orbit`. Probe live player `Transform.position` values and assert pairwise ground XZ separation ≥ **1.0 m** (engine `MIN_SEPARATION` is 1.2 m; threshold allows float + capsule rest height slack).

**No engine changes** unless probe wiring requires a tiny export — prefer reusing `worldProbe` pattern from `e2e/play-edit-boundary.spec.ts`.

---

## Architect decisions

| Question | Decision | Rationale |
| -------- | -------- | ----------- |
| Game | **`orbit`** | Single authored spawn marker (`entity:spawn/center`); forces ring fan-out when N>1 — exact TRL-29 regression surface |
| Transport | **BroadcastChannel** (default, no `?net=relay`) | Same-browser two-tab MP; stable in CI with `PW_REUSE=1` |
| Room id | Unique per run: `` `spawn-ring-${Date.now()}` `` | Isolates roster from other dev tabs |
| Mode | Both tabs **`mode=play`** (or Play tab selected) | Spawns reconcile on roster join via `session.#syncMemberSpawns` |
| Assertion | Min pairwise XZ distance ≥ **1.0 m** among all `entity:player/*` with valid Transform | Catches stack-at-center; below 1.2 m engine min to absorb numeric noise |
| Peer wait | Poll until **≥ 2 player entities** visible on **each** page (timeout 30 s) | Roster + remote spawn must settle before measure |
| Out of scope | Relay MP; 3+ peers; spawn ring overlay pixels; edit-mode spawn | Keep wedge narrow; extend later if needed |

---

## E2E — `e2e/peer-spawn-ring.spec.ts`

### Helpers (in spec or `e2e/helpers.ts` if reused)

Reuse `primeCollabStorage` from `./helpers`.

**`worldProbe`** — copy pattern from `play-edit-boundary.spec.ts` (dynamic import of `world.svelte.ts` URL from performance entries).

**`playerSpawnXZ(page)`** — returns `{ id, x, z }[]` for entities where `id.startsWith('entity:player/')` and `Transform.position` is a length-3 array.

**`minPairwiseXZDistance(positions)`** — brute-force min `hypot(dx, dz)` for i < j; return `Infinity` if < 2 points.

### Test: `two peers in orbit do not stack on spawn`

| Step | Action |
| ---- | ------ |
| 1 | `context.newPage()` → `peerA`, `peerB`; `primeCollabStorage` both |
| 2 | `room = spawn-ring-${Date.now()}` |
| 3 | `peerA.goto('/?game=orbit&mode=play&room=' + room)` |
| 4 | `peerB.goto('/?game=orbit&mode=play&room=' + room)` |
| 5 | Each: `#world-status` contains `World loaded`; Play tab `aria-selected=true` (15 s) |
| 6 | Poll both pages until `playerSpawnXZ` length ≥ 2 (30 s, 500 ms interval) |
| 7 | On **peerA**, read positions; assert `minPairwiseXZDistance(positions) >= 1.0` |
| 8 | Repeat assert on **peerB** (both clients agree on separation) |

Optional hardening (non-blocking for v1): assert local + remote player ids differ between tabs.

---

## Files touched

| Path | Change |
| ---- | ------ |
| `e2e/peer-spawn-ring.spec.ts` | **new** — two-tab spawn separation |
| `e2e/helpers.ts` | optional — extract `worldProbe` if duplicating |

**Read-only references:** `src/lib/engine/player/spawnPoints.ts`, `src/lib/engine/net/session.svelte.ts`, `static/games/orbit.jsonld`

---

## Acceptance criteria

- test: `bash -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && cd museum && pnpm check'`
- test: `bash -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && cd museum && PW_REUSE=1 pnpm test:e2e e2e/peer-spawn-ring.spec.ts'`
- `docs/artifacts/peer_spawn_ring_e2e_spec.md` exists (this file)
- Two-tab orbit play: peer player Transform XZ positions are ≥ 1.0 m apart (no stack on single spawn marker)

---

## Verification ladder (Executor)

1. Manual smoke: two tabs `?game=orbit&room=foo` play mode — avatars visibly separated
2. `pnpm check`
3. `PW_REUSE=1 pnpm test:e2e e2e/peer-spawn-ring.spec.ts`
4. `trellis issue check TRL-41`
