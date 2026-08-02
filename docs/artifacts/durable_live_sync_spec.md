---
version: 1
name: Durable Live-Sync (TRL-40)
parent: TRL-30
extends: docs/artifacts/trellis_durable_tier_spec.md
status: blocked-upstream
---

# Spec: Durable Live-Sync — Poll → Push + Per-Field EAV

**Issue:** TRL-40 · **Depends:** TRL-41 (trellis-node CORS), trellis-node `create()` with explicit `entity:*` ids

---

## Problem

Today durable cross-tab sync uses **~1s polling** because:

1. Whole `@graph` stored as one **WorldBundle** entity (last-write-wins)
2. EQL type-match subscription does not fire on bundle attribute updates
3. Granular per-field EAV nodes cannot use stable `entity:ground/main`-style ids until Trellis `create()` accepts them

---

## Goal

- **Push** durable edits to peers via Trellis WS subscription (no poll loop)
- **Per-entity/per-field** EAV nodes so concurrent edits to different entities merge instead of clobber

---

## Phased delivery

### Phase A — trellis-node unblock (TRL-41 + upstream)

| Task | Owner | AC |
| ---- | ----- | -- |
| CORS allow `x-trellis-transport` | trellis-node / TRL-41 | Browser client connects cross-origin |
| `create()` accepts `entity:*` ids | trellis-node | Seed graph with stable entity ids |

**Gate:** TRL-40 impl does not start Phase B until Phase A green in staging.

### Phase B — graphToEav granularity

| File | Change |
| ---- | ------ |
| `ontology/sources/eav.ts` | One Trellis entity per world entity; attributes `Component.field` |
| `ontology/seedWorld.ts` | Seed per-entity nodes, not monolithic WorldBundle |
| `durableStore.ts` | `updateField` targets single entity attribute |

**AC:** Edit `Ground.color` writes one EAV triple; edit `Prop/1.color` writes another; reload preserves both.

### Phase C — push subscribe

| File | Change |
| ---- | ------ |
| `durableStore.ts` | Replace poll subscribe with EQL live query on entity attributes |
| `durable/session.svelte.ts` | Remove poll interval; WS patch callback only |
| `StatusBar.svelte` | `durable: live` vs `polling` indicator removed when push works |

**AC:** Two tabs `?durable=trellis` — host edits color → peer updates **<200ms** without poll.

---

## Acceptance criteria (TRL-40)

1. `pnpm test:durable` extended for multi-entity EAV roundtrip
2. No polling interval in `durableStore.subscribe` (grep clean)
3. Concurrent edits to **different** entities on two hosts do not clobber (manual 2-tab)
4. `pnpm check` + `pnpm build` green

---

## Blocked until

- [ ] trellis-node: explicit `entity:*` on create
- [ ] TRL-41: CORS header (for prod Trellis host; local mitigated by Vite proxy)

---

## Out of scope

- Vercel-hosted Trellis (separate infra issue)
- Optimistic durable + rollback
- Entity spawn/despawn via Trellis op-log
